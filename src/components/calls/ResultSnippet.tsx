import { Call } from '@/types'

// A one-line "what's the answer" summary for a verification, for list/table views.
export default function ResultSnippet({ call }: { call: Call }) {
  const base = { fontSize: '0.8125rem', fontWeight: 600 } as const

  if (call.status === 'in_progress') return <span style={{ ...base, color: '#2563EB' }}>In progress…</span>
  if (call.status === 'scheduled') return <span style={{ ...base, color: '#CA8A04', fontWeight: 500 }}>Scheduled</span>
  if (call.status === 'queued') return <span style={{ color: '#9CA3AF', fontSize: '0.8125rem' }}>Pending</span>
  if (call.status === 'failed') return <span style={{ ...base, color: '#DC2626' }}>Failed</span>

  const elig = call.structured_output_eligibility
  const oc = elig?.outcome
  if (oc?.status === 'redirected') return <span style={{ ...base, color: '#7C3AED' }}>↪ Verify elsewhere</span>
  if (oc?.status === 'not_covered') return <span style={{ ...base, color: '#DC2626' }}>Not covered · self-pay</span>
  if (oc?.status === 'needs_callback' || oc?.status === 'incomplete') return <span style={{ ...base, color: '#B45309' }}>Needs follow-up</span>

  const st = elig?.member?.eligibilityStatus
  if (st && /active|eligible/i.test(st)) {
    const rem = elig?.benefits?.deductible?.individualRemaining
    const copay = elig?.benefits?.copays?.audiologyVisit
    const extra = rem != null ? `· $${rem.toLocaleString()} ded left` : (copay != null ? `· $${copay} copay` : '')
    return <span style={{ ...base, color: '#15803D' }}>Active {extra}</span>
  }
  return <span style={{ color: '#9CA3AF', fontSize: '0.8125rem' }}>—</span>
}
