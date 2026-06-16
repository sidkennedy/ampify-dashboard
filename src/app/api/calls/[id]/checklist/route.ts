import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateChecklist, type AnswerType } from '@/lib/checklist-generator'
import type { Call, EligibilityOutput } from '@/types'

// Same merge philosophy as the capture route: captured answers win where present,
// the electronic foundation fills the gaps (never wiped).
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

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.')
  let node = target
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {}
    node = node[k] as Record<string, unknown>
  }
  node[keys[keys.length - 1]] = value
}

function coerce(type: AnswerType, raw: string): unknown {
  const s = raw.trim()
  if (s === '') return undefined
  if (type === 'boolean') return /^(yes|true)$/i.test(s) ? true : /^(no|false)$/i.test(s) ? false : undefined
  if (type === 'money' || type === 'percent') {
    const n = Number(s.replace(/[$,%\s]/g, ''))
    return Number.isNaN(n) ? undefined : n
  }
  return s
}

type Action = 'seed' | 'add' | 'save'

/** GET → the checklist for this call (auto-seeds from the generator when empty). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let { data: items } = await supabase
    .from('case_checklist_items').select('*').eq('call_id', id).order('priority').order('sort_order')

  if (!items || items.length === 0) {
    const seeded = await seed(supabase, id, user.id)
    if ('error' in seeded) return NextResponse.json(seeded, { status: 400 })
    items = seeded.items
  }
  return NextResponse.json({ items })
}

/** POST { action } → seed | add | save. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const action = body?.action as Action

    if (action === 'seed') {
      const res = await seed(supabase, id, user.id)
      return 'error' in res ? NextResponse.json(res, { status: 400 }) : NextResponse.json(res)
    }

    if (action === 'add') {
      const { data: call } = await supabase.from('calls').select('clinic_id').eq('id', id).single()
      if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })
      const question = String(body?.question ?? '').trim()
      if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })
      const { data, error } = await supabase.from('case_checklist_items').insert({
        call_id: id,
        clinic_id: call.clinic_id,
        item_key: `custom_${Date.now()}`,
        question,
        answer_type: (body?.answerType as AnswerType) ?? 'text',
        source: 'biller',
        priority: 800, // custom questions sit just before the call-reference items
        created_by: user.id,
      }).select().single()
      if (error) throw new Error(error.message)
      return NextResponse.json({ item: data })
    }

    if (action === 'save') {
      // body.answers: [{ id, answer, status }]
      const answers = (body?.answers ?? []) as { id: string; answer: string; status: 'open' | 'answered' | 'na' }[]
      const markComplete = body?.markComplete === true

      // 1) persist each item's answer + status
      await Promise.all(
        answers.map(a =>
          supabase.from('case_checklist_items').update({ answer: a.answer, status: a.status }).eq('id', a.id),
        ),
      )

      // 2) build an EligibilityOutput patch from answered items that carry a path
      const { data: items } = await supabase
        .from('case_checklist_items').select('*').eq('call_id', id)
      const { data: call } = await supabase
        .from('calls').select('structured_output_eligibility, patient_name, dob, member_id').eq('id', id).single()
      if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

      const byId = new Map(answers.map(a => [a.id, a]))
      const patch: Record<string, unknown> = {}
      for (const it of items ?? []) {
        const a = byId.get(it.id)
        const answerText = a?.answer ?? (it.answer as string | null) ?? ''
        const status = a?.status ?? it.status
        if (status !== 'answered' || !it.eligibility_path) continue
        const value = coerce(it.answer_type as AnswerType, answerText)
        if (value !== undefined) setPath(patch, it.eligibility_path, value)
      }

      const base: EligibilityOutput =
        (call.structured_output_eligibility as EligibilityOutput | null) ??
        { member: { patientName: call.patient_name, dob: call.dob, memberId: call.member_id } }
      const merged = deepMerge(base, patch) as EligibilityOutput

      const update: Record<string, unknown> = { structured_output_eligibility: merged }
      if (markComplete) {
        update.status = 'completed'
        update.ended_at = new Date().toISOString()
      }
      const { error: upErr } = await supabase.from('calls').update(update).eq('id', id)
      if (upErr) throw new Error(upErr.message)

      return NextResponse.json({ ok: true, eligibility: merged })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('Checklist error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

// Generate from the 271 result and upsert without clobbering existing answers.
async function seed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callId: string,
  userId: string,
) {
  const { data: call } = await supabase
    .from('calls')
    .select('verification_type, codes_requested, structured_output_eligibility, clinic_id')
    .eq('id', callId)
    .single()
  if (!call) return { error: 'Call not found' as const }

  const items = generateChecklist(call as unknown as Call)
  const rows = items.map((it, i) => ({
    call_id: callId,
    clinic_id: call.clinic_id,
    item_key: it.itemKey,
    question: it.question,
    rationale: it.rationale ?? null,
    answer_type: it.answerType,
    options: it.options ?? null,
    eligibility_path: it.eligibilityPath ?? null,
    source: it.source,
    priority: it.priority,
    sort_order: i,
    created_by: userId,
  }))

  // ignoreDuplicates so re-seeding preserves already-answered items.
  const { error } = await supabase
    .from('case_checklist_items')
    .upsert(rows, { onConflict: 'call_id,item_key', ignoreDuplicates: true })
  if (error) return { error: error.message }

  const { data: fresh } = await supabase
    .from('case_checklist_items').select('*').eq('call_id', callId).order('priority').order('sort_order')
  return { items: fresh ?? [] }
}
