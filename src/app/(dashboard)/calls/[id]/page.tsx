import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import StatusBadge from '@/components/calls/StatusBadge'
import ChannelBadge from '@/components/calls/ChannelBadge'
import CallDetailTabs from './CallDetailTabs'
import FireCallButton from './FireCallButton'
import CaseChecklist from '@/components/calls/CaseChecklist'
import CaseChat from '@/components/cases/CaseChat'
import CallInsuranceButton from '@/components/calls/CallInsuranceButton'
import Link from 'next/link'
import { clinicHasFeature } from '@/lib/features'
import { getPayerByPhone } from '@/lib/payer-registry'
import { isInsuranceOpen, getNextOpenTime } from '@/lib/insurance-hours'

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: call }, { data: { user } }] = await Promise.all([
    supabase.from('calls').select('*').eq('id', id).single(),
    supabase.auth.getUser(),
  ])

  if (!call) notFound()

  // Manual "Call insurance" routing: resolve payer + mode from the stored dial number (no Stedi).
  const callPayer = getPayerByPhone(call.insurance_phone)
  const callable = !!call.insurance_phone && call.insurance_phone !== 'electronic'
  const manualCallMode: 'hybrid' | 'autonomous' = callPayer?.acceptsBots ? 'autonomous' : 'hybrid'
  const isInProgress = call.status === 'in_progress'

  // Two-part flow: electronic ran; a call is RECOMMENDED (not auto-fired) when the
  // channel is a call channel and no call has been placed yet.
  const callPlaced = !!call.vapi_call_id
  const callRecommended = (call.channel === 'hybrid_call' || call.channel === 'autonomous_call')
    && !callPlaced && !isInProgress && call.status !== 'failed'
  const linesOpen = isInsuranceOpen()
  const nextOpen = linesOpen ? null : getNextOpenTime()
  const recReason = call.verification_type === 'hearing_aid'
    ? 'to confirm whether the hearing-aid benefit is carved out to a third party (→ self-pay) or covered directly (→ bill the payer & capture the allowance)'
    : (['abr', 'apd', 'vestibular'].includes(call.verification_type ?? '')
        ? 'to confirm procedure-specific coverage and any prior-auth requirement'
        : 'to complete the verification')

  let isSuperAdmin = false
  let canCreateClaim = false
  let viewerRole: 'staff' | 'admin' | 'superadmin' = 'staff'
  let viewerName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, clinics(features)')
      .eq('id', user.id)
      .single()
    isSuperAdmin = profile?.role === 'superadmin'
    viewerRole = (profile?.role as 'staff' | 'admin' | 'superadmin') ?? 'staff'
    viewerName = profile?.full_name ?? null
    const clinic = profile?.clinics as unknown as { features?: Record<string, boolean> | null } | null
    canCreateClaim = clinicHasFeature(clinic, 'claims') || clinicHasFeature(clinic, 'claim_status')
  }

  return (
    <div>
      {/* Back + header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/calls" style={{ color: '#6B7280', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          Back to calls
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117' }}>{call.patient_name}</h1>
              <StatusBadge status={call.status} />
              <ChannelBadge channel={call.channel} />
            </div>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              DOB: {call.dob} · Member ID: {call.member_id} · {format(new Date(call.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!isInProgress && (
              <CallInsuranceButton callId={call.id} payerName={callPayer?.name ?? null} mode={manualCallMode} callable={callable} />
            )}
            {canCreateClaim && (
              <Link href={`/claims?from=${call.id}`} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                Create claim
              </Link>
            )}
            {isSuperAdmin && call.status === 'queued' && (
              <FireCallButton callId={call.id} />
            )}
            {call.recording_url && (
              <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: '0.8125rem' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Play Recording
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Two-part flow recommendation: electronic done → does the biller need a call? */}
      {callRecommended && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <span aria-hidden style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>📞</span>
          <div>
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1D4ED8', margin: '0 0 0.125rem' }}>
              Call recommended — {callPayer?.name ?? 'the insurance company'}
              {manualCallMode === 'hybrid' ? ' (hybrid — your phone will ring)' : ' (automated)'}
            </p>
            <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0 }}>
              The electronic check captured the foundation below. A call is recommended {recReason}. Use <strong>Call insurance</strong> (top-right) when you&apos;re ready.
            </p>
            {!linesOpen && (
              <p style={{ fontSize: '0.8125rem', color: '#B45309', fontWeight: 600, margin: '0.5rem 0 0' }}>
                ⏰ Insurance phone lines look closed right now — they reopen {nextOpen ? format(nextOpen, 'EEE h:mm a') + ' ET' : 'during business hours'}. A call placed now will likely reach a closed line.
              </p>
            )}
          </div>
        </div>
      )}
      {call.channel === 'electronic' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', marginBottom: '1.5rem' }}>
          <span aria-hidden>✅</span>
          <span style={{ fontSize: '0.875rem', color: '#15803D', fontWeight: 500 }}>Verified electronically — no call needed.</span>
        </div>
      )}

      {/* Persistent error state — a failed call must never look like it's still working. */}
      {call.status === 'failed' && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <span aria-hidden style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>⚠️</span>
          <div>
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#B91C1C', margin: '0 0 0.125rem' }}>This call didn&apos;t go through</p>
            <p style={{ fontSize: '0.8125rem', color: '#7F1D1D', margin: 0 }}>
              Error: <code style={{ background: '#FEE2E2', padding: '0.0625rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.78125rem' }}>{call.ended_reason ?? 'unknown error'}</code>
              {' '}— use <strong>Call insurance</strong> above to try again.
            </p>
          </div>
        </div>
      )}

      {/* Channel-aware, biller-first result view (hero + cost summary + details) */}
      <CallDetailTabs call={call} />

      {/* Human-call channels: generated script + structured capture, over the electronic foundation. */}
      {(call.channel === 'hybrid_call' || call.channel === 'needs_setup') && (
        <CaseChecklist call={call} />
      )}

      {/* Per-case chat between the clinic biller and the Ampify VA. */}
      {user && (call.channel === 'hybrid_call' || call.channel === 'needs_setup') && (
        <div style={{ marginTop: '1.5rem' }}>
          <CaseChat callId={call.id} clinicId={call.clinic_id} viewer={{ id: user.id, role: viewerRole, fullName: viewerName }} />
        </div>
      )}
    </div>
  )
}
