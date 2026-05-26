'use client'

import { useState } from 'react'
import { Call, EligibilityOutput, CodesOutput } from '@/types'

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

  if (!elig && !codes && call.status !== 'completed' && call.status !== 'failed') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <svg width="24" height="24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v3z"/>
          </svg>
        </div>
        <p style={{ fontWeight: 600, color: '#0D1117', marginBottom: '0.5rem' }}>Call in progress</p>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Results will appear here when the call ends.</p>
      </div>
    )
  }

  return (
    <div>
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
                  <Row label="Vendor Restriction">{elig.benefits?.hearingAidBenefit?.vendorRestriction ?? '—'}</Row>
                  {elig.benefits?.hearingAidBenefit?.coverageNotes && (
                    <Row label="Notes">{elig.benefits.hearingAidBenefit.coverageNotes}</Row>
                  )}
                </Section>
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
