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

const STAGE_UI: Record<Stage, { accent: string; bg: string; icon: string; label: string; pulse: boolean }> = {
  dialing:     { accent: '#1D4ED8', bg: '#EFF6FF', icon: '☎️', label: 'AI CALL STARTING', pulse: false },
  working:     { accent: '#B45309', bg: '#FFFBEB', icon: '🤖', label: 'AI CALL IN PROGRESS', pulse: true },
  transferred: { accent: '#15803D', bg: '#F0FDF4', icon: '📞', label: 'CONNECTING YOU NOW', pulse: true },
  failed:      { accent: '#B91C1C', bg: '#FEF2F2', icon: '⚠️', label: 'CALL ERROR', pulse: false },
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
  const message: Record<Stage, string> = {
    dialing: `Placing the call to ${call.payerName}…`,
    working: `Reaching a live rep at ${call.payerName}`,
    transferred: 'Answer your phone now',
    failed: "The call didn't go through",
  }
  const sub: Record<Stage, string> = {
    dialing: "We'll connect you the moment a rep picks up — stay nearby.",
    working: "We'll connect you shortly — your phone will ring when a human answers.",
    transferred: `You're being connected to ${call.payerName}.`,
    failed: `${call.endedReason ?? 'unknown error'} — open the file to try again.`,
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
        position: 'fixed', top: '1rem', right: '1.25rem', zIndex: 60, width: 340, maxWidth: 'calc(100vw - 2rem)',
        background: '#FFFFFF', borderRadius: '0.875rem',
        border: `1px solid ${ui.accent}33`, borderTop: `3px solid ${ui.accent}`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.14)', overflow: 'hidden',
        animation: 'ampifySlideIn 0.25s ease-out',
      }}
      role="status"
      aria-live="polite"
    >
      {/* Header strip: live label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: ui.bg }}>
        <span aria-hidden style={{ fontSize: '1.125rem', animation: ui.pulse ? 'ampifyPulse 1.2s ease-in-out infinite' : 'none' }}>{ui.icon}</span>
        <span style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.06em', color: ui.accent }}>{ui.label}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: ui.accent, animation: 'ampifyBlink 1.1s ease-in-out infinite' }} />
        </span>
        {terminal && (
          <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: 0, marginLeft: '0.25rem' }}>×</button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '0.75rem 0.875rem 0.875rem' }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, color: ui.accent, margin: '0 0 0.125rem' }}>{message[call.stage]}</p>
        <p style={{ fontSize: '0.8125rem', color: '#4B5563', margin: '0 0 0.625rem' }}>{sub[call.stage]}</p>

        {/* Patient identity — what the whisper can't speak */}
        <Link
          href={`/calls/${call.id}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
            textDecoration: 'none', padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
            background: '#F9FAFB', border: '1px solid #E5E7EB',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#0D1117', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{call.patientName}</span>
            <span style={{ fontSize: '0.6875rem', color: '#6B7280' }}>DOB {call.dob}</span>
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ui.accent, whiteSpace: 'nowrap' }}>Open file →</span>
        </Link>

        {call.stage === 'failed' && (
          <button
            onClick={retry}
            disabled={retrying}
            style={{
              marginTop: '0.625rem', width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: 'none',
              background: '#B91C1C', color: '#fff', fontWeight: 600, fontSize: '0.8125rem',
              cursor: retrying ? 'not-allowed' : 'pointer', opacity: retrying ? 0.6 : 1,
            }}
          >{retrying ? 'Sending…' : 'Retry call'}</button>
        )}
      </div>

      <style>{`
        @keyframes ampifyPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.18); opacity: 0.7; } }
        @keyframes ampifyBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes ampifySlideIn { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
