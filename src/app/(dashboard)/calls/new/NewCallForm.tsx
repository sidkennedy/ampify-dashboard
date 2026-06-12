'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { VERIFICATION_TEMPLATES, VerificationType } from '@/lib/verification-templates'

interface PayerOption {
  key: string
  name: string
  stediPayerId: string | null
  curated: boolean
  acceptsBots: boolean | null
  eligibilitySupported: boolean | null
}

interface Props {
  clinicId: string
  clinicNpi: string
  clinicTaxId: string
  clinicName: string
  clinicAddress: string
  callbackNumber: string
}

const TEMPLATES_ORDER: VerificationType[] = ['diagnostic', 'hearing_aid', 'abr', 'apd', 'vestibular', 'bcbs_oos']

const PLAN_TYPES = ['HMO', 'PPO', 'EPO', 'POS', 'Medicare', 'Medicaid', 'Medicare Advantage', 'Commercial', 'Other']

export default function NewCallForm({ clinicId, clinicNpi, clinicTaxId, clinicName, clinicAddress, callbackNumber }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dobError, setDobError] = useState('')
  const [subscriberDobError, setSubscriberDobError] = useState('')

  function validateDobField(val: string, required: boolean): string {
    if (!val) return required ? 'Date of birth is required.' : ''
    const parsed = new Date(val)
    if (isNaN(parsed.getTime())) return 'Please enter a valid date.'
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (parsed >= today) return 'Date of birth cannot be today or in the future.'
    if (parsed.getFullYear() < 1900) return 'Date of birth looks too far in the past — please check the year.'
    return ''
  }

  const [verificationType, setVerificationType] = useState<VerificationType | ''>('')
  const [form, setForm] = useState({
    patientName: '',
    dob: '',
    memberId: '',
    subscriberName: '',
    subscriberDob: '',
    dateOfService: '',
    planType: '',
    state: 'NY',
    codesRequested: '',
    diagnosisCode: '',
    providerNPI: clinicNpi,
    clinicTaxId: clinicTaxId,
    clinicName: clinicName,
    clinicAddress: clinicAddress,
    callbackNumber: callbackNumber,
  })

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // ── Payer selection ──────────────────────────────────────────────────
  const [payer, setPayer] = useState<PayerOption | null>(null)
  const [payerQuery, setPayerQuery] = useState('')
  const [payerResults, setPayerResults] = useState<PayerOption[]>([])
  const [payerOpen, setPayerOpen] = useState(false)
  const [payerLoading, setPayerLoading] = useState(false)
  const payerBoxRef = useRef<HTMLDivElement>(null)

  // Load curated quick-picks on mount.
  useEffect(() => {
    fetch('/api/payers').then(r => r.json()).then(d => setPayerResults(d.payers ?? [])).catch(() => {})
  }, [])

  // Debounced directory search when typing.
  useEffect(() => {
    const q = payerQuery.trim()
    const t = setTimeout(() => {
      setPayerLoading(true)
      fetch(`/api/payers${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        .then(r => r.json())
        .then(d => setPayerResults(d.payers ?? []))
        .catch(() => {})
        .finally(() => setPayerLoading(false))
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [payerQuery])

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (payerBoxRef.current && !payerBoxRef.current.contains(e.target as Node)) setPayerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Plain-English preview of how this verification will be handled.
  function channelHint(): string | null {
    if (!payer || !verificationType) return null
    const elec = payer.eligibilitySupported ? '⚡ Runs electronically (instant)' : null
    if (verificationType === 'diagnostic' || verificationType === 'bcbs_oos') {
      return elec ?? `📞 ${payer.acceptsBots ? 'AI call' : 'Hybrid call'} to ${payer.name}`
    }
    if (verificationType === 'hearing_aid') {
      return `${elec ? elec + ' + ' : ''}📞 calls the hearing-aid vendor for the allowance`
    }
    // abr / apd / vestibular
    return `${elec ? elec + ' foundation + ' : ''}📞 ${payer.acceptsBots ? 'AI call' : 'hybrid call'} to ${payer.name} for procedure coverage`
  }

  const selectedTemplate = verificationType ? VERIFICATION_TEMPLATES[verificationType] : null
  const isBcbsOos = verificationType === 'bcbs_oos'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!verificationType) {
      setError('Please select a verification type before submitting.')
      return
    }
    if (isBcbsOos && !form.codesRequested.trim()) {
      setError('Please enter the CPT / HCPCS codes for this BCBS Out of State call.')
      return
    }
    if (!payer) {
      setError('Please select the patient’s insurance payer.')
      return
    }
    const patientDobErr = validateDobField(form.dob, true)
    if (patientDobErr) { setDobError(patientDobErr); return }
    const subDobErr = validateDobField(form.subscriberDob, false)
    if (subDobErr) { setSubscriberDobError(subDobErr); return }
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
          payerKey: payer.key,
          payerStediId: payer.stediPayerId,
          payerName: payer.name,
          codesRequested: isBcbsOos ? form.codesRequested : selectedTemplate!.cptCodes,
          diagnosisCode: isBcbsOos ? form.diagnosisCode : selectedTemplate!.diagnosisCode,
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
          Choose the appointment type — CPT codes and diagnosis code are auto-filled. For BCBS Out of State, enter codes manually.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }}>
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

        {selectedTemplate && !isBcbsOos && (
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
        {isBcbsOos && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '0.625rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>CPT / HCPCS Codes *</label>
              <input
                className="input"
                placeholder="e.g. 92557, V5261"
                value={form.codesRequested}
                onChange={e => set('codesRequested', e.target.value)}
                style={{ fontFamily: 'monospace', borderColor: '#FED7AA' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Diagnosis Code</label>
              <input
                className="input"
                placeholder="e.g. H90.3"
                value={form.diagnosisCode}
                onChange={e => set('diagnosisCode', e.target.value)}
                style={{ fontFamily: 'monospace', width: 120, borderColor: '#FED7AA' }}
              />
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
                <input
                  className="input"
                  type="date"
                  value={form.dob}
                  onChange={e => { set('dob', e.target.value); setDobError('') }}
                  onBlur={e => setDobError(validateDobField(e.target.value, true))}
                  required
                  style={dobError ? { borderColor: '#DC2626' } : undefined}
                />
                {dobError && <p style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>{dobError}</p>}
              </div>
              <div>
                <label className="label">Member / Policy ID *</label>
                <input className="input" placeholder="W123456789" value={form.memberId} onChange={e => set('memberId', e.target.value)} required />
              </div>
            </div>
          </div>
        </div>

        {/* Subscriber Information */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>3</span>
            Subscriber Information
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9CA3AF', marginLeft: '0.375rem' }}>Optional</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Subscriber Name</label>
              <input className="input" placeholder="John Smith" value={form.subscriberName} onChange={e => set('subscriberName', e.target.value)} />
            </div>
            <div>
              <label className="label">Subscriber Date of Birth</label>
              <input
                className="input"
                type="date"
                value={form.subscriberDob}
                onChange={e => { set('subscriberDob', e.target.value); setSubscriberDobError('') }}
                onBlur={e => setSubscriberDobError(validateDobField(e.target.value, false))}
                style={subscriberDobError ? { borderColor: '#DC2626' } : undefined}
              />
              {subscriberDobError && <p style={{ color: '#DC2626', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{subscriberDobError}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>4</span>
            Appointment Details
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Date of Service</label>
              <input className="input" type="date" value={form.dateOfService} onChange={e => set('dateOfService', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="label">Plan Type</label>
                <select
                  className="input"
                  value={form.planType}
                  onChange={e => set('planType', e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Select…</option>
                  {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">State {isBcbsOos && <span style={{ color: '#C2410C', fontWeight: 700 }}>* (required for OOS)</span>}</label>
                <input
                  className="input"
                  placeholder="NY"
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                  maxLength={2}
                  required={isBcbsOos}
                  style={isBcbsOos ? { borderColor: '#FB923C', boxShadow: '0 0 0 3px rgba(251,146,60,0.15)' } : undefined}
                />
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'none' }} />
      </div>

      {/* Insurance Payer */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>5</span>
          Insurance Payer *
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          Pick the payer — the system chooses the fastest channel and the right number automatically. No phone number to enter.
        </p>

        <div ref={payerBoxRef} style={{ position: 'relative', maxWidth: 480 }}>
          {payer ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', border: '2px solid #2563EB', background: '#EFF6FF', borderRadius: '0.625rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#1D4ED8', fontSize: '0.9375rem' }}>{payer.name}</div>
                {channelHint() && <div style={{ fontSize: '0.75rem', color: '#3B82F6', marginTop: '0.125rem' }}>{channelHint()}</div>}
              </div>
              <button type="button" onClick={() => { setPayer(null); setPayerQuery(''); setPayerOpen(true) }}
                style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                placeholder="Search payer — e.g. Aetna, Excellus, UnitedHealthcare…"
                value={payerQuery}
                onChange={e => { setPayerQuery(e.target.value); setPayerOpen(true) }}
                onFocus={() => setPayerOpen(true)}
              />
              {payerOpen && (
                <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.625rem', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: 280, overflowY: 'auto' }}>
                  {!payerQuery && <div style={{ padding: '0.5rem 0.875rem', fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your common payers</div>}
                  {payerLoading && <div style={{ padding: '0.75rem 0.875rem', color: '#9CA3AF', fontSize: '0.8125rem' }}>Searching…</div>}
                  {!payerLoading && payerResults.length === 0 && <div style={{ padding: '0.75rem 0.875rem', color: '#9CA3AF', fontSize: '0.8125rem' }}>No payers found.</div>}
                  {payerResults.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => { setPayer(p); setPayerOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', background: 'none', border: 'none', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', gap: '0.75rem' }}
                    >
                      <span style={{ fontSize: '0.875rem', color: '#0D1117', fontWeight: p.curated ? 600 : 400 }}>{p.name}</span>
                      <span style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                        {p.curated && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '0.125rem 0.375rem', borderRadius: 4 }}>SAVED</span>}
                        {p.eligibilitySupported && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#15803D', background: '#F0FDF4', padding: '0.125rem 0.375rem', borderRadius: 4 }}>⚡ Electronic</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Provider / Clinic Info */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 22, height: 22, background: '#F3F4F6', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>6</span>
          Provider / Clinic Info
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9CA3AF', marginLeft: '0.375rem' }}>Pre-filled from settings</span>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
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
          <div>
            <label className="label">Callback Number</label>
            <input className="input" placeholder="(315) 468-2985" value={form.callbackNumber} onChange={e => set('callbackNumber', e.target.value)} />
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
              Verifying…
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7"/>
              </svg>
              {verificationType ? `Verify ${VERIFICATION_TEMPLATES[verificationType].shortLabel}` : 'Select a type above'}
            </>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
