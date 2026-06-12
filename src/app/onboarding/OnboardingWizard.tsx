'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KNOWN_VENDORS } from '@/lib/payer-registry'

interface ClinicData {
  name: string; address: string; npi: string; taxId: string
  callbackNumber: string; billerPhone: string; vendorContracts: string[]
}

const STEPS = ['Clinic', 'Contact', 'Hearing-aid networks', 'Agreements']

export default function OnboardingWizard({ clinic }: { clinic: ClinicData }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ ...clinic, acceptName: '', acceptTitle: '', agreed: false })
  const set = (k: string, v: string | boolean | string[]) => setF(p => ({ ...p, [k]: v }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleVendor = (name: string) =>
    set('vendorContracts', f.vendorContracts.includes(name) ? f.vendorContracts.filter(v => v !== name) : [...f.vendorContracts, name])

  function next() {
    setError('')
    if (step === 0 && (!f.name.trim() || !f.npi.trim())) { setError('Clinic name and NPI are required.'); return }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  async function finish() {
    setError('')
    if (!f.acceptName.trim() || !f.acceptTitle.trim() || !f.agreed) { setError('Enter your name and title and tick the agreement box.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      router.push('/dashboard'); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117' }}>Welcome — let&apos;s set up your clinic</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>A few details, then you&apos;re ready to verify.</p>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, background: i <= step ? '#16A34A' : '#E5E7EB' }} />
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: i <= step ? '#15803D' : '#9CA3AF', marginTop: '0.375rem' }}>{i + 1}. {s}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <div className="card">
        {step === 0 && (
          <>
            <H>Clinic information</H>
            <Field label="Clinic name *"><input className="input" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
            <Field label="Address"><input className="input" value={f.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City, ST 12345" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <Field label="Provider NPI *"><input className="input" value={f.npi} onChange={e => set('npi', e.target.value)} placeholder="1234567890" /></Field>
              <Field label="Tax ID (EIN)"><input className="input" value={f.taxId} onChange={e => set('taxId', e.target.value)} placeholder="XX-XXXXXXX" /></Field>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <H>Call settings</H>
            <Field label="Callback number"><input className="input" value={f.callbackNumber} onChange={e => set('callbackNumber', e.target.value)} placeholder="(315) 555-0142" /><Hint>Number the AI gives if an insurance rep asks for a callback.</Hint></Field>
            <Field label="Biller transfer number"><input className="input" value={f.billerPhone} onChange={e => set('billerPhone', e.target.value)} placeholder="(315) 555-0199" /><Hint>For payers that don&apos;t accept automated calls, the AI waits on hold and transfers the rep to this number.</Hint></Field>
          </>
        )}
        {step === 2 && (
          <>
            <H>Hearing-aid networks you&apos;re contracted with</H>
            <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', marginBottom: '1rem' }}>Tick any third-party hearing-aid networks (TPAs) you&apos;re credentialed with. If you&apos;re not in any, leave them all unticked — we&apos;ll flag those benefits as private-pay / refer-out.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              {KNOWN_VENDORS.map(name => {
                const on = f.vendorContracts.includes(name)
                return (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem 0.875rem', borderRadius: '0.625rem', cursor: 'pointer', border: `1.5px solid ${on ? '#15803D' : '#E5E7EB'}`, background: on ? '#F0FDF4' : 'white' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleVendor(name)} style={{ width: 16, height: 16, accentColor: '#15803D' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: on ? 600 : 400, color: on ? '#15803D' : '#374151' }}>{name}</span>
                  </label>
                )
              })}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <H>Agreements</H>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '0.5rem', padding: '1rem', fontSize: '0.8125rem', color: '#374151', lineHeight: 1.6, marginBottom: '1rem', background: '#FAFAFA' }}>
              <p style={{ fontWeight: 600, color: '#0D1117' }}>Clinic Services Agreement & Business Associate Agreement (BAA)</p>
              <p>By agreeing, your clinic: (1) engages Ampify to provide insurance verification and revenue-cycle services; (2) <strong>authorizes Ampify to act as your agent</strong> to enroll your NPI with payers/clearinghouses and to submit and receive electronic healthcare transactions (eligibility, discovery, claim status, claims, and remittance) on your behalf; and (3) enters into a <strong>HIPAA Business Associate Agreement</strong> governing how patient information (PHI) is handled.</p>
              <p>The Services assist your billing but do not guarantee coverage or payment; your clinic remains responsible for reviewing results and for its billing decisions. You confirm the provider information you&apos;ve entered is accurate and that you&apos;re authorized to grant these authorizations. Full terms: Clinic Services Agreement and BAA (provided to you).</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <Field label="Your full name *"><input className="input" value={f.acceptName} onChange={e => set('acceptName', e.target.value)} placeholder="Jane Smith" /></Field>
              <Field label="Your title *"><input className="input" value={f.acceptTitle} onChange={e => set('acceptTitle', e.target.value)} placeholder="Owner / Office Manager" /></Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginTop: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={f.agreed} onChange={e => set('agreed', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#16A34A', marginTop: 2 }} />
              <span style={{ fontSize: '0.875rem', color: '#374151' }}>I have read and agree to the Ampify <strong>Clinic Services Agreement</strong> and <strong>Business Associate Agreement</strong>, and I am authorized to accept them on behalf of this clinic.</span>
            </label>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <button className="btn-secondary" onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0}>Back</button>
          {step < STEPS.length - 1
            ? <button className="btn-primary" onClick={next}>Continue</button>
            : <button className="btn-primary" onClick={finish} disabled={saving}>{saving ? 'Finishing…' : 'Finish setup'}</button>}
        </div>
      </div>
    </div>
  )
}

function H({ children }: { children: React.ReactNode }) { return <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0D1117', marginBottom: '1rem' }}>{children}</h2> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: '0.875rem' }}><label className="label">{label}</label>{children}</div> }
function Hint({ children }: { children: React.ReactNode }) { return <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.375rem' }}>{children}</p> }
