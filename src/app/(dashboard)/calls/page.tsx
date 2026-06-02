export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import StatusBadge from '@/components/calls/StatusBadge'
import CallsSearchFilter from './CallsSearchFilter'
import { VERIFICATION_TEMPLATES, VerificationType } from '@/lib/verification-templates'

function TypeBadge({ type }: { type: string | null }) {
  if (!type || !(type in VERIFICATION_TEMPLATES)) {
    return <span style={{ color: '#9CA3AF', fontSize: '0.8125rem' }}>—</span>
  }
  const t = VERIFICATION_TEMPLATES[type as VerificationType]
  return (
    <span style={{
      display: 'inline-block',
      background: t.bgColor,
      color: t.textColor,
      border: `1px solid ${t.borderColor}`,
      borderRadius: '0.375rem',
      padding: '0.125rem 0.5rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {t.shortLabel}
    </span>
  )
}

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (params.q) {
    query = query.ilike('patient_name', `%${params.q}%`)
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }
  if (params.from) {
    query = query.gte('created_at', params.from)
  }
  if (params.to) {
    const toDate = new Date(params.to)
    toDate.setDate(toDate.getDate() + 1)
    query = query.lt('created_at', toDate.toISOString())
  }

  const { data: calls } = await query

  const statusCounts = {
    all: calls?.length ?? 0,
    queued: calls?.filter(c => c.status === 'queued').length ?? 0,
    scheduled: calls?.filter(c => c.status === 'scheduled').length ?? 0,
    in_progress: calls?.filter(c => c.status === 'in_progress').length ?? 0,
    completed: calls?.filter(c => c.status === 'completed').length ?? 0,
    failed: calls?.filter(c => c.status === 'failed').length ?? 0,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117' }}>Call History</h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {statusCounts.all} total calls
          </p>
        </div>
        <Link href="/calls/new" className="btn-primary">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Call
        </Link>
      </div>

      <CallsSearchFilter currentParams={params} statusCounts={statusCounts} />

      {!calls || calls.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="22" height="22" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v3z"/>
            </svg>
          </div>
          <p style={{ fontWeight: 600, color: '#0D1117', marginBottom: '0.5rem' }}>No calls found</p>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            {params.q || params.status ? 'Try adjusting your filters.' : 'Start your first eligibility verification call.'}
          </p>
          {!params.q && !params.status && (
            <Link href="/calls/new" className="btn-primary" style={{ display: 'inline-flex' }}>Start a Call</Link>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Patient', 'Member ID', 'Type', 'Insurance Phone', 'Status', 'Duration', 'Cost', 'Date'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="table-row-hover" style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontWeight: 600, color: '#0D1117', fontSize: '0.875rem' }}>{call.patient_name}</div>
                      <div style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.125rem' }}>DOB: {call.dob}</div>
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{call.member_id}</Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <TypeBadge type={call.verification_type} />
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{call.insurance_phone}</Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <StatusBadge status={call.status} />
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {call.cost ? `$${Number(call.cost).toFixed(3)}` : '—'}
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6B7280', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    <Link href={`/calls/${call.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {format(new Date(call.created_at), 'MMM d, yyyy')}
                      <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{format(new Date(call.created_at), 'h:mm a')}</div>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
