import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clinicHasFeature } from '@/lib/features'
import { pollEraTransactions, fetchEra, parseEraPayments } from '@/lib/era'

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('clinic_id, clinics(features)').eq('id', user.id).single()
    const clinicId = profile?.clinic_id
    const clinic = profile?.clinics as unknown as { features?: Record<string, boolean> | null } | null
    if (!clinicId) return NextResponse.json({ error: 'No clinic on your account.' }, { status: 400 })
    if (!clinicHasFeature(clinic, 'era')) return NextResponse.json({ error: 'Remittance / ERA is not enabled for this clinic.' }, { status: 403 })

    // Pull available 835 reports and flatten to per-claim payments.
    const txIds = await pollEraTransactions()
    const payments = (await Promise.all(txIds.map(async id => parseEraPayments(await fetchEra(id))))).flat()

    // Match each payment to one of THIS clinic's claims by patient control number, and post it.
    let matched = 0
    for (const p of payments) {
      if (!p.patientControlNumber) continue
      const { data: claim } = await supabase
        .from('claims')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('claim_control_number', p.patientControlNumber)
        .maybeSingle()
      if (!claim) continue
      const wasDenied = (!p.paidAmount || p.paidAmount === 0) && p.adjustmentReasons.length > 0
      const detailBits = [
        p.patientResponsibility != null ? `Patient resp. $${p.patientResponsibility}` : null,
        ...p.adjustmentReasons,
      ].filter(Boolean)
      await supabase.from('claims').update({
        status: wasDenied ? 'denied' : 'paid',
        paid_amount: p.paidAmount,
        payer_claim_number: p.payerClaimNumber,
        status_detail: detailBits.length ? detailBits.join(' · ') : 'Remittance posted',
        last_checked_at: new Date().toISOString(),
      }).eq('id', claim.id)
      matched++
    }

    return NextResponse.json({ erasFound: txIds.length, paymentsPosted: matched })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Remittance sync failed' }, { status: 500 })
  }
}
