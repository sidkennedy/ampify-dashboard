'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  callId: string
  payerName: string | null
  mode: 'hybrid' | 'autonomous'
  callable: boolean
}

export default function CallInsuranceButton({ callId, payerName, mode, callable }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'confirm' | 'calling' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!callable) return null

  const who = payerName ?? 'the insurance company'
  const modeBlurb = mode === 'hybrid'
    ? 'No-bot payer → hybrid: the assistant reaches a live rep, then your phone rings.'
    : 'Bot-friendly payer → automated: the assistant completes the call itself.'

  async function place() {
    setState('calling'); setError(null)
    try {
      const res = await fetch(`/api/calls/${callId}/call`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to place call'); setState('error'); return }
      // The live banner takes over from here; refresh so the page reflects in-progress.
      router.refresh()
      setState('idle')
    } catch { setError('Network error — please try again'); setState('error') }
  }

  if (state === 'confirm') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', maxWidth: 320 }}>
        <p style={{ fontSize: '0.75rem', color: '#4B5563', margin: 0, textAlign: 'right' }}>
          Place a <strong>real call</strong> to {who} for this patient now? {modeBlurb}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setState('idle')} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>Cancel</button>
          <button onClick={place} className="btn-primary" style={{ fontSize: '0.8125rem' }}>
            {mode === 'hybrid' ? '📞 Call & transfer to me' : '📞 Start automated call'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
      <button
        onClick={() => setState('confirm')}
        disabled={state === 'calling'}
        className="btn-secondary"
        style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        {state === 'calling' ? 'Starting…' : 'Call insurance'}
      </button>
      {state === 'error' && error && <p style={{ color: '#DC2626', fontSize: '0.75rem', margin: 0 }}>{error}</p>}
    </div>
  )
}
