import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clinicHasFeature } from '@/lib/features'
import { checkClaimStatus, normalizeClaimStatus } from '@/lib/claim-status'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Scheduled job: refresh status across every clinic's open claims. Hit this daily
// from a cron (Vercel Cron, GitHub Actions, etc.) with:  Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron disabled (no CRON_SECRET set).' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: clinics } = await supabase.from('clinics').select('id, npi, name, features')
  const enabled = (clinics ?? []).filter(c => c.npi && clinicHasFeature(c as { features?: Record<string, boolean> | null }, 'claim_status'))

  const tally = { clinics: 0, checked: 0, paid: 0, denied: 0, errors: 0 }
  let budget = 200 // cap total checks per run to avoid timeouts

  for (const clinic of enabled) {
    if (budget <= 0) break
    const { data: claims } = await supabase
      .from('claims').select('*').eq('clinic_id', clinic.id).neq('status', 'paid')
      .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(Math.min(budget, 50))
    if (!claims?.length) continue
    tally.clinics++
    for (const claim of claims) {
      if (budget <= 0) break
      budget--
      const parts = (claim.patient_name as string).trim().split(/\s+/)
      const firstName = parts[0]
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]
      try {
        const resp = await checkClaimStatus({
          tradingPartnerServiceId: claim.payer_stedi_id,
          providerNpi: clinic.npi!, providerOrganizationName: clinic.name ?? '',
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
      } catch { tally.errors++ }
      await sleep(300)
    }
  }

  return NextResponse.json({ ok: true, ...tally })
}
