import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clinicHasFeature } from '@/lib/features'
import { checkClaimStatus, normalizeClaimStatus } from '@/lib/claim-status'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Claim (RLS scopes to the user's clinic) + the clinic's NPI/name/features.
    const { data: claim } = await supabase
      .from('claims').select('*, clinics(npi, name, features)').eq('id', id).single()
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    const clinic = claim.clinics as unknown as { npi: string | null; name: string | null; features?: Record<string, boolean> | null }
    if (!clinicHasFeature(clinic, 'claim_status')) return NextResponse.json({ error: 'Claim status tracking is not enabled.' }, { status: 403 })
    if (!clinic?.npi) return NextResponse.json({ error: 'Clinic NPI is required to check claim status.' }, { status: 400 })

    const parts = (claim.patient_name as string).trim().split(/\s+/)
    const firstName = parts.length > 1 ? parts[0] : parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]

    const resp = await checkClaimStatus({
      tradingPartnerServiceId: claim.payer_stedi_id,
      providerNpi: clinic.npi,
      providerOrganizationName: clinic.name ?? '',
      firstName, lastName,
      memberId: claim.member_id,
      dateOfBirth: claim.patient_dob ?? undefined,
      gender: claim.gender ?? undefined,
      serviceDateFrom: claim.service_date_from,
      serviceDateTo: claim.service_date_to ?? undefined,
    })
    const norm = normalizeClaimStatus(resp)

    await supabase.from('claims').update({
      status: norm.status,
      status_detail: norm.detail,
      paid_amount: norm.paidAmount,
      payer_claim_number: norm.payerClaimNumber,
      last_checked_at: new Date().toISOString(),
    }).eq('id', id)

    return NextResponse.json({ status: norm.status, detail: norm.detail, paidAmount: norm.paidAmount, needsEnrollment: norm.needsEnrollment })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Status check failed' }, { status: 500 })
  }
}
