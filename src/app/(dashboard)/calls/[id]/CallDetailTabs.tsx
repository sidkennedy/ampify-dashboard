'use client'

import { useState } from 'react'
import { Call, EligibilityOutput, CodesOutput } from '@/types'
import { VERIFICATION_TEMPLATES, VerificationType } from '@/lib/verification-templates'

function YesNo({ val }: { val: boolean | null | undefined }) {
  if (val === null || val === undefined) return <span style={{ color: '#9CA3AF' }}>—</span>
  return <span style={{ color: val ? '#16A34A' : '#DC2626', fontWeight: 500 }}>{val ? 'Yes' : 'No'}</span>
}

function Dollar({ val }: { val: number | null | undefined }) {
  if (val === null || val === undefined) return <span style={{ color: '#9CA3AF' }}>—</span>
  return <span>${val.toLocaleString()}</span>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0', borderBottom: '1px solid #F9FAFB' }}>
      <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ color: '#0D1117', fontSize: '0.875rem', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{children}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{title}</h3>
      <div className="card" style={{ padding: '0 1.25rem' }}>{children}</div>
    </div>
  )
}

function ConfidenceBadge({ val }: { val: string | null | undefined }) {
  if (!val) return null
  const colors: Record<string, string> = { high: 'badge-green', medium: 'badge-yellow', low: 'badge-red' }
  return <span className={`badge ${colors[val] ?? 'badge-gray'}`}>{val} confidence</span>
}

