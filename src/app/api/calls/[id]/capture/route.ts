import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EligibilityOutput } from '@/types'

// Same merge philosophy as the Vapi webhook: the biller's call values win where
// present; the electronic foundation fills the gaps (never wiped).
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

/**
 * Save what the biller captured on a (hybrid / manual) call. Body: { patch, markComplete? }
 * where `patch` is a partial EligibilityOutput. Merged over the electronic foundation.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const patch = (body?.patch ?? {}) as Partial<EligibilityOutput>
    const markComplete = body?.markComplete !== false // default true

    const { data: call, error } = await supabase
      .from('calls').select('structured_output_eligibility, patient_name, dob, member_id').eq('id', id).single()
    if (error || !call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

    const base: EligibilityOutput = (call.structured_output_eligibility as EligibilityOutput | null) ?? {
      member: { patientName: call.patient_name, dob: call.dob, memberId: call.member_id },
    }
    const merged = deepMerge(base, patch) as EligibilityOutput

    const update: Record<string, unknown> = { structured_output_eligibility: merged }
    if (markComplete) {
      update.status = 'completed'
      update.ended_at = new Date().toISOString()
    }

    const { error: upErr } = await supabase.from('calls').update(update).eq('id', id)
    if (upErr) throw new Error(upErr.message)

    return NextResponse.json({ ok: true, eligibility: merged })
  } catch (err: unknown) {
    console.error('Capture error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save' }, { status: 500 })
  }
}
