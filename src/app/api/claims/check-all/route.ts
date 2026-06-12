import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clinicHasFeature } from '@/lib/features'
import { checkClaimStatus, normalizeClaimStatus } from '@/lib/claim-status'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Refresh status across every open (non-paid) claim in one go.
export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('clinic_id, clinics(npi, name, features)').eq('id', user.id).single()
    const clinicId = profile?.clinic_id
    const clinic = profile?.clinics as unknown as { npi: string | null; name: string | null; features?: Record<string, boolean> | null } | null
    if (!clinicId) return NextResponse.json({ error: 'No clinic on your account.' }, { status: 400 })
    if (!clinicHasFeature(clinic, 'claim_status')) return NextResponse.json({ error: 'Claim status tracking is not enabled.' }, { status: 403 })
    if (!clinic?.npi) return NextResponse.json({ error: 'Clinic NPI is required.' }, { status: 400 })

    // Open claims = not yet paid. Cap the batch to keep it snappy.
    const { data: claims } = await supabase
      .from('claims').select('*').eq('clinic_id', clinicId).neq('status', 'paid')
      .order('created_at', { ascending: true }).limit(50)

    const tally = { checked: 0, paid: 0, denied: 0, pending: 0, errors: 0 }
    for (const claim of claims ?? []) {
      const parts = (claim.patient_name as string).trim().split(/\s+/)
      const firstName = parts[0]
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]
      try {
        const resp = await checkClaimStatus({
          tradingPartnerServiceId: claim.payer_stedi_id,
          providerNpi: clinic.npi, providerOrganizationName: clinic.name ?? '',
          firstName, lastName, memberId: claim.member_id,
          dateOfBirth: claim.patient_dob ?? undefined, gender: claim.gender ?? undefined,
          serviceDateFrom: claim.service_date_from, serviceDateTo: claim.service_date_to ?? undefined,
        })
        const norm = normalizeClaimStatus(resp)
        await supabase.from('claims').update({
          status: norm.status, status_detail: norm.detail, paid_amount: norm.paidAmount,
          payer_claim_number: norm.payerClaimNumber, last_checked_at: new Date().toISOString(),
        }).eq('id', claim.id)
        tally.checked++
        if (norm.status === 'paid') tally.paid++
        else if (norm.status === 'denied') tally.denied++
        else if (norm.status === 'error') tally.errors++
        else tally.pending++
      } catch { tally.errors++ }
      await sleep(400)
    }

    return NextResponse.json(tally)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Batch check failed' }, { status: 500 })
  }
}
