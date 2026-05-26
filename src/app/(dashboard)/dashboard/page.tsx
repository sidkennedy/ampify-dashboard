import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { Call } from '@/types'
import StatusBadge from '@/components/calls/StatusBadge'
import { isInsuranceOpen, getNextOpenTime } from '@/lib/insurance-hours'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id')
    .eq('id', user!.id)
    .single()

  const clinicId = profile?.clinic_id

  // Stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [{ count: todayTotal }, { count: inProgressCount }, { count: scheduledCount }, { count: failedCount }] = await Promise.all([
    supabase.from('calls').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).gte('created_at', today.toISOString()),
    supabase.from('calls').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('status', 'in_progress'),
    supabase.from('calls').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('status', 'scheduled'),
    supabase.from('calls').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId).eq('status', 'failed').gte('created_at', today.toISOString()),
  ])

  // Recent calls
  const { data: recentCalls } = await supabase
    .from('calls')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(8)

  // In-progress calls
  const { data: activeCalls } = await supabase
    .from('calls')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })

  const open = isInsuranceOpen()
  const nextOpen = open ? null : getNextOpenTime()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.25rem' }}>Dashboard</h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link href="/calls/new" className="btn-primary">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Call
        </Link>
      </div>

      {/* Insurance hours banner */}
      <div style={{
        background: open ? '#F0FDF4' : '#FFFBEB',
        border: `1px solid ${open ? '#BBF7D0' : '#FDE68A'}`,
        borderRadius: '0.75rem', padding: '0.875rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: open ? '#16A34A' : '#D97706', flexShrink: 0 }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: open ? '#15803D' : '#92400E' }}>
          {open
            ? 'Insurance lines are open — calls will be placed immediately'
            : `Insurance lines are closed — calls will be queued for ${nextOpen ? format(nextOpen, 'EEEE h:mm a') + ' ET' : 'next business hours'}`
          }
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: "Today's Calls", value: todayTotal ?? 0, color: '#0D1117' },
          { label: 'In Progress', value: inProgressCount ?? 0, color: '#2563EB' },
          { label: 'Scheduled', value: scheduledCount ?? 0, color: '#D97706' },
          { label: 'Failed Today', value: failedCount ?? 0, color: '#DC2626' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '1.25rem' }}>
            <p style={{ color: '#6B7280', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.5rem' }}>{stat.label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Active calls */}
      {activeCalls && activeCalls.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1rem' }}>Live Calls</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeCalls.map((call: Call) => (
              <Link key={call.id} href={`/calls/${call.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'white', border: '1px solid #BBF7D0', borderRadius: '0.75rem',
                  padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
                  boxShadow: '0 0 0 3px rgba(0,200,83,0.08)'
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00C853', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: '#0D1117', fontSize: '0.9375rem' }}>{call.patient_name}</p>
                    <p style={{ color: '#6B7280', fontSize: '0.8125rem' }}>
                      {call.insurance_phone} · {call.codes_requested}
                    </p>
                  </div>
                  <StatusBadge status={call.status} />
                  <svg width="16" height="16" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent calls */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117' }}>Recent Calls</h2>
          <Link href="/calls" style={{ color: '#00C853', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>View all →</Link>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {!recentCalls || recentCalls.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
              <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No calls yet</p>
              <p style={{ fontSize: '0.875rem' }}>Start your first call to see results here.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                  {['Patient', 'Insurance Phone', 'Codes', 'Status', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((call: Call) => (
                  <tr key={call.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <p style={{ fontWeight: 500, color: '#0D1117', fontSize: '0.875rem' }}>{call.patient_name}</p>
                      <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{call.dob}</p>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: '#4B5563', fontSize: '0.875rem' }}>{call.insurance_phone}</td>
                    <td style={{ padding: '1rem 1.25rem', color: '#4B5563', fontSize: '0.8125rem', maxWidth: 160 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{call.codes_requested}</span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}><StatusBadge status={call.status} /></td>
                    <td style={{ padding: '1rem 1.25rem', color: '#9CA3AF', fontSize: '0.8125rem' }}>{format(new Date(call.created_at), 'MMM d, h:mm a')}</td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <Link href={`/calls/${call.id}`} style={{ color: '#00C853', fontSize: '0.8125rem', fontWeight: 500, textDecoration: 'none' }}>View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
