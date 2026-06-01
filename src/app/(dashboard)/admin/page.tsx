export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import AdminActions from './AdminActions'
import Link from 'next/link'

interface ClinicStats {
  id: string
  name: string
  status: string
  created_at: string
  npi: string | null
  totalCalls: number
  callsLast30: number
  callsInProgress: number
  totalCost: number
  costLast30: number
  staffCount: number
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify superadmin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') {
    redirect('/')
  }

  // Fetch all clinics
  const { data: clinics } = await supabase
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch all calls (service client would bypass RLS, but superadmin policy allows it)
  const { data: allCalls } = await supabase
    .from('calls')
    .select('clinic_id, status, cost, created_at')

  // Fetch all profiles for staff counts
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('clinic_id, role')

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Build stats per clinic
  const clinicStats: ClinicStats[] = (clinics ?? []).map(clinic => {
    const clinicCalls = allCalls?.filter(c => c.clinic_id === clinic.id) ?? []
    const last30 = clinicCalls.filter(c => new Date(c.created_at) >= thirtyDaysAgo)
    const staffCount = allProfiles?.filter(p => p.clinic_id === clinic.id).length ?? 0

    return {
      id: clinic.id,
      name: clinic.name,
      status: clinic.status,
      created_at: clinic.created_at,
      npi: clinic.npi,
      totalCalls: clinicCalls.length,
      callsLast30: last30.length,
      callsInProgress: clinicCalls.filter(c => c.status === 'in_progress').length,
      totalCost: clinicCalls.reduce((s, c) => s + (Number(c.cost) || 0), 0),
      costLast30: last30.reduce((s, c) => s + (Number(c.cost) || 0), 0),
      staffCount,
    }
  })

  // Global stats
  const totalCallsAll = allCalls?.length ?? 0
  const totalCostAll = allCalls?.reduce((s, c) => s + (Number(c.cost) || 0), 0) ?? 0
  const activeClinics = clinics?.filter(c => c.status === 'active').length ?? 0
  const callsInProgress = allCalls?.filter(c => c.status === 'in_progress').length ?? 0

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117' }}>Super Admin</h1>
          <span className="badge badge-purple">Admin Only</span>
        </div>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Platform-wide overview of all clinics and call activity.</p>
      </div>

      {/* Global stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
        {[
          { label: 'Active Clinics', value: activeClinics, color: '#16A34A', bg: '#DCFCE7' },
          { label: 'Total Calls (All Time)', value: totalCallsAll.toLocaleString(), color: '#2563EB', bg: '#DBEAFE' },
          { label: 'Calls In Progress', value: callsInProgress, color: '#D97706', bg: '#FEF3C7' },
          { label: 'Total Platform Cost', value: `$${totalCostAll.toFixed(2)}`, color: '#7C3AED', bg: '#F3E8FF' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: stat.color }} />
            </div>
            <p style={{ color: '#9CA3AF', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{stat.label}</p>
            <p style={{ color: '#0D1117', fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Clinics table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0D1117' }}>All Clinics</h2>
          <AdminActions />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Clinic', 'Status', 'Staff', 'Total Calls', 'Last 30 Days', 'Cost (30d)', 'All-Time Cost', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clinicStats.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem' }}>No clinics yet.</td>
              </tr>
            ) : clinicStats.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ fontWeight: 600, color: '#0D1117', fontSize: '0.875rem' }}>{c.name}</div>
                  {c.npi && <div style={{ color: '#9CA3AF', fontSize: '0.75rem', fontFamily: 'monospace' }}>NPI: {c.npi}</div>}
                  <div style={{ color: '#9CA3AF', fontSize: '0.6875rem', marginTop: '0.125rem' }}>{c.id.slice(0, 8)}…</div>
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-red'}`}>{c.status}</span>
                </td>
                <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem', textAlign: 'center' }}>{c.staffCount}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem', textAlign: 'center' }}>{c.totalCalls}</td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                  <span style={{ fontWeight: 600, color: c.callsLast30 > 0 ? '#2563EB' : '#9CA3AF', fontSize: '0.875rem' }}>{c.callsLast30}</span>
                </td>
                <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem' }}>${c.costLast30.toFixed(2)}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem' }}>${c.totalCost.toFixed(2)}</td>
                <td style={{ padding: '0.875rem 1rem', color: '#9CA3AF', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                  {format(new Date(c.created_at), 'MMM d, yyyy')}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <ClinicRowActions clinicId={c.id} clinicName={c.name} currentStatus={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ClinicRowActions({ clinicId, clinicName, currentStatus }: { clinicId: string; clinicName: string; currentStatus: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Link
        href={`/admin/clinics/${clinicId}`}
        style={{ fontSize: '0.75rem', color: '#2563EB', textDecoration: 'none', fontWeight: 500, padding: '0.25rem 0.5rem', borderRadius: '0.375rem', background: '#DBEAFE' }}
      >
        View
      </Link>
    </div>
  )
}
