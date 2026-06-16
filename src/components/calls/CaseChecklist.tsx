'use client'

// Dynamic version of GapCapture: renders the generated "bulletproof script" as a
// structured checklist. The clinic biller can add custom questions before the call;
// the VA fills answers during it; answers with an eligibility_path write straight
// back into structured_output_eligibility on save.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { renderScript, type AnswerType, type ChecklistItem } from '@/lib/checklist-generator'
import type { Call } from '@/types'

interface Item {
  id: string
  item_key: string
  question: string
  rationale: string | null
  answer_type: AnswerType
  options: string[] | null
  eligibility_path: string | null
  source: 'generated' | 'biller' | 'va'
  priority: number
  answer: string | null
  status: 'open' | 'answered' | 'na'
}

const input: React.CSSProperties = { width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#0D1117', background: '#fff' }
const tag = (s: Item['source']): React.CSSProperties => ({
  fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
  padding: '0.0625rem 0.375rem', borderRadius: '0.375rem',
  background: s === 'biller' ? '#FEF3C7' : s === 'va' ? '#E0E7FF' : '#F3F4F6',
  color: s === 'biller' ? '#92400E' : s === 'va' ? '#3730A3' : '#6B7280',
})

export default function CaseChecklist({ call }: { call: Call }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // new-question composer
  const [newQ, setNewQ] = useState('')
  const [newType, setNewType] = useState<AnswerType>('text')

  useEffect(() => {
    fetch(`/api/calls/${call.id}/checklist`)
      .then(r => r.json())
      .then(d => { if (d.items) setItems(d.items) })
      .catch(() => setError('Could not load checklist'))
      .finally(() => setLoading(false))
  }, [call.id])

  function patchLocal(id: string, patch: Partial<Item>) {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }

  function setAnswer(id: string, answer: string) {
    patchLocal(id, { answer, status: answer.trim() ? 'answered' : 'open' })
  }
  function toggleNA(it: Item) {
    patchLocal(it.id, { status: it.status === 'na' ? 'open' : 'na' })
  }

  async function addQuestion() {
    const question = newQ.trim()
    if (!question) return
    const res = await fetch(`/api/calls/${call.id}/checklist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', question, answerType: newType }),
    })
    const d = await res.json()
    if (d.item) { setItems(prev => [...prev, d.item]); setNewQ('') }
  }

  async function regenerate() {
    const res = await fetch(`/api/calls/${call.id}/checklist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed' }),
    })
    const d = await res.json()
    if (d.items) setItems(d.items)
  }

  async function save(markComplete: boolean) {
    setSaving(true); setError(null)
    const answers = items.map(it => ({ id: it.id, answer: it.answer ?? '', status: it.status }))
    try {
      const res = await fetch(`/api/calls/${call.id}/checklist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', answers, markComplete }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Save failed'); return }
      router.refresh()
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  function copyScript() {
    const asChecklist: ChecklistItem[] = items.map(it => ({
      itemKey: it.item_key, question: it.question, answerType: it.answer_type,
      eligibilityPath: it.eligibility_path ?? undefined, priority: it.priority, source: it.source,
    }))
    navigator.clipboard.writeText(renderScript(call, asChecklist)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return <div className="card" style={{ padding: '1.25rem', marginTop: '1.5rem', color: '#6B7280', fontSize: '0.875rem' }}>Loading call script…</div>

  const answered = items.filter(i => i.status === 'answered').length
  const actionable = items.filter(i => i.status !== 'na').length

  return (
    <div className="card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0D1117', margin: 0 }}>Call script &amp; capture</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={copyScript} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>{copied ? '✓ Copied' : 'Copy script'}</button>
          <button onClick={regenerate} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>Regenerate</button>
        </div>
      </div>
      <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: '0 0 1rem' }}>
        Only the questions the electronic check <em>couldn&apos;t</em> answer are listed — ask these on the call. {answered}/{actionable} captured.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((it, n) => {
          const na = it.status === 'na'
          return (
            <div key={it.id} style={{ border: '1px solid #E5E7EB', borderRadius: '0.625rem', padding: '0.75rem 0.875rem', opacity: na ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0D1117' }}>{n + 1}. {it.question}</span>
                    <span style={tag(it.source)}>{it.source}</span>
                  </div>
                  {it.rationale && <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0 0 0.5rem' }}>{it.rationale}</p>}
                </div>
                <button onClick={() => toggleNA(it)} className="btn-secondary" style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem' }}>
                  {na ? 'Undo N/A' : 'N/A'}
                </button>
              </div>

              {!na && (
                it.answer_type === 'boolean' ? (
                  <select style={input} value={it.answer ?? ''} onChange={e => setAnswer(it.id, e.target.value)}>
                    <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                ) : it.answer_type === 'select' ? (
                  <select style={input} value={it.answer ?? ''} onChange={e => setAnswer(it.id, e.target.value)}>
                    <option value="">—</option>
                    {(it.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    style={input}
                    inputMode={it.answer_type === 'money' || it.answer_type === 'percent' ? 'numeric' : 'text'}
                    placeholder={it.answer_type === 'money' ? '$ amount' : it.answer_type === 'percent' ? '%' : 'rep’s answer'}
                    value={it.answer ?? ''}
                    onChange={e => setAnswer(it.id, e.target.value)}
                  />
                )
              )}
            </div>
          )
        })}
      </div>

      {/* Add a custom question (clinic biller) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px dashed #E5E7EB' }}>
        <input style={{ ...input, flex: 1 }} placeholder="＋ Add a question for the rep…" value={newQ}
          onChange={e => setNewQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addQuestion() } }} />
        <select style={{ ...input, width: 'auto' }} value={newType} onChange={e => setNewType(e.target.value as AnswerType)}>
          <option value="text">Text</option><option value="boolean">Yes/No</option>
          <option value="money">$</option><option value="percent">%</option><option value="frequency">Frequency</option>
        </select>
        <button onClick={() => void addQuestion()} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>Add</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginTop: '1rem' }}>
        <button onClick={() => void save(true)} disabled={saving} className="btn-primary" style={{ fontSize: '0.875rem' }}>
          {saving ? 'Saving…' : 'Save & complete'}
        </button>
        <button onClick={() => void save(false)} disabled={saving} className="btn-secondary" style={{ fontSize: '0.875rem' }}>
          Save progress
        </button>
        {error && <span style={{ color: '#DC2626', fontSize: '0.8125rem' }}>{error}</span>}
      </div>
    </div>
  )
}
