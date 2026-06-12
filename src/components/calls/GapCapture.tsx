'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Call, EligibilityOutput } from '@/types'

const money = (n: number | null | undefined) => (n == null ? null : `$${Number(n).toLocaleString()}`)

// A read-only chip for something we already pulled electronically.
function Known({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
      <p style={{ fontSize: '0.6875rem', color: '#15803D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '0.875rem', color: '#0D1117', fontWeight: 600, margin: '0.125rem 0 0' }}>{value}</p>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem', display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#0D1117', background: '#fff' }

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}{hint && <span style={{ fontWeight: 400, color: '#9CA3AF' }}> · {hint}</span>}</label>
      {children}
    </div>
  )
}

export default function GapCapture({ call }: { call: Call }) {
  const router = useRouter()
  const elig = call.structured_output_eligibility
  const b = elig?.benefits
  const ha = b?.hearingAidBenefit
  const isHA = call.verification_type === 'hearing_aid'

  // Editable "from the call" state — seeded from anything already captured so re-edits don't lose data.
  const [covered, setCovered] = useState<string>(ha?.covered == null ? '' : ha.covered ? 'yes' : 'no')
  const [allowance, setAllowance] = useState<string>(ha?.allowanceAmount?.toString() ?? '')
  const [frequency, setFrequency] = useState<string>(ha?.frequency ?? '')
  const [vendor, setVendor] = useState<string>(ha?.vendorRestriction ?? '')
  const [coinsurance, setCoinsurance] = useState<string>(ha?.coinsurancePercent?.toString() ?? '')
  const [copay, setCopay] = useState<string>(ha?.copayAmount?.toString() ?? '')
  const [priorAuth, setPriorAuth] = useState<string>(
    (isHA ? ha?.requiresPriorAuth : elig?.plan?.priorAuthRequired) == null ? '' : (isHA ? ha?.requiresPriorAuth : elig?.plan?.priorAuthRequired) ? 'yes' : 'no',
  )
  const [referral, setReferral] = useState<string>(elig?.plan?.referralRequired == null ? '' : elig?.plan?.referralRequired ? 'yes' : 'no')
  const [repName, setRepName] = useState<string>(elig?.callReference?.repName ?? '')
  const [refNumber, setRefNumber] = useState<string>(elig?.callReference?.callReferenceNumber ?? '')
  const [notes, setNotes] = useState<string>(elig?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
  const tri = (s: string) => (s === '' ? undefined : s === 'yes')

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    const patch: Partial<EligibilityOutput> = {
      benefits: {
        ...(isHA ? {
          hearingAidBenefit: {
            covered: tri(covered),
            allowanceAmount: num(allowance),
            frequency: frequency || undefined,
            vendorRestriction: vendor || undefined,
            coinsurancePercent: num(coinsurance),
            copayAmount: num(copay),
            requiresPriorAuth: tri(priorAuth),
          },
        } : {}),
      },
      plan: {
        ...(isHA ? {} : { priorAuthRequired: tri(priorAuth), referralRequired: tri(referral) }),
      },
      callReference: { repName: repName || undefined, callReferenceNumber: refNumber || undefined },
      notes: notes || undefined,
    }
    try {
      const res = await fetch(`/api/calls/${call.id}/capture`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, markComplete: true }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed'); return }
      setSaved(true)
      router.refresh()
    } catch { setError('Network error — please try again') }
    finally { setSaving(false) }
  }

  const knownChips = [
    <Known key="net" label="In network" value={elig?.plan?.isInNetworkVerified == null ? null : elig.plan.isInNetworkVerified ? 'Yes' : 'No'} />,
    <Known key="status" label="Coverage" value={elig?.member?.eligibilityStatus} />,
    <Known key="plan" label="Plan type" value={elig?.plan?.planType} />,
    <Known key="ded" label="Deductible (ind)" value={money(b?.deductible?.individualTotal)} />,
    <Known key="dedr" label="Deductible left" value={money(b?.deductible?.individualRemaining)} />,
    <Known key="oop" label="Out-of-pocket (ind)" value={money(b?.outOfPocketMax?.individualTotal)} />,
    <Known key="oopr" label="OOP left" value={money(b?.outOfPocketMax?.individualRemaining)} />,
    <Known key="coin" label="Coinsurance (in-net)" value={b?.coinsurance?.inNetworkPercent == null ? null : `${b.coinsurance.inNetworkPercent}%`} />,
    <Known key="copay" label="Visit copay" value={money(b?.copays?.audiologyVisit ?? b?.copays?.specialistVisit ?? b?.copays?.hearingExam)} />,
  ].filter(Boolean)
  const hasKnown = knownChips.length > 0

  return (
    <div className="card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.25rem' }}>Call capture</h2>
      <p style={{ fontSize: '0.8125rem', color: '#6B7280', marginBottom: '1rem' }}>
        Everything green is already pulled electronically — don&apos;t re-ask it. Only fill the boxes below with what the rep tells you.
      </p>

      {hasKnown && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>✓ Already on file (electronic)</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>{knownChips}</div>
        </div>
      )}

      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
        ＋ Capture from this call {isHA ? '(hearing-aid specifics)' : ''}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem' }}>
        {isHA ? (
          <>
            <Field label="Hearing aids covered?">
              <select style={inputStyle} value={covered} onChange={e => setCovered(e.target.value)}>
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </Field>
            <Field label="Allowance / max $" hint="per ear or total">
              <input style={inputStyle} inputMode="numeric" placeholder="e.g. 2500" value={allowance} onChange={e => setAllowance(e.target.value)} />
            </Field>
            <Field label="Frequency" hint="e.g. 1 / 3 yrs">
              <input style={inputStyle} placeholder="every 3 years" value={frequency} onChange={e => setFrequency(e.target.value)} />
            </Field>
            <Field label="Carve-out vendor" hint="TruHearing, etc.">
              <input style={inputStyle} placeholder="none / TruHearing" value={vendor} onChange={e => setVendor(e.target.value)} />
            </Field>
            <Field label="Coinsurance %">
              <input style={inputStyle} inputMode="numeric" placeholder="20" value={coinsurance} onChange={e => setCoinsurance(e.target.value)} />
            </Field>
            <Field label="Copay $">
              <input style={inputStyle} inputMode="numeric" placeholder="0" value={copay} onChange={e => setCopay(e.target.value)} />
            </Field>
            <Field label="Prior auth required?">
              <select style={inputStyle} value={priorAuth} onChange={e => setPriorAuth(e.target.value)}>
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Prior auth required?">
              <select style={inputStyle} value={priorAuth} onChange={e => setPriorAuth(e.target.value)}>
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </Field>
            <Field label="Referral required?">
              <select style={inputStyle} value={referral} onChange={e => setReferral(e.target.value)}>
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </Field>
          </>
        )}
        <Field label="Rep name">
          <input style={inputStyle} placeholder="who you spoke to" value={repName} onChange={e => setRepName(e.target.value)} />
        </Field>
        <Field label="Reference #">
          <input style={inputStyle} placeholder="call ref number" value={refNumber} onChange={e => setRefNumber(e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: '0.875rem' }}>
        <Field label="Notes" hint="anything else the rep said">
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginTop: '1rem' }}>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: '0.875rem' }}>
          {saving ? 'Saving…' : 'Save call results'}
        </button>
        {saved && <span style={{ color: '#15803D', fontSize: '0.8125rem', fontWeight: 600 }}>✓ Saved</span>}
        {error && <span style={{ color: '#DC2626', fontSize: '0.8125rem' }}>{error}</span>}
      </div>
    </div>
  )
}
