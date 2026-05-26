'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Template } from '@/types'

interface Props {
  clinicId: string
  clinicNpi: string
  clinicTaxId: string
  clinicName: string
  clinicAddress: string
  templates: Template[]
}

export default function NewCallForm({ clinicId, clinicNpi, clinicTaxId, clinicName, clinicAddress, templates }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    patientName: '',
    dob: '',
    memberId: '',
    insurancePhone: '',
    codesRequested: '',
    providerNPI: clinicNpi,
    clinicTaxId: clinicTaxId,
    clinicName: clinicName,
    clinicAddress: clinicAddress,
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function applyTemplate(t: Template) {
    setForm(f => ({ ...f, codesRequested: t.codes_requested }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clinicId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start call')

      router.push(`/calls/${data.callId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Patient info */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, background: '#DCFCE7', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            Patient Information
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Patient Name *</label>
              <input className="input" placeholder="Jane Smith" value={form.patientName} onChange={e => set('patientName', e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="label">Date of Birth *</label>
                <input className="input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} required />
              </div>
              <div>
                <label className="label">Member / Policy ID *</label>
                <input className="input" placeholder="W123456789" value={form.memberId} onChange={e => set('memberId', e.target.value)} required />
              </div>
            </div>
          </div>
        </div>

        {/* Insurance info */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, background: '#DBEAFE', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v3z"/></svg>
            </span>
            Insurance Details
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Insurance Provider Phone *</label>
              <input className="input" type="tel" placeholder="+18005551234" value={form.insurancePhone} onChange={e => set('insurancePhone', e.target.value)} required />
              <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.375rem' }}>Include country code (e.g. +1)</p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <label className="label" style={{ margin: 0 }}>CPT / HCPCS Codes *</label>
                {templates.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Templates:</span>
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {templates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyTemplate(t)}
                          style={{
                            background: form.codesRequested === t.codes_requested ? '#00C853' : '#F3F4F6',
                            color: form.codesRequested === t.codes_requested ? 'white' : '#374151',
                            border: 'none', borderRadius: 6, padding: '0.25rem 0.625rem',
                            fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer'
                          }}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <input className="input" placeholder="92557, 92550, 92628" value={form.codesRequested} onChange={e => set('codesRequested', e.target.value)} required />
              <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.375rem' }}>Comma-separated CPT/HCPCS codes</p>
            </div>
          </div>
        </div>

        {/* Provider info */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 24, height: 24, background: '#F3E8FF', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </span>
            Provider / Clinic Info
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9CA3AF', marginLeft: '0.5rem' }}>Pre-filled from settings — edit if needed</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div>
              <label className="label">Provider NPI</label>
              <input className="input" placeholder="1234567890" value={form.providerNPI} onChange={e => set('providerNPI', e.target.value)} />
            </div>
            <div>
              <label className="label">Clinic Tax ID</label>
              <input className="input" placeholder="123456789" value={form.clinicTaxId} onChange={e => set('clinicTaxId', e.target.value)} />
            </div>
            <div>
              <label className="label">Clinic Name</label>
              <input className="input" placeholder="Hearing Care Clinic" value={form.clinicName} onChange={e => set('clinicName', e.target.value)} />
            </div>
            <div>
              <label className="label">Clinic Address</label>
              <input className="input" placeholder="123 Main St, City, ST 12345" value={form.clinicAddress} onChange={e => set('clinicAddress', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.5rem', padding: '0.875rem 1.25rem', marginTop: '1.25rem', color: '#DC2626', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <a href="/calls" className="btn-secondary">Cancel</a>
        <button className="btn-primary" type="submit" disabled={loading} style={{ minWidth: 160, justifyContent: 'center' }}>
          {loading ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Starting call…
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v3z"/>
              </svg>
              Start Call
            </>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
