import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startVapiCall, toE164 } from '@/lib/vapi'

const DEFAULT_BILLER_PHONE = '+17473898407'

/**
 * Re-fire a call that didn't connect (typically a hybrid transfer that never
 * reached a human). Rebuilds the Vapi call from the stored record and resets the
 * row to in_progress. Hybrid calls re-use the hybrid assistant + biller transfer.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: call, error } = await supabase.from('calls').select('*').eq('id', id).single()
    if (error || !call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

    const isHybrid = call.channel === 'hybrid_call'

    // One hybrid call at a time — block a retry if another is already live for this clinic.
    if (isHybrid) {
      const { data: active } = await supabase
        .from('calls')
        .select('id')
        .eq('clinic_id', call.clinic_id)
        .eq('channel', 'hybrid_call')
        .eq('status', 'in_progress')
        .neq('id', id)
        .limit(1)
      if (active && active.length > 0) {
        return NextResponse.json(
          { error: 'Another hybrid call is already in progress. Finish that one first.' },
          { status: 409 },
        )
      }
    }

    // Biller transfer destination for hybrid.
    let billerPhone = DEFAULT_BILLER_PHONE
    if (isHybrid) {
      const { data: clinicRow } = await supabase
        .from('clinics').select('biller_phone').eq('id', call.clinic_id).single()
      try {
        billerPhone = clinicRow?.biller_phone ? toE164(clinicRow.biller_phone) : DEFAULT_BILLER_PHONE
      } catch { billerPhone = DEFAULT_BILLER_PHONE }
    }

    const { callId: vapiCallId } = await startVapiCall({
      patientName: call.patient_name,
      dob: call.dob,
      memberId: call.member_id,
      providerNPI: call.provider_npi ?? '',
      clinicTaxId: call.clinic_tax_id ?? '',
      clinicName: call.clinic_name ?? '',
      clinicAddress: call.clinic_address ?? '',
      codesRequested: call.codes_requested,
      insurancePhone: call.insurance_phone,
      verificationType: call.verification_type ?? '',
      dateOfService: call.date_of_service ?? '',
      planType: call.plan_type ?? '',
      state: call.state ?? '',
      diagnosisCode: call.diagnosis_code ?? '',
      callbackNumber: call.callback_number ?? '',
      subscriberName: call.subscriber_name ?? '',
      subscriberDob: call.subscriber_dob ?? '',
      callMode: isHybrid ? 'hybrid' : 'autonomous',
      billerPhone,
      target: isHybrid ? 'hybrid' : 'payer',
    })

    await supabase
      .from('calls')
      .update({
        vapi_call_id: vapiCallId, status: 'in_progress',
        started_at: new Date().toISOString(), ended_at: null, ended_reason: null,
      })
      .eq('id', id)

    return NextResponse.json({ vapiCallId, status: 'in_progress' })
  } catch (err: unknown) {
    console.error('Retry call error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to retry call' }, { status: 500 })
  }
}
