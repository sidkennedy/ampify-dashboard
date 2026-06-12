'use client'

import { useState } from 'react'
import { Call, EligibilityOutput, CodesOutput } from '@/types'
import { VERIFICATION_TEMPLATES, VerificationType } from '@/lib/verification-templates'

// ── tiny formatters ───────────────────────────────────────────────────────
const money = (n: number | null | undefined) => (n === null || n === undefined ? null : `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)
const pct = (n: number | null | undefined) => (n === null || n === undefined ? null : `${n}%`)
const yesno = (b: boolean | null | undefined) => (b === null || b === undefined ? null : b ? 'Yes' : 'No')
const has = (v: unknown) => v !== null && v !== undefined && v !== ''

function fmtDate(s: string | null | undefined) {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// A detail row that hides itself when there's no value (kills the wall of "—").
function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  if (!has(value)) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ color: '#6B7280', fontSize: '0.8125rem' }}>{label}</span>
      <span style={{ color: strong ? '#0D1117' : '#374151', fontSize: '0.875rem', fontWeight: strong ? 700 : 500, textAlign: 'right', maxWidth: '62%' }}>{value}</span>
    </div>
  )
}

function Card({ title, children, accent }: { title?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.75rem', padding: '1.125rem 1.25rem', borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      {title && <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{title}</h3>}
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string | null; color?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.75rem', padding: '0.875rem 1rem', minWidth: 0 }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: color ?? '#0D1117', marginTop: '0.25rem', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.125rem' }}>{sub}</div>}
    </div>
  )
}

export default function CallDetailTabs({ call }: { call: Call }) {
  const elig: EligibilityOutput | null = call.structured_output_eligibility
  const codes: CodesOutput | null = call.structured_output_codes
  const b = elig?.benefits
  const outcome = elig?.outcome

  const wasCall = !!call.vapi_call_id || !!call.transcript || call.channel === 'autonomous_call' || call.channel === 'hybrid_call'
  const isActive = /active|eligible/i.test(elig?.member?.eligibilityStatus ?? '')

  const [tab, setTab] = useState<'result' | 'codes' | 'transcript'>('result')
  const extraTabs = [
    codes?.requestedCodes?.length ? 'codes' : null,
    call.transcript ? 'transcript' : null,
  ].filter(Boolean) as string[]

  // ── HERO: the one thing the biller needs to know ─────────────────────────
  function Hero() {
    // Pending states (no result yet)
    if (call.status === 'in_progress') return <Banner color="#2563EB" bg="#EFF6FF" border="#BFDBFE" title="Verification in progress" body="Working on it now — results will appear here automatically when it's done." />
    if (call.status === 'scheduled') return <Banner color="#CA8A04" bg="#FEFCE8" border="#FDE68A" title="Scheduled" body="This will run automatically during insurance business hours. Results will appear here when complete." />
    if (call.status === 'queued' && !elig) return <Banner color="#16A34A" bg="#F0FDF4" border="#BBF7D0" title="Saved" body="Patient details saved. No further action needed." />

    // Resolved outcomes
    if (outcome?.status === 'redirected') {
      return <ActionBanner title="Verify elsewhere" reason={outcome.redirectReason} next={outcome.nextAction} phone={outcome.redirectPhone} />
    }
    if (outcome?.status === 'not_covered') {
      return <Banner color="#DC2626" bg="#FEF2F2" border="#FECACA" title="Not covered — patient is self-pay" body={outcome.nextAction ?? 'No coverage found for this service.'} />
    }
    if (outcome?.status === 'needs_callback' || outcome?.status === 'incomplete') {
      return <ActionBanner title="Needs follow-up" reason={outcome.redirectReason} next={outcome.nextAction} phone={outcome.redirectPhone} />
    }
    if (isActive || (b && Object.keys(b).some(k => has((b as Record<string, unknown>)[k])))) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.875rem', padding: '1rem 1.25rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#15803D', fontSize: '1.0625rem' }}>Active coverage — verified</div>
            <div style={{ color: '#166534', fontSize: '0.875rem' }}>{elig?.plan?.payerName ?? 'Coverage'}{elig?.plan?.planName ? ` · ${elig.plan.planName}` : ''}</div>
          </div>
        </div>
      )
    }
    return null
  }

  function Banner({ color, bg, border, title, body }: { color: string; bg: string; border: string; title: string; body: string }) {
    return (
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '0.875rem', padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 700, color, fontSize: '1rem' }}>{title}</div>
        <div style={{ color, fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.85 }}>{body}</div>
      </div>
    )
  }

  function ActionBanner({ title, reason, next, phone }: { title: string; reason?: string | null; next?: string | null; phone?: string | null }) {
    return (
      <div style={{ display: 'flex', gap: '1rem', background: '#FAF5FF', border: '2px solid #C4B5FD', borderRadius: '0.875rem', padding: '1.125rem 1.25rem' }}>
        <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>↪</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#6B21A8', fontSize: '1.0625rem', marginBottom: '0.25rem' }}>{title}</div>
          {has(reason) && <p style={{ color: '#581C87', fontSize: '0.875rem', margin: 0 }}>{reason}</p>}
          {has(next) && <p style={{ color: '#6B21A8', fontSize: '0.875rem', fontWeight: 600, margin: '0.375rem 0 0' }}>→ {next}</p>}
          {has(phone) && (
            <a href={`tel:${phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.625rem', background: '#7C3AED', color: 'white', fontWeight: 700, borderRadius: '0.5rem', padding: '0.375rem 0.875rem', textDecoration: 'none' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v3z" /></svg>
              {phone}
            </a>
          )}
        </div>
      </div>
    )
  }

  // ── Source / provenance line (channel-aware) ─────────────────────────────
  function SourceLine() {
    const when = fmtDate(call.ended_at) ?? fmtDate(call.updated_at)
    if (wasCall) {
      const dur = call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : null
      const bits = [
        call.channel === 'hybrid_call' ? 'Hybrid call (AI + biller)' : 'AI phone call',
        when, dur,
        elig?.callReference?.repName ? `Rep: ${elig.callReference.repName}` : null,
        elig?.callReference?.callReferenceNumber ? `Ref #: ${elig.callReference.callReferenceNumber}` : null,
        call.cost ? `$${Number(call.cost).toFixed(2)}` : null,
      ].filter(Boolean)
      return <SourcePill icon="📞" text={bits.join('  ·  ')} />
    }
    // electronic / refer-out
    return <SourcePill icon="⚡" text={`Pulled electronically${when ? `  ·  ${when}` : ''}  ·  no phone call`} />
  }
  function SourcePill({ icon, text }: { icon: string; text: string }) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '9999px', padding: '0.375rem 0.875rem', fontSize: '0.8125rem', color: '#6B7280' }}>
        <span aria-hidden>{icon}</span><span>{text}</span>
      </div>
    )
  }

  // ── Cost summary stat cards (what the patient owes) ───────────────────────
  const ded = b?.deductible, oop = b?.outOfPocketMax, coins = b?.coinsurance, cop = b?.copays
  const officeCopay = cop?.audiologyVisit ?? cop?.specialistVisit ?? cop?.hearingExam
  const statCards: React.ReactNode[] = []
  if (elig?.member?.eligibilityStatus) statCards.push(<StatCard key="cov" label="Coverage" value={elig.member.eligibilityStatus} color={isActive ? '#16A34A' : '#DC2626'} />)
  if (has(ded?.individualRemaining) || has(ded?.individualTotal)) statCards.push(<StatCard key="ded" label="Deductible (in-network)" value={money(ded?.individualRemaining ?? ded?.individualTotal)!} sub={has(ded?.individualRemaining) && has(ded?.individualTotal) ? `left of ${money(ded?.individualTotal)}` : 'individual'} />)
  if (has(oop?.individualRemaining) || has(oop?.individualTotal)) statCards.push(<StatCard key="oop" label="Out-of-pocket max" value={money(oop?.individualRemaining ?? oop?.individualTotal)!} sub={has(oop?.individualRemaining) && has(oop?.individualTotal) ? `left of ${money(oop?.individualTotal)}` : 'individual'} />)
  if (has(officeCopay)) statCards.push(<StatCard key="copay" label="Visit copay" value={money(officeCopay)!} sub="office / audiology" />)
  if (has(coins?.inNetworkPercent)) statCards.push(<StatCard key="coins" label="Coinsurance" value={pct(coins?.inNetworkPercent)!} sub={has(coins?.outOfNetworkPercent) ? `${coins?.outOfNetworkPercent}% out-of-network` : 'in-network'} />)

  // ── verification context bar ─────────────────────────────────────────────
  const vt = call.verification_type as VerificationType | null
  const tpl = vt && vt in VERIFICATION_TEMPLATES ? VERIFICATION_TEMPLATES[vt] : null
  const isHA = vt === 'hearing_aid'
  const isProcedural = vt === 'abr' || vt === 'apd' || vt === 'vestibular'
  const ha = b?.hearingAidBenefit

  const tabBtn = (t: string, lbl: string) => (
    <button onClick={() => setTab(t as 'result' | 'codes' | 'transcript')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem', background: tab === t ? '#0D1117' : 'transparent', color: tab === t ? 'white' : '#6B7280' }}>{lbl}</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Hero />

      {/* Source line */}
      <div><SourceLine /></div>

      {/* What the patient owes */}
      {statCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(statCards.length, 5)}, 1fr)`, gap: '0.75rem' }}>{statCards}</div>
      )}

      {/* Verification context */}
      {tpl && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', background: tpl.bgColor, border: `1px solid ${tpl.borderColor}`, borderRadius: '0.75rem', padding: '0.75rem 1.125rem' }}>
          <Ctx c={tpl.textColor} label="Type" value={tpl.label} />
          <Ctx c={tpl.textColor} label="CPT / HCPCS" value={call.codes_requested || tpl.cptCodes} mono />
          {has(call.date_of_service) && <Ctx c={tpl.textColor} label="Date of Service" value={call.date_of_service!} />}
          {has(call.plan_type) && <Ctx c={tpl.textColor} label="Plan Type" value={call.plan_type!} />}
          {has(call.state) && <Ctx c={tpl.textColor} label="State" value={call.state!} />}
        </div>
      )}

      {/* Tab bar — only if there's a call transcript or code-level data */}
      {extraTabs.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', background: '#F3F4F6', padding: '0.25rem', borderRadius: '0.625rem', width: 'fit-content' }}>
          {tabBtn('result', 'Details')}
          {codes?.requestedCodes?.length ? tabBtn('codes', 'Code-by-Code') : null}
          {call.transcript ? tabBtn('transcript', 'Transcript') : null}
        </div>
      )}

      {/* ── RESULT / DETAILS ── */}
      {tab === 'result' && (
        <>
          {!elig && call.status === 'completed' && (
            <Card><div style={{ color: '#9CA3AF', textAlign: 'center', padding: '1rem' }}>No benefit detail captured.</div></Card>
          )}
          {elig && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Coordination of benefits — who pays first. High priority, full width. */}
              {elig.coordinationOfBenefits?.primaryPayer && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '0.75rem', padding: '0.875rem 1.25rem' }}>
                  <span aria-hidden style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>🔀</span>
                  <div>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#9A3412', margin: '0 0 0.125rem' }}>
                      Coordination of benefits — {elig.coordinationOfBenefits.primaryPayer} pays first
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: '#7C2D12', margin: 0 }}>
                      {elig.coordinationOfBenefits.note ?? `${elig.plan?.payerName ?? 'This plan'} is secondary.`}
                      {elig.coordinationOfBenefits.primaryPolicyNumber ? ` · Primary policy #${elig.coordinationOfBenefits.primaryPolicyNumber}` : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Coverage + plan */}
              <Card title="Coverage">
                <Row label="Status" value={elig.member?.eligibilityStatus} strong />
                <Row label="Effective" value={elig.member?.eligibilityEffectiveDate} />
                <Row label="Ends" value={elig.member?.eligibilityEndDate} />
                <Row label="Plan" value={elig.plan?.planName} strong />
                <Row label="Plan type" value={elig.plan?.planType} />
                <Row label="Insurance type" value={elig.plan?.insuranceType} />
                <Row label="Payer" value={elig.plan?.payerName} />
                <Row label="Employer / group" value={elig.member?.groupName} />
                <Row label="Group #" value={elig.member?.groupNumber} />
                <Row label="In-network" value={yesno(elig.plan?.isInNetworkVerified)} />
                <Row label="Prior auth required" value={yesno(elig.plan?.priorAuthRequired)} />
                <Row label="Prior-auth / UM phone" value={elig.plan?.priorAuthPhone} />
                <Row label="Referral required" value={yesno(elig.plan?.referralRequired)} />
                <Row label="PCP required" value={yesno(elig.plan?.pcpRequired)} />
                <Row label="Funding" value={elig.plan?.fundingType} />
                <Row label="Gender" value={elig.member?.gender} />
                <Row label="Address" value={elig.member?.address} />
              </Card>

              {/* Patient responsibility detail */}
              <Card title="Patient responsibility">
                <Row label="Deductible — individual" value={money(ded?.individualTotal)} />
                <Row label="Deductible — remaining" value={money(ded?.individualRemaining)} strong />
                <Row label="Deductible — family" value={money(ded?.familyTotal)} />
                <Row label="Family remaining" value={money(ded?.familyRemaining)} />
                <Row label="Out-of-pocket — individual" value={money(oop?.individualTotal)} />
                <Row label="OOP remaining" value={money(oop?.individualRemaining)} strong />
                <Row label="Out-of-pocket — family" value={money(oop?.familyTotal)} />
                <Row label="Coinsurance (in-network)" value={pct(coins?.inNetworkPercent)} />
                <Row label="Coinsurance (out-of-network)" value={pct(coins?.outOfNetworkPercent)} />
                <Row label="Office / audiology copay" value={money(cop?.audiologyVisit)} />
                <Row label="Hearing exam copay" value={money(cop?.hearingExam)} />
              </Card>

              {/* Visit limits + exclusions — payer-dependent, captured electronically */}
              {((b?.limitations?.length ?? 0) > 0 || (b?.exclusions?.length ?? 0) > 0) && (
                <Card title="Limits & exclusions">
                  {b?.limitations?.map((l, i) => (
                    <Row key={`lim${i}`} label={l.service}
                      value={[l.cap, l.remaining ? `${l.remaining} left` : null].filter(Boolean).join(' · ') || l.note || '—'} />
                  ))}
                  {(b?.exclusions?.length ?? 0) > 0 && (
                    <div style={{ paddingTop: (b?.limitations?.length ?? 0) > 0 ? '0.625rem' : 0 }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B91C1C', margin: '0 0 0.25rem' }}>Not covered</p>
                      {b!.exclusions!.map((e, i) => (
                        <p key={`ex${i}`} style={{ fontSize: '0.8125rem', color: '#374151', margin: '0.125rem 0' }}>• {e}</p>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Hearing-aid section — only for HA verifications, only populated fields */}
              {isHA && ha && (
                <Card title="Hearing-aid benefit" accent="#15803D">
                  <Row label="Covered (medical/DME)" value={yesno(ha.covered)} strong />
                  <Row label="Allowance" value={money(ha.allowanceAmount)} />
                  <Row label="Allowance type" value={ha.allowanceType} />
                  <Row label="Frequency" value={ha.frequency} />
                  <Row label="Still available" value={yesno(ha.benefitStillAvailable)} />
                  <Row label="Last used" value={ha.benefitLastUsedDate} />
                  <Row label="Prior auth required" value={yesno(ha.requiresPriorAuth)} />
                  <Row label="Prior auth phone" value={ha.priorAuthPhone} />
                  <Row label="3rd-party / vendor" value={ha.vendorRestriction} />
                  <Row label="Deductible applies" value={yesno(ha.deductibleApplies)} />
                  <Row label="Copay" value={money(ha.copayAmount)} />
                  <Row label="Coinsurance" value={pct(ha.coinsurancePercent)} />
                  <Row label="Notes" value={ha.coverageNotes} />
                  {!has(ha.allowanceAmount) && !has(ha.frequency) && (
                    <p style={{ color: '#9CA3AF', fontSize: '0.75rem', margin: '0.5rem 0 0', fontStyle: 'italic' }}>The hearing-aid allowance and frequency aren&apos;t available electronically — see the result above for how to obtain them.</p>
                  )}
                </Card>
              )}

              {/* Procedural (ABR/APD/Vestibular) */}
              {isProcedural && (
                <Card title="Procedure coverage" accent="#7C3AED">
                  <Row label="Codes" value={call.codes_requested} />
                  <Row label="Medical-necessity policy" value={yesno(elig.plan?.medicalNecessityRequired)} />
                  <Row label="Prior auth required" value={yesno(elig.plan?.priorAuthRequired)} />
                  <p style={{ color: '#9CA3AF', fontSize: '0.75rem', margin: '0.5rem 0 0', fontStyle: 'italic' }}>Whether the specific codes are valid/billable and need prior auth is confirmed on a call — the eligibility foundation above is captured electronically.</p>
                </Card>
              )}

              {/* Audiology exam, if returned */}
              {b?.audiologyExam && has(b.audiologyExam.covered) && (
                <Card title="Audiology exam">
                  <Row label="Covered" value={yesno(b.audiologyExam.covered)} strong />
                  <Row label="Visit limit" value={b.audiologyExam.visitLimit} />
                  <Row label="Frequency limit" value={b.audiologyExam.frequencyLimit} />
                  <Row label="Details" value={b.audiologyExam.coverageDetails} />
                </Card>
              )}

              {has(elig.notes) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Card title="Notes"><p style={{ color: '#374151', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{elig.notes}</p></Card>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── CODE-BY-CODE ── */}
      {tab === 'codes' && codes?.requestedCodes?.length ? (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Code', 'Covered', 'Prior Auth', 'Referral', 'Deductible', 'Coinsurance', 'Copay', 'Freq.', 'Notes'].map(h => <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {codes.requestedCodes.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '0.75rem 0.875rem', fontFamily: 'monospace', fontWeight: 700 }}>{c.code}</td>
                  <td style={{ padding: '0.75rem 0.875rem' }}>{yesno(c.covered) ?? '—'}</td>
                  <td style={{ padding: '0.75rem 0.875rem' }}>{yesno(c.priorAuthRequired) ?? '—'}</td>
                  <td style={{ padding: '0.75rem 0.875rem' }}>{yesno(c.referralRequired) ?? '—'}</td>
                  <td style={{ padding: '0.75rem 0.875rem' }}>{yesno(c.deductibleApplies) ?? '—'}</td>
                  <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem' }}>{c.coinsurance ?? '—'}</td>
                  <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem' }}>{c.copay ?? '—'}</td>
                  <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem' }}>{c.frequencyLimits ?? '—'}</td>
                  <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: '#6B7280', maxWidth: 200 }}>{c.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ── TRANSCRIPT (calls only) ── */}
      {tab === 'transcript' && call.transcript && (
        <Card>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap', maxHeight: 600, overflowY: 'auto' }}>
            {call.transcript.split('\n').map((line, i) => {
              const isAI = line.startsWith('AI:'); const isUser = line.startsWith('User:')
              return <div key={i} style={{ marginBottom: '0.5rem' }}>{isAI && <span style={{ color: '#15803D', fontWeight: 600 }}>Ben: </span>}{isUser && <span style={{ color: '#2563EB', fontWeight: 600 }}>IVR/Rep: </span>}<span>{isAI ? line.slice(3) : isUser ? line.slice(5) : line}</span></div>
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

function Ctx({ label, value, c, mono }: { label: string; value: string; c: string; mono?: boolean }) {
  return (
    <div>
      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ fontWeight: 600, color: c, fontSize: '0.8125rem', marginTop: '0.125rem', fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  )
}
