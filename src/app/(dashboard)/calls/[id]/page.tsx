import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import StatusBadge from '@/components/calls/StatusBadge'
import ChannelBadge from '@/components/calls/ChannelBadge'
import CallDetailTabs from './CallDetailTabs'
import FireCallButton from './FireCallButton'
import GapCapture from '@/components/calls/GapCapture'
import Link from 'next/link'
import { clinicHasFeature } from '@/lib/features'

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: call }, { data: { user } }] = await Promise.all([
    supabase.from('calls').select('*').eq('id', id).single(),
    supabase.auth.getUser(),
  ])

  if (!call) notFound()

  let isSuperAdmin = false
  let canCreateClaim = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, clinics(features)')
      .eq('id', user.id)
      .single()
    isSuperAdmin = profile?.role === 'superadmin'
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

      {/* Channel-aware, biller-first result view (hero + cost summary + details) */}
      <CallDetailTabs call={call} />

      {/* Human-call channels: the biller logs what the rep told them, over the electronic foundation. */}
      {(call.channel === 'hybrid_call' || call.channel === 'needs_setup') && (
        <GapCapture call={call} />
      )}
    </div>
  )
}