export default function CallDetailTabs({ call }: { call: Call }) {
  const [tab, setTab] = useState<'overview' | 'codes' | 'transcript'>('overview')
  const elig: EligibilityOutput | null = call.structured_output_eligibility
  const codes: CodesOutput | null = call.structured_output_codes

  const tabStyle = (t: string) => ({
    padding: '0.625rem 1.25rem',
    borderRadius: '0.5rem',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    border: 'none',
    background: tab === t ? '#0D1117' : 'transparent',
    color: tab === t ? 'white' : '#6B7280',
    transition: 'all 0.15s',
  })

  // Status banner — shown above the tabs for non-completed calls
  const statusBanner = () => {
    if (call.status === 'queued') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, color: '#15803D', marginBottom: '0.25rem' }}>Thank you — data submitted for testing</p>
            <p style={{ color: '#166534', fontSize: '0.875rem' }}>Patient details have been saved successfully. No further action needed from you.</p>
          </div>
        </div>
      )
    }
    if (call.status === 'scheduled') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', background: '#FEFCE8', border: '1px solid #FDE68A', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEF9C3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" fill="none" stroke="#CA8A04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, color: '#92400E', marginBottom: '0.25rem' }}>Call scheduled</p>
            <p style={{ color: '#78350F', fontSize: '0.875rem' }}>This call will be placed automatically during insurance business hours. Results will appear here once complete.</p>
          </div>
        </div>
      )
    }
    if (call.status === 'in_progress') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v3z"/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, color: '#1D4ED8', marginBottom: '0.25rem' }}>Call in progress</p>
            <p style={{ color: '#1E40AF', fontSize: '0.875rem' }}>The AI agent is on the call now. Results will appear here automatically when it ends.</p>
          </div>
        </div>
      )
    }
    return null
  }

  // Verification type info bar
  const verificationBar = () => {
    const vt = call.verification_type
    if (!vt || !(vt in VERIFICATION_TEMPLATES)) return null
    const t = VERIFICATION_TEMPLATES[vt as VerificationType]
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
        background: t.bgColor, border: `1px solid ${t.borderColor}`,
        borderRadius: '0.75rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem',
      }}>
        <div>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Type</span>
          <div style={{ fontWeight: 700, color: t.textColor, fontSize: '0.9375rem', marginTop: '0.125rem' }}>{t.label}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPT / HCPCS</span>
          <div style={{ fontFamily: 'monospace', fontWeight: 600, color: t.textColor, fontSize: '0.8125rem', marginTop: '0.125rem' }}>{t.cptCodes}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosis</span>
          <div style={{ fontFamily: 'monospace', fontWeight: 600, color: t.textColor, fontSize: '0.8125rem', marginTop: '0.125rem' }}>{t.diagnosisCode}</div>
        </div>
        {call.date_of_service && (
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date of Service</span>
            <div style={{ fontWeight: 600, color: t.textColor, fontSize: '0.8125rem', marginTop: '0.125rem' }}>{call.date_of_service}</div>
          </div>
        )}
        {call.plan_type && (
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan Type</span>
            <div style={{ fontWeight: 600, color: t.textColor, fontSize: '0.8125rem', marginTop: '0.125rem' }}>{call.plan_type}</div>
          </div>
        )}
        {call.state && (
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: t.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>State</span>
            <div style={{ fontWeight: 600, color: t.textColor, fontSize: '0.8125rem', marginTop: '0.125rem' }}>{call.state}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {verificationBar()}
      {statusBanner()}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.375rem', background: '#F3F4F6', padding: '0.375rem', borderRadius: '0.75rem', marginBottom: '1.5rem', width: 'fit-content' }}>
        <button style={tabStyle('overview')} onClick={() => setTab('overview')}>Overview</button>
        <button style={tabStyle('codes')} onClick={() => setTab('codes')}>Code-by-Code</button>
        <button style={tabStyle('transcript')} onClick={() => setTab('transcript')}>Transcript</button>
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div>
          {!elig ? (
            <div className="card" style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem' }}>No eligibility data captured for this call.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <Section title="Member">
                  <Row label="Eligibility Status"><span style={{ color: elig.member?.eligibilityStatus === 'active' || elig.member?.eligibilityStatus === 'Eligible' ? '#16A34A' : '#DC2626', fontWeight: 600 }}>{elig.member?.eligibilityStatus ?? '—'}</span></Row>
                  <Row label="Effective Date">{elig.member?.eligibilityEffectiveDate ?? '—'}</Row>
                  <Row label="End Date">{elig.member?.eligibilityEndDate ?? '—'}</Row>
                  <Row label="Coverage Level">{elig.member?.coverageLevel ?? '—'}</Row>
                  <Row label="Group Number">{elig.member?.groupNumber ?? '—'}</Row>
                </Section>

                <Section title="Plan">
                  <Row label="Payer">{elig.plan?.payerName ?? '—'}</Row>
                  <Row label="Plan Name">{elig.plan?.planName ?? '—'}</Row>
                  <Row label="Plan Type">{elig.plan?.planType ?? '—'}</Row>
                  <Row label="Network">{elig.plan?.networkName ?? '—'}</Row>
                  <Row label="In-Network Verified"><YesNo val={elig.plan?.isInNetworkVerified} /></Row>
                  <Row label="Benefit Period">{elig.benefits?.benefitPeriod ?? '—'}</Row>
                  <Row label="Prior Auth Required"><YesNo val={elig.plan?.priorAuthRequired} /></Row>
                  <Row label="Referral Required"><YesNo val={elig.plan?.referralRequired} /></Row>
                </Section>

                <Section title="Call Reference">
                  <Row label="Rep Name">{elig.callReference?.repName ?? '—'}</Row>
                  <Row label="Reference Number">{elig.callReference?.callReferenceNumber ?? '—'}</Row>
                  <Row label="Department">{elig.callReference?.department ?? '—'}</Row>
                  <Row label="Confidence"><ConfidenceBadge val={elig.confidence} /></Row>
                </Section>
              </div>

              <div>
                <Section title="Deductible">
                  <Row label="Individual Total"><Dollar val={elig.benefits?.deductible?.individualTotal} /></Row>
                  <Row label="Individual Remaining"><Dollar val={elig.benefits?.deductible?.individualRemaining} /></Row>
                  <Row label="Family Total"><Dollar val={elig.benefits?.deductible?.familyTotal} /></Row>
                  <Row label="Family Remaining"><Dollar val={elig.benefits?.deductible?.familyRemaining} /></Row>
                  <Row label="Applies to Audiology"><YesNo val={elig.benefits?.deductible?.appliesToAudiology} /></Row>
                </Section>

                <Section title="Out-of-Pocket Max">
                  <Row label="Individual Total"><Dollar val={elig.benefits?.outOfPocketMax?.individualTotal} /></Row>
                  <Row label="Individual Remaining"><Dollar val={elig.benefits?.outOfPocketMax?.individualRemaining} /></Row>
                  <Row label="Family Total"><Dollar val={elig.benefits?.outOfPocketMax?.familyTotal} /></Row>
                  <Row label="Family Remaining"><Dollar val={elig.benefits?.outOfPocketMax?.familyRemaining} /></Row>
                </Section>

                <Section title="Copays & Coinsurance">
                  <Row label="In-Network Coinsurance">{elig.benefits?.coinsurance?.inNetworkPercent != null ? `${elig.benefits.coinsurance.inNetworkPercent}%` : '—'}</Row>
                  <Row label="Out-of-Network Coinsurance">{elig.benefits?.coinsurance?.outOfNetworkPercent != null ? `${elig.benefits.coinsurance.outOfNetworkPercent}%` : '—'}</Row>
                  <Row label="Hearing Exam Copay">{elig.benefits?.copays?.hearingExam != null ? `$${elig.benefits.copays.hearingExam}` : '—'}</Row>
                  <Row label="Audiology Visit Copay">{elig.benefits?.copays?.audiologyVisit != null ? `$${elig.benefits.copays.audiologyVisit}` : '—'}</Row>
                </Section>

                <Section title="Hearing Aid Benefit">
                  <Row label="Covered"><YesNo val={elig.benefits?.hearingAidBenefit?.covered} /></Row>
                  <Row label="Allowance"><Dollar val={elig.benefits?.hearingAidBenefit?.allowanceAmount} /></Row>
                  <Row label="Allowance Type">{elig.benefits?.hearingAidBenefit?.allowanceType ?? '—'}</Row>
                  <Row label="Frequency">{elig.benefits?.hearingAidBenefit?.frequency ?? '—'}</Row>
                  <Row label="Prior Auth Required"><YesNo val={elig.benefits?.hearingAidBenefit?.requiresPriorAuth} /></Row>
                  <Row label="Vendor / 3rd Party Restriction">{elig.benefits?.hearingAidBenefit?.vendorRestriction ?? '—'}</Row>
                  <Row label="Age Restrictions">{elig.benefits?.hearingAidBenefit?.ageRestrictions ?? '—'}</Row>
                  <Row label="Deductible Applies"><YesNo val={elig.benefits?.hearingAidBenefit?.deductibleApplies} /></Row>
                  {elig.benefits?.hearingAidBenefit?.coverageNotes && (
                    <Row label="Notes">{elig.benefits.hearingAidBenefit.coverageNotes}</Row>
                  )}
                </Section>

                {/* ABR / APD specific */}
                {(call.verification_type === 'abr' || call.verification_type === 'apd') && (
                  <Section title="Medical Policy">
                    <Row label="Corporate Medical Policies Apply">{elig.plan?.medicalNecessityRequired != null ? <YesNo val={elig.plan.medicalNecessityRequired} /> : <span style={{ color: '#9CA3AF' }}>—</span>}</Row>
                  </Section>
                )}

                {/* Audiology-specific exam details */}
                {elig.benefits?.audiologyExam?.covered !== undefined && (
                  <Section title="Audiology Exam">
                    <Row label="Covered"><YesNo val={elig.benefits.audiologyExam.covered} /></Row>
                    <Row label="Visit Limit">{elig.benefits.audiologyExam.visitLimit ?? '—'}</Row>
                    <Row label="Frequency Limit">{elig.benefits.audiologyExam.frequencyLimit ?? '—'}</Row>
                    <Row label="Coverage Details">{elig.benefits.audiologyExam.coverageDetails ?? '—'}</Row>
                  </Section>
                )}
              </div>

              {elig.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Section title="Notes">
                    <div style={{ padding: '0.875rem 0', color: '#374151', fontSize: '0.875rem', lineHeight: 1.6 }}>{elig.notes}</div>
                  </Section>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Code-by-Code tab */}
      {tab === 'codes' && (
        <div>
          {!codes || !codes.requestedCodes?.length ? (
            <div className="card" style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem' }}>No code-by-code data captured for this call.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['Code', 'Covered', 'Prior Auth', 'Referral', 'Deductible', 'Coinsurance', 'Copay', 'Freq. Limit', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {codes.requestedCodes.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '0.875rem 1rem' }}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0D1117', fontSize: '0.9375rem' }}>{c.code}</span></td>
                      <td style={{ padding: '0.875rem 1rem' }}><YesNo val={c.covered} /></td>
                      <td style={{ padding: '0.875rem 1rem' }}><YesNo val={c.priorAuthRequired} /></td>
                      <td style={{ padding: '0.875rem 1rem' }}><YesNo val={c.referralRequired} /></td>
                      <td style={{ padding: '0.875rem 1rem' }}><YesNo val={c.deductibleApplies} /></td>
                      <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem' }}>{c.coinsurance ?? '—'}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem' }}>{c.copay ?? '—'}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#374151', fontSize: '0.875rem' }}>{c.frequencyLimits ?? '—'}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#6B7280', fontSize: '0.8125rem', maxWidth: 200 }}>{c.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transcript tab */}
      {tab === 'transcript' && (
        <div className="card">
          {!call.transcript ? (
            <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem 0' }}>No transcript available.</p>
          ) : (
            <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap', maxHeight: 600, overflowY: 'auto' }}>
              {call.transcript.split('\n').map((line, i) => {
                const isAI = line.startsWith('AI:')
                const isUser = line.startsWith('User:')
                return (
                  <div key={i} style={{ marginBottom: '0.5rem' }}>
                    {isAI && <span style={{ color: '#00C853', fontWeight: 600 }}>AI: </span>}
                    {isUser && <span style={{ color: '#2563EB', fontWeight: 600 }}>IVR/Rep: </span>}
                    <span>{isAI ? line.slice(3) : isUser ? line.slice(5) : line}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
