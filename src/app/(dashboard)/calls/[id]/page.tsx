import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import StatusBadge from '@/components/calls/StatusBadge'
import CallDetailTabs from './CallDetailTabs'
import Link from 'next/link'

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: call } = await supabase
    .from('calls')
    .select('*')
    .eq('id', id)
    .single()

  if (!call) notFound()

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
            </div>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              DOB: {call.dob} · Member ID: {call.member_id} · {format(new Date(call.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
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

      {/* Call metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Insurance Phone', value: call.insurance_phone },
          { label: 'Codes Requested', value: call.codes_requested },
          { label: 'Duration', value: call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—' },
          { label: 'Cost', value: call.cost ? `$${Number(call.cost).toFixed(3)}` : '—' },
          { label: 'End Reason', value: call.ended_reason ?? '—' },
        ].map(item => (
          <div key={item.label} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.625rem', padding: '0.875rem 1rem' }}>
            <p style={{ color: '#9CA3AF', fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>{item.label}</p>
            <p style={{ color: '#0D1117', fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs: Results + Transcript */}
      <CallDetailTabs call={call} />
    </div>
  )
}
