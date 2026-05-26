import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
          structured_output_eligibility: eligibilityOutput,
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
