'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Stage = 'dialing' | 'working' | 'transferred' | 'failed'
interface ActiveCall {
  id: string
  patientName: string
  dob: string
  memberId: string
  payerName: string
  stage: Stage
  endedReason?: string | null
}

const POLL_MS = 4000
const DISMISS_KEY = 'ampify.hybrid.dismissed'

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]')) } catch { return new Set() }
}
function saveDismissed(s: Set<string>) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...s])) } catch {}
}

// A short two-tone chime so the biller hears "answer your phone" without watching the screen.
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = [880, 1175]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      osc.connect(gain); gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.start(t); osc.stop(t + 0.18)
    })
    setTimeout(() => ctx.close().catch(() => {}), 800)
  } catch {}
}

const STAGE_UI: Record<Stage, { bg: string; border: string; color: string; icon: string; pulse: boolean }> = {
  dialing:     { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8', icon: '☎️', pulse: false },
  working:     { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309', icon: '⏳', pulse: true },
  transferred: { bg: '#F0FDF4', border: '#86EFAC', color: '#15803D', icon: '📞', pulse: true },
  failed:      { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C', icon: '⚠️', pulse: false },
}

export default function HybridCallBanner() {
  const router = useRouter()
  const [call, setCall] = useState<ActiveCall | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())
  const [retrying, setRetrying] = useState(false)
  const prevStage = useRef<Stage | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/hybrid/active', { cache: 'no-store' })
      const data = await res.json()
      setCall(data.call ?? null)
    } catch { /* keep last state */ }
  }, [])

  useEffect(() => {
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => clearInterval(t)
  }, [poll])

  // Chime + a fresh data pull the moment the call reaches the transfer (phone ringing).
  useEffect(() => {
    if (call && call.stage !== prevStage.current) {
      if (call.stage === 'transferred') { playChime(); router.refresh() }
      prevStage.current = call.stage
    }
    if (!call) prevStage.current = null
  }, [call, router])

  if (!call) return null
  const terminal = call.stage === 'transferred' || call.stage === 'failed'
  if (terminal && dismissed.has(`${call.id}:${call.stage}`)) return null

  const ui = STAGE_UI[call.stage]
  const headline: Record<Stage, string> = {
    dialing: `Placing a call to ${call.payerName}…`,
    working: `Reaching a rep at ${call.payerName} — stay by your phone`,
    transferred: `Answer your phone now — connecting you to ${call.payerName}`,
    failed: `The call to ${call.payerName} didn't reach a rep`,
  }
  const sub: Record<Stage, string> = {
    dialing: `Hybrid verification for ${call.patientName}. Your phone will ring once we have a live rep — get ready.`,
    working: `The assistant is navigating their phone system for ${call.patientName}. It'll ring you the moment a human picks up.`,
    transferred: `You're being bridged to ${call.payerName} about ${call.patientName}. Open their page for everything we already know.`,
    failed: `Reason: ${call.endedReason ?? 'unknown'}. You can send the call again.`,
  }

  function dismiss() {
    const next = new Set(dismissed); next.add(`${call!.id}:${call!.stage}`)
    setDismissed(next); saveDismissed(next)
  }

  async function retry() {
    setRetrying(true)
    try {
      const res = await fetch(`/api/calls/${call!.id}/retry`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Retry failed'); return }
      const next = new Set(dismissed); next.add(`${call!.id}:failed`)
      setDismissed(next); saveDismissed(next)
      prevStage.current = null
      poll()
    } finally { setRetrying(false) }
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        background: ui.bg, border: `1px solid ${ui.border}`, borderRadius: '0.75rem',
        padding: '0.875rem 1.25rem', marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <span
        aria-hidden
        style={{ fontSize: '1.5rem', lineHeight: 1, animation: ui.pulse ? 'ampifyPulse 1.2s ease-in-out infinite' : 'none' }}
      >{ui.icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: ui.color, margin: 0 }}>{headline[call.stage]}</p>
        <p style={{ fontSize: '0.8125rem', color: '#4B5563', margin: '0.125rem 0 0' }}>{sub[call.stage]}</p>
      </div>

      {/* Patient chip — the identity the whisper can't speak */}
      <Link
        href={`/calls/${call.id}`}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textDecoration: 'none',
          padding: '0.375rem 0.75rem', borderRadius: '0.5rem', background: '#FFFFFF',
          border: '1px solid #E5E7EB', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0D1117' }}>{call.patientName}</span>
        <span style={{ fontSize: '0.6875rem', color: '#6B7280' }}>DOB {call.dob} · open page →</span>
      </Link>

      {call.stage === 'failed' && (
        <button
          onClick={retry}
          disabled={retrying}
          style={{
            padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: 'none',
            background: '#B91C1C', color: '#fff', fontWeight: 600, fontSize: '0.8125rem',
            cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.6 : 1,
          }}
        >{retrying ? 'Sending…' : 'Retry call'}</button>
      )}

      {terminal && (
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{ background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.25rem' }}
        >×</button>
      )}

      <style>{`@keyframes ampifyPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.18); opacity: 0.7; } }`}</style>
    </div>
  )
}
