import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Deep-merge a call's extracted output OVER the electronic foundation already
// saved on the record: call values win where present; foundation fills the gaps
// (so a follow-up call never wipes the deductible/OOP captured electronically).
function deepMerge(base: unknown, incoming: unknown): unknown {
  if (incoming == null) return base
  if (Array.isArray(incoming) || typeof incoming !== 'object') {
    if (incoming === '' || (Array.isArray(incoming) && incoming.length === 0)) return base
    return incoming
  }
  if (base == null || typeof base !== 'object') return incoming
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const k of Object.keys(incoming as Record<string, unknown>)) {
    out[k] = deepMerge((base as Record<string, unknown>)[k], (incoming as Record<string, unknown>)[k])
  }
  return out
}

export async function POST(req: NextRequest) {
  // Use service role for webhook (no user session)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const body = await req.json()
    const { message } = body

    if (!message) return NextResponse.json({ ok: true })

    const { type, call } = message
    if (!call?.id) return NextResponse.json({ ok: true })

    const vapiCallId = call.id

    if (type === 'status-update' && call.status === 'in-progress') {
      await supabase
        .from('calls')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('vapi_call_id', vapiCallId)
    }

    if (type === 'end-of-call-report') {
      const artifact = message.artifact ?? {}
      const analysis = message.analysis ?? {}

      // Extract structured outputs from analysis
      const structuredData = analysis.structuredData ?? {}
      let eligibilityOutput = null
      let codesOutput = null

      // VAPI returns structured outputs keyed by their schema names
      if (structuredData['Audiology Eligibility & Benefits']) {
        eligibilityOutput = structuredData['Audiology Eligibility & Benefits']
      }
      if (structuredData['Code-by-Code Benefits']) {
        codesOutput = structuredData['Code-by-Code Benefits']
      }

      // Calculate duration
      const startedAt = call.startedAt ? new Date(call.startedAt) : null
      const endedAt = call.endedAt ? new Date(call.endedAt) : null
      const durationSeconds = startedAt && endedAt
        ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
        : null

      const status = call.endedReason === 'error' || call.endedReason === 'pipeline-error'
        ? 'failed'
        : 'completed'

      // Merge the call result over any electronic foundation already on the record
      // (don't let a follow-up call wipe electronically-captured benefits).
      const { data: existing } = await supabase
        .from('calls')
        .select('structured_output_eligibility, verification_type, clinic_id')
        .eq('vapi_call_id', vapiCallId)
        .single()
      const mergedEligibility = eligibilityOutput
        ? deepMerge(existing?.structured_output_eligibility ?? null, eligibilityOutput)
        : (existing?.structured_output_eligibility ?? null)

      // Hearing-aid calls: turn what the payer said into a clear disposition —
      // carved out (+ not contracted) → self-pay; covered directly → bill the payer.
      if (existing?.verification_type === 'hearing_aid' && mergedEligibility && typeof mergedEligibility === 'object') {
        const elig = mergedEligibility as Record<string, unknown>
        const ha = ((elig.benefits as Record<string, unknown>)?.hearingAidBenefit ?? {}) as Record<string, unknown>
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
        const { data: clinicRow } = await supabase.from('clinics').select('vendor_contracts').eq('id', existing.clinic_id).single()
        const contracts = ((clinicRow?.vendor_contracts as string[] | null) ?? []).map(norm)
        const vendor = (ha.vendorRestriction as string) || ''
        const carvedOut = !!vendor
        const contracted = carvedOut && contracts.includes(norm(vendor))
        const allowance = ha.allowanceAmount as number | null | undefined
        if (carvedOut && !contracted) {
          elig.outcome = { status: 'redirected', nextAction: 'Hearing aids are self-pay through your office.', redirectReason: `The plan carves the hearing-aid benefit out to ${vendor}, which you're not contracted with.`, redirectPhone: null }
        } else if (carvedOut && contracted) {
          elig.outcome = { status: 'benefits_captured', nextAction: `Bill the hearing-aid benefit through ${vendor} (you're contracted).` }
        } else if (ha.covered === true || allowance != null) {
          elig.outcome = { status: 'benefits_captured', nextAction: allowance != null ? `Covered directly — bill the payer (allowance $${allowance}).` : 'Hearing-aid benefit covered directly — bill the payer.' }
        } else if (ha.covered === false) {
          elig.outcome = { status: 'not_covered', nextAction: 'No hearing-aid benefit on this plan — self-pay.' }
        }
      }

      await supabase
        .from('calls')
        .update({
          status,
          ended_at: call.endedAt ?? new Date().toISOString(),
          ended_reason: call.endedReason ?? null,
          transcript: artifact.transcript ?? null,
          recording_url: artifact.recordingUrl ?? null,
          duration_seconds: durationSeconds,
          cost: message.cost ?? null,
          structured_output_eligibility: mergedEligibility,
          structured_output_codes: codesOutput,
        })
        .eq('vapi_call_id', vapiCallId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
