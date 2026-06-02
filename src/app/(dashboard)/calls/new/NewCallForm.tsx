'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VERIFICATION_TEMPLATES, VerificationType } from '@/lib/verification-templates'

interface Props {
  clinicId: string
  clinicNpi: string
  clinicTaxId: string
  clinicName: string
  clinicAddress: string
}

const TEMPLATES_ORDER: VerificationType[] = ['diagnostic', 'hearing_aid', 'abr', 'apd', 'vestibular']

const PLAN_TYPES = ['HMO', 'PPO', 'EPO', 'POS', 'Medicare', 'Medicaid', 'Medicare Advantage', 'Other']

export default function NewCallForm({ clinicId, clinicNpi, clinicTaxId, clinicName, clinicAddress }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [verificationType, setVerificationType] = useState<VerificationType | ''>('')
  const [form, setForm] = useState({
    patientName: '',
    dob: '',
    memberId: '',
    dateOfService: '',
    planType: '',
    state: 'NY',
    insurancePhone: '',
    providerNPI: clinicNpi,
    clinicTaxId: clinicTaxId,
    clinicName: clinicName,
    clinicAddress: clinicAddress,
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const selectedTemplate = verificationType ? VERIFICATION_TEMPLATES[verificationType] : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!verificationType) {
      setError('Please select a verification type before submitting.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clinicId,
          verificationType,
          codesRequested: selectedTemplate!.cptCodes,
          diagnosisCode: selectedTemplate!.diagnosisCode,
        }),
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

      {/* Step 1: Verification Type */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>1</span>
          Select Verification Type
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
          Choose the appointment type — CPT codes and diagnosis code are auto-filled.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          {TEMPLATES_ORDER.map(key => {
            const t = VERIFICATION_TEMPLATES[key]
            const selected = verificationType === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setVerificationType(key)}
                style={{
                  border: `2px solid ${selected ? t.borderColor : '#E5E7EB'}`,
                  borderRadius: '0.75rem',
                  padding: '1rem 0.875rem',
                  background: selected ? t.bgColor : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  outline: 'none',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: selected ? t.textColor : '#0D1117', marginBottom: '0.375rem' }}>
                  {t.shortLabel}
                </div>
                <div style={{ fontSize: '0.7rem', color: selected ? t.textColor : '#9CA3AF', lineHeight: 1.4 }}>
                  {t.description}
                </div>
              </button>
            )
          })}
        </div>

        {selectedTemplate && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: selectedTemplate.bgColor, border: `1px solid ${selectedTemplate.borderColor}`, borderRadius: '0.625rem', display: 'flex', gap: '2rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: selectedTemplate.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPT / HCPCS Codes</span>
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 600, color: selectedTemplate.textColor, marginTop: '0.125rem' }}>{selectedTemplate.cptCodes}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: selectedTemplate.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosis Code</span>
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 600, color: selectedTemplate.textColor, marginTop: '0.125rem' }}>{selectedTemplate.diagnosisCode}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* Patient Information */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>2</span>
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

        {/* Appointment Details */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>3</span>
            Appointment Details
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Date of Service *</label>
              <input className="input" type="date" value={form.dateOfService} onChange={e => set('dateOfService', e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="label">Plan Type *</label>
                <select
                  className="input"
                  value={form.planType}
                  onChange={e => set('planType', e.target.value)}
                  required
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Select…</option>
                  {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">State</label>
                <input className="input" placeholder="NY" value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insurance Phone */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>4</span>
          Insurance Provider Line
        </h2>
        <div style={{ maxWidth: 360 }}>
          <label className="label">Provider Services Phone (back of card) *</label>
          <input className="input" type="tel" placeholder="+18005551234" value={form.insurancePhone} onChange={e => set('insurancePhone', e.target.value)} required />
          <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.375rem' }}>Include country code — e.g. +1</p>
        </div>
      </div>

      {/* Provider / Clinic Info */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>5</span>
          Provider / Clinic Info
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9CA3AF', marginLeft: '0.375rem' }}>Pre-filled from settings</span>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          <div>
            <label className="label">Provider NPI</label>
            <input className="input" placeholder="1234567890" value={form.providerNPI} onChange={e => set('providerNPI', e.target.value)} />
          </div>
          <div>
            <label className="label">Clinic Tax ID</label>
            <input className="input" placeholder="12-3456789" value={form.clinicTaxId} onChange={e => set('clinicTaxId', e.target.value)} />
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

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.5rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem', color: '#DC2626', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <a href="/calls" className="btn-secondary">Cancel</a>
        <button
          className="btn-primary"
          type="submit"
          disabled={loading || !verificationType}
          style={{ minWidth: 160, justifyContent: 'center', opacity: !verificationType ? 0.5 : 1 }}
        >
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
              {verificationType ? `Run ${VERIFICATION_TEMPLATES[verificationType].shortLabel} Call` : 'Select a type above'}
            </>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
