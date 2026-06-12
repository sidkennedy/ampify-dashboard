import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { Call } from '@/types'
import StatusBadge from '@/components/calls/StatusBadge'
import ChannelBadge from '@/components/calls/ChannelBadge'
import ResultSnippet from '@/components/calls/ResultSnippet'
import { VERIFICATION_TEMPLATES, VerificationType } from '@/lib/verification-templates'
import { isInsuranceOpen, getNextOpenTime } from '@/lib/insurance-hours'

function TypeTag({ type }: { type: string | null }) {
  if (!type || !(type in VERIFICATION_TEMPLATES)) return <span style={{ color: '#9CA3AF', fontSize: '0.8125rem' }}>—</span>
  const t = VERIFICATION_TEMPLATES[type as VerificationType]
  return <span style={{ background: t.bgColor, color: t.textColor, border: `1px solid ${t.borderColor}`, borderRadius: '0.375rem', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.shortLabel}</span>
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('clinic_id, role').eq('id', user!.id).single()
  const clinicId = profile?.clinic_id
  // Superadmins oversee every clinic — don't scope to one (matches the Verifications list).
  const scopeToClinic = clinicId && profile?.role !== 'superadmin'

  // Channel breakdown across all verifications.
  let chQuery = supabase.from('calls').select('channel,status,vapi_call_id')
  if (scopeToClinic) chQuery = chQuery.eq('clinic_id', clinicId)
  const { data: allRows } = await chQuery

  const rows = allRows ?? []
  const n = (pred: (r: { channel: string | null; status: string; vapi_call_id: string | null }) => boolean) => rows.filter(pred).length
  const total = rows.length
  const electronic = n(r => r.channel === 'electronic')
  const referOut = n(r => r.channel === 'carve_out_refer')
  // Calls actually placed (vs. merely recommended) — the two-part flow only fires on biller request.
  const calls = n(r => !!r.vapi_call_id)
  const callsRecommended = n(r => (r.channel === 'autonomous_call' || r.channel === 'hybrid_call') && !r.vapi_call_id)
  const noCall = total - calls
  const automatedPct = total ? Math.round((noCall / total) * 100) : 0

  let recentQuery = supabase.from('calls').select('*').order('created_at', { ascending: false }).limit(10)
  if (scopeToClinic) recentQuery = recentQuery.eq('clinic_id', clinicId)
  const { data: recentCalls } = await recentQuery

  // Claims / AR overview (only surfaces if there are claims).
  let claimsQuery = supabase.from('claims').select('charge_amount, paid_amount, status, submission_status, service_date_from')
  if (scopeToClinic) claimsQuery = claimsQuery.eq('clinic_id', clinicId)
  const { data: claimRows } = await claimsQuery
  const cr = claimRows ?? []
  const dayMs = 86400000, nowMs = Date.now()
  let arOutstanding = 0, arPaid = 0, arDeniedAmt = 0, arDeniedCount = 0, arAging60 = 0
  for (const c of cr) {
    const amt = Number(c.charge_amount) || 0
    arPaid += Number(c.paid_amount) || 0
    const denied = c.status === 'denied' || c.submission_status === 'rejected'
    if (denied) { arDeniedCount++; arDeniedAmt += amt }
    else if (c.status !== 'paid') {
      arOutstanding += amt
      if ((nowMs - new Date(c.service_date_from).getTime()) / dayMs > 60) arAging60 += amt
    }
  }
  const hasClaims = cr.length > 0
  const m0 = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const open = isInsuranceOpen()
  const nextOpen = open ? null : getNextOpenTime()

  const tiles = [
    { label: 'Verifications', value: total, sub: 'all time', color: '#0D1117' },
    { label: '⚡ Instant (electronic)', value: electronic, sub: 'no phone call', color: '#15803D' },
    { label: '↪ Self-pay', value: referOut, sub: 'HA carved out / self-pay', color: '#7C3AED' },
    { label: '📞 Calls placed', value: calls, sub: callsRecommended > 0 ? `${callsRecommended} more recommended` : 'AI + hybrid', color: '#1D4ED8' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.25rem' }}>Dashboard</h1>
          <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link href="/calls/new" className="btn-primary">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Verification
        </Link>
      </div>

      {/* Automation headline */}
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', color: '#15803D' }}>
            <strong>{automatedPct}%</strong> of verifications handled with <strong>no phone call</strong> — {electronic} pulled electronically, {referOut} resolved as self-pay.
          </span>
        </div>
      )}

      {/* Insurance hours — only relevant to the call portion now */}
      <div style={{ background: open ? '#FFFFFF' : '#FFFBEB', border: `1px solid ${open ? '#E5E7EB' : '#FDE68A'}`, borderRadius: '0.75rem', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: open ? '#16A34A' : '#D97706', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8125rem', color: open ? '#374151' : '#92400E' }}>
          {open
            ? 'Insurance phone lines are open — any calls go out immediately. (Electronic checks run anytime.)'
            : `Insurance phone lines are closed — calls queue for ${nextOpen ? format(nextOpen, 'EEEE h:mm a') + ' ET' : 'business hours'}. Electronic checks still run anytime.`}
        </span>
      </div>

      {/* Channel tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {tiles.map(t => (
          <div key={t.label} className="card" style={{ padding: '1.25rem' }}>
            <p style={{ color: '#6B7280', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.5rem' }}>{t.label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: t.color, lineHeight: 1 }}>{t.value}</p>
            <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.375rem' }}>{t.sub}</p>
          </div>
        ))}
      </div>

      {/* Claims / AR overview */}
      {hasClaims && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117' }}>Claims & accounts receivable</h2>
            <Link href="/claims" style={{ color: '#00C853', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>Manage claims →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Outstanding', value: m0(arOutstanding), sub: `${cr.length} claims`, color: '#0D1117' },
              { label: 'Collected', value: m0(arPaid), sub: 'paid', color: '#15803D' },
              { label: 'Denied', value: m0(arDeniedAmt), sub: `${arDeniedCount} claims`, color: '#B91C1C' },
              { label: 'Aging 60+ days', value: m0(arAging60), sub: 'needs follow-up', color: arAging60 > 0 ? '#B45309' : '#9CA3AF' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '1.25rem' }}>
                <p style={{ color: '#6B7280', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.5rem' }}>{s.label}</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
                <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.375rem' }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent verifications */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117' }}>Recent verifications</h2>
          <Link href="/calls" style={{ color: '#00C853', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>View all →</Link>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {!recentCalls || recentCalls.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
              <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>No verifications yet</p>
              <p style={{ fontSize: '0.875rem' }}>Start your first verification to see results here.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                  {['Patient', 'Type', 'Channel', 'Result', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((call: Call) => (
                  <tr key={call.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <p style={{ fontWeight: 500, color: '#0D1117', fontSize: '0.875rem' }}>{call.patient_name}</p>
                      <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{call.dob}</p>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}><TypeTag type={call.verification_type} /></td>
                    <td style={{ padding: '0.875rem 1.25rem' }}><ChannelBadge channel={call.channel} /></td>
                    <td style={{ padding: '0.875rem 1.25rem' }}><ResultSnippet call={call} /></td>
                    <td style={{ padding: '0.875rem 1.25rem', color: '#9CA3AF', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{format(new Date(call.created_at), 'MMM d, h:mm a')}</td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
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
