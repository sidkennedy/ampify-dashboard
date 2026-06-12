import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getVapiCall } from '@/lib/vapi'
import { getPayerByPhone } from '@/lib/payer-registry'

export const dynamic = 'force-dynamic'

// Live stage of the in-flight hybrid call, for the biller's cockpit banner.
//  dialing     → call placed / ringing the payer
//  working     → AI is navigating the IVR, on hold, reaching a rep
//  transferred → AI reached a human and bridged to the biller → THEIR PHONE IS RINGING
//  failed      → call ended without a successful transfer → offer retry
export type HybridStage = 'dialing' | 'working' | 'transferred' | 'failed'

/**
 * Returns the single most-recent hybrid call (last 15 min) for the caller's clinic,
 * with its live stage. We poll Vapi server-side so the banner works even on localhost
 * (where Vapi webhooks can't reach us). Once a call is terminal we persist it and stop
 * polling Vapi on subsequent requests.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ call: null })

    const { data: profile } = await supabase
      .from('profiles').select('clinic_id, role').eq('id', user.id).single()
    const scopeToClinic = profile?.clinic_id && profile.role !== 'superadmin'

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    let q = supabase
      .from('calls')
      .select('id, patient_name, dob, member_id, insurance_phone, vapi_call_id, status, channel, ended_reason, created_at')
      .eq('channel', 'hybrid_call')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
    if (scopeToClinic) q = q.eq('clinic_id', profile!.clinic_id)
    const { data: rows } = await q
    const call = rows?.[0]
    if (!call) return NextResponse.json({ call: null })

    let stage: HybridStage = 'dialing'

    // Already terminal in our DB — don't re-poll Vapi.
    if (call.status === 'completed' && call.ended_reason === 'assistant-forwarded-call') {
      stage = 'transferred'
    } else if (call.status === 'failed') {
      stage = 'failed'
    } else if (call.vapi_call_id) {
      // Live — ask Vapi where the call actually is.
      try {
        const v = await getVapiCall(call.vapi_call_id)
        const vs: string = v.status
        const reason: string | undefined = v.endedReason
        if (vs === 'ended') {
          if (reason === 'assistant-forwarded-call') {
            stage = 'transferred'
            await supabase.from('calls').update({
              status: 'completed', ended_reason: reason,
              ended_at: v.endedAt ?? new Date().toISOString(), cost: v.cost ?? null,
            }).eq('id', call.id)
          } else {
            stage = 'failed'
            await supabase.from('calls').update({
              status: 'failed', ended_reason: reason ?? 'unknown',
              ended_at: v.endedAt ?? new Date().toISOString(), cost: v.cost ?? null,
            }).eq('id', call.id)
          }
        } else if (vs === 'queued' || vs === 'ringing') {
          stage = 'dialing'
        } else {
          stage = 'working' // in-progress: IVR / hold / reaching a rep
        }
      } catch {
        // Vapi unreachable — assume still working rather than failing the banner.
        stage = 'working'
      }
    } else if (call.status === 'queued') {
      stage = 'dialing'
    }

    const payerName = getPayerByPhone(call.insurance_phone)?.name ?? 'the insurance company'
    return NextResponse.json({
      call: {
        id: call.id,
        patientName: call.patient_name,
        dob: call.dob,
        memberId: call.member_id,
        payerName,
        stage,
        endedReason: call.ended_reason ?? null,
      },
    })
  } catch {
    return NextResponse.json({ call: null })
  }
}
