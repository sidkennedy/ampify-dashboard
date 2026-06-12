'use client'

import { useState } from 'react'

interface Coverage {
  payerName?: string | null
  memberId?: string | null
  planName?: string | null
  status?: string | null
  confidence?: string | null
}

const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#0D1117', background: '#fff' }

export default function DiscoveryClient() {
  const [f, setF] = useState({ firstName: '', lastName: '', dateOfBirth: '', ssn: '', zip: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ coveragesFound: number; coverages: Coverage[] } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function run() {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Discovery failed'); return }
      setResult(data)
    } catch { setError('Network error — please try again') }
    finally { setLoading(false) }
  }

  const canRun = f.firstName.trim() && f.lastName.trim() && !loading

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
          <div><label style={labelStyle}>First name *</label><input style={inputStyle} value={f.firstName} onChange={set('firstName')} /></div>
          <div><label style={labelStyle}>Last name *</label><input style={inputStyle} value={f.lastName} onChange={set('lastName')} /></div>
          <div><label style={labelStyle}>Date of birth</label><input style={inputStyle} type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} /></div>
          <div><label style={labelStyle}>SSN <span style={{ fontWeight: 400, color: '#9CA3AF' }}>· biggest boost to match rate</span></label><input style={inputStyle} inputMode="numeric" placeholder="9 digits" value={f.ssn} onChange={set('ssn')} /></div>
          <div><label style={labelStyle}>ZIP</label><input style={inputStyle} inputMode="numeric" placeholder="optional" value={f.zip} onChange={set('zip')} /></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginTop: '1rem' }}>
          <button onClick={run} disabled={!canRun} className="btn-primary" style={{ fontSize: '0.875rem', opacity: canRun ? 1 : 0.5 }}>
            {loading ? 'Searching…' : 'Find coverage'}
          </button>
          {error && <span style={{ color: '#DC2626', fontSize: '0.8125rem' }}>{error}</span>}
        </div>
        <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0.75rem 0 0' }}>
          Tip: name + DOB runs, but payers usually need an <strong>SSN</strong> to confirm a match — add it for real hits.
        </p>
      </div>

      {result && (
        result.coveragesFound > 0 ? (
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#15803D', marginBottom: '0.75rem' }}>
              ✅ Found {result.coveragesFound} coverage{result.coveragesFound === 1 ? '' : 's'}
            </p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {result.coverages.map((c, i) => (
                <div key={i} className="card" style={{ padding: '1rem 1.25rem' }}>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0D1117', margin: '0 0 0.375rem' }}>{c.payerName ?? 'Coverage found'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem 1.25rem', fontSize: '0.8125rem', color: '#374151' }}>
                    {c.memberId && <span><strong>Member ID:</strong> {c.memberId}</span>}
                    {c.planName && <span><strong>Plan:</strong> {c.planName}</span>}
                    {c.status && <span><strong>Status:</strong> {c.status}</span>}
                    {c.confidence && <span><strong>Confidence:</strong> {c.confidence}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center', color: '#6B7280' }}>
            <p style={{ fontWeight: 600, color: '#0D1117', margin: '0 0 0.25rem' }}>No coverage found</p>
            <p style={{ fontSize: '0.8125rem', margin: 0 }}>The search ran but no payer confirmed a match. Adding an <strong>SSN</strong> is the single biggest thing that lifts the hit rate.</p>
          </div>
        )
      )}
    </div>
  )
}
