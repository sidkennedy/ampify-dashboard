export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import ChannelBadge from '@/components/calls/ChannelBadge'

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cents = (n: number) => (n >= 1 ? money(n) : `$${n.toFixed(2)}`)

// Fixed monthly costs — NOT per-verification; allocated across clinics. Estimates.
const FIXED_MONTHLY = [
  { label: 'Vapi HIPAA tier', amount: 1000 },
  { label: 'Supabase (Pro + BAA)', amount: 25 },
  { label: 'Hosting', amount: 25 },
  { label: 'Phone numbers', amount: 20 },
  { label: 'Monitoring / buffer', amount: 100 },
]

interface CostRow {
  id: string
  patient_name: string
  verification_type: string | null
  channel: string | null
  electronic_cost: number | null
  electronic_checks: number | null
  cost: number | null
  created_at: string
  clinics: { name: string } | null
}

export default async function CostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin') redirect('/dashboard')

  const { data } = await supabase
    .from('calls')
    .select('id,patient_name,verification_type,channel,electronic_cost,electronic_checks,cost,created_at,clinics(name)')
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as unknown as CostRow[]

  const elecOf = (r: CostRow) => Number(r.electronic_cost ?? 0)
  const callOf = (r: CostRow) => Number(r.cost ?? 0)
  const totalOf = (r: CostRow) => elecOf(r) + callOf(r)

  const totalElectronic = rows.reduce((s, r) => s + elecOf(r), 0)
  const totalCall = rows.reduce((s, r) => s + callOf(r), 0)
  const grand = totalElectronic + totalCall
  const billable = rows.filter(r => totalOf(r) > 0).length
  const avg = billable ? grand / billable : 0
  const fixedTotal = FIXED_MONTHLY.reduce((s, f) => s + f.amount, 0)

  // Per-clinic aggregation
  const byClinic = new Map<string, { name: string; count: number; elec: number; call: number }>()
  for (const r of rows) {
    const name = r.clinics?.name ?? 'Unassigned'
    const c = byClinic.get(name) ?? { name, count: 0, elec: 0, call: 0 }
    c.count += 1; c.elec += elecOf(r); c.call += callOf(r)
    byClinic.set(name, c)
  }
  const clinics = [...byClinic.values()].sort((a, b) => (b.elec + b.call) - (a.elec + a.call))

  const summary = [
    { label: 'Total variable cost', value: money(grand), sub: `${billable} billable verifications`, color: '#0D1117' },
    { label: '⚡ Stedi (electronic)', value: money(totalElectronic), sub: `${rows.reduce((s, r) => s + (r.electronic_checks ?? 0), 0)} checks`, color: '#15803D' },
    { label: '📞 Vapi (phone calls)', value: money(totalCall), sub: 'real, from Vapi', color: '#1D4ED8' },
    { label: 'Avg per verification', value: cents(avg), sub: 'variable cost', color: '#7C3AED' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117' }}>Cost Tracker</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>Internal — what each verification costs us. Stedi is estimated at <strong>${Number(process.env.STEDI_COST_PER_CHECK ?? 0.25).toFixed(2)}/check</strong> (set <code>STEDI_COST_PER_CHECK</code>); Vapi is the real per-call cost.</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {summary.map(s => (
          <div key={s.label} className="card" style={{ padding: '1.25rem' }}>
            <p style={{ color: '#6B7280', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.5rem' }}>{s.label}</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.375rem' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Cost by clinic */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '0.75rem' }}>Cost by clinic</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Clinic', 'Verifications', 'Stedi', 'Vapi', 'Total', 'Avg / verif.'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: h === 'Clinic' ? 'left' : 'right', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {clinics.map(c => (
              <tr key={c.name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: '#0D1117', fontSize: '0.875rem' }}>{c.name}</td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: '#374151', fontSize: '0.875rem' }}>{c.count}</td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: '#15803D', fontSize: '0.875rem' }}>{money(c.elec)}</td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: '#1D4ED8', fontSize: '0.875rem' }}>{money(c.call)}</td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0D1117', fontSize: '0.875rem' }}>{money(c.elec + c.call)}</td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: '#6B7280', fontSize: '0.875rem' }}>{cents(c.count ? (c.elec + c.call) / c.count : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fixed monthly */}
      <div className="card" style={{ marginBottom: '1.5rem', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#92400E', marginBottom: '0.5rem' }}>Fixed monthly costs — {money(fixedTotal)}/mo</h2>
        <p style={{ color: '#78350F', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>Not per-verification — these are allocated across all clinics and shrink (per clinic) as you scale.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem' }}>
          {FIXED_MONTHLY.map(f => (
            <span key={f.label} style={{ fontSize: '0.8125rem', color: '#92400E' }}>{f.label}: <strong>{money(f.amount)}</strong></span>
          ))}
        </div>
      </div>

      {/* Cost by verification */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '0.75rem' }}>Cost by verification</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0 }}>
              {['Patient', 'Type', 'Channel', 'Stedi', 'Vapi', 'Total', 'Date'].map(h => <th key={h} style={{ padding: '0.625rem 1rem', textAlign: ['Stedi', 'Vapi', 'Total'].includes(h) ? 'right' : 'left', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', background: '#F9FAFB' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '0.625rem 1rem' }}>
                    <Link href={`/calls/${r.id}`} style={{ color: '#0D1117', textDecoration: 'none', fontWeight: 500, fontSize: '0.8125rem' }}>{r.patient_name}</Link>
                  </td>
                  <td style={{ padding: '0.625rem 1rem', color: '#6B7280', fontSize: '0.8125rem' }}>{r.verification_type ?? '—'}</td>
                  <td style={{ padding: '0.625rem 1rem' }}><ChannelBadge channel={r.channel} /></td>
                  <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#15803D', fontSize: '0.8125rem' }}>{elecOf(r) ? cents(elecOf(r)) : '—'}</td>
                  <td style={{ padding: '0.625rem 1rem', textAlign: 'right', color: '#1D4ED8', fontSize: '0.8125rem' }}>{callOf(r) ? money(callOf(r)) : '—'}</td>
                  <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontWeight: 700, color: '#0D1117', fontSize: '0.8125rem' }}>{totalOf(r) ? cents(totalOf(r)) : '—'}</td>
                  <td style={{ padding: '0.625rem 1rem', color: '#9CA3AF', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{format(new Date(r.created_at), 'MMM d')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
