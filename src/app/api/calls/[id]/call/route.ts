import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startVapiCall, toE164 } from '@/lib/vapi'
import { getPayerByPhone } from '@/lib/payer-registry'

const DEFAULT_BILLER_PHONE = '+17473898407'

/**
 * Manually place a call for an EXISTING verification using its stored data — no
 * Stedi check. Routes by the payer's bot policy: bot-friendly → autonomous AI;
 * no-bot → hybrid (AI reaches a rep, transfers to the biller). Useful as a biller
 * fallback (dropped call, incomplete electronic data) and for testing.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: call, error } = await supabase.from('calls').select('*').eq('id', id).single()
    if (error || !call) return NextResponse.json({ error: 'Verification not found' }, { status: 404 })

    const dialNumber: string = call.insurance_phone
    if (!dialNumber || dialNumber === 'electronic') {
      return NextResponse.json({ error: 'No payer phone number on this verification to call.' }, { status: 400 })
    }

    // Route by the payer's bot policy. Unknown payer → treat as no-bot (hybrid is the safe default).
    const payer = getPayerByPhone(dialNumber)
    const acceptsBots = payer?.acceptsBots ?? false
    const isHybrid = !acceptsBots
    const channel = isHybrid ? 'hybrid_call' : 'autonomous_call'
    const target = isHybrid ? 'hybrid' : 'payer'
    const mode = isHybrid ? 'hybrid' : 'autonomous'

    // One hybrid call at a time per clinic — the biller can only answer one.
    if (isHybrid) {
      const { data: active } = await supabase
        .from('calls').select('id, patient_name')
        .eq('clinic_id', call.clinic_id).eq('channel', 'hybrid_call').eq('status', 'in_progress')
        .neq('id', id).limit(1)
      if (active && active.length > 0) {
        return NextResponse.json(
          { error: `A hybrid call for ${active[0].patient_name} is already in progress. Finish that one first.` },
          { status: 409 },
        )
      }
    }

    // Biller transfer destination (hybrid only).
    let billerPhone = DEFAULT_BILLER_PHONE
    if (isHybrid) {
      const { data: clinicRow } = await supabase
        .from('clinics').select('biller_phone').eq('id', call.clinic_id).single()
      try { billerPhone = clinicRow?.biller_phone ? toE164(clinicRow.biller_phone) : DEFAULT_BILLER_PHONE }
      catch { billerPhone = DEFAULT_BILLER_PHONE }
    }

    let vapiCallId: string
    try {
      ({ callId: vapiCallId } = await startVapiCall({
        patientName: call.patient_name,
        dob: call.dob,
        memberId: call.member_id,
        providerNPI: call.provider_npi ?? '',
        clinicTaxId: call.clinic_tax_id ?? '',
        clinicName: call.clinic_name ?? '',
        clinicAddress: call.clinic_address ?? '',
        codesRequested: call.codes_requested,
        insurancePhone: dialNumber,
        verificationType: call.verification_type ?? '',
        dateOfService: call.date_of_service ?? '',
        planType: call.plan_type ?? '',
        state: call.state ?? '',
        diagnosisCode: call.diagnosis_code ?? '',
        callbackNumber: call.callback_number ?? '',
        subscriberName: call.subscriber_name ?? '',
        subscriberDob: call.subscriber_dob ?? '',
        callMode: mode,
        billerPhone,
        target,
      }))
    } catch (e) {
      // The call never started — record it as failed (with the reason) so the
      // dashboard never shows a phantom "in progress" that will never ring.
      const reason = e instanceof Error ? e.message : 'call failed to start'
      await supabase.from('calls').update({
        status: 'failed', channel, ended_reason: reason, ended_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ error: reason, status: 'failed' }, { status: 502 })
    }

    await supabase
      .from('calls')
      .update({
        vapi_call_id: vapiCallId, status: 'in_progress', channel,
        started_at: new Date().toISOString(), ended_at: null, ended_reason: null,
      })
      .eq('id', id)

    return NextResponse.json({
      vapiCallId, status: 'in_progress', channel, mode,
      payerName: payer?.name ?? 'the insurance company',
    })
  } catch (err: unknown) {
    console.error('Manual call error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to place call' }, { status: 500 })
  }
}
