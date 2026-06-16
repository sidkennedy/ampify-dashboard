// Bulletproof-script / checklist generator.
//
// Given a verification case (the Call row + its electronic 271 result), produce a
// structured checklist of *only the questions still missing* — i.e. the rep call
// guide. Each item doubles as a capture slot (eligibility_path) so the VA's answers
// write straight back into structured_output_eligibility. Same philosophy as
// GapCapture: never re-ask anything the electronic check already returned.
//
// Output is deterministic and template-driven; an LLM pass can later *augment*
// (rephrase / add payer-specific nuance) but should never be required for a baseline.

import type { Call, EligibilityOutput, VerificationType } from '@/types'

export type AnswerType = 'boolean' | 'money' | 'percent' | 'text' | 'frequency' | 'select'

export interface ChecklistItem {
  itemKey: string
  question: string
  rationale?: string
  answerType: AnswerType
  options?: string[]
  eligibilityPath?: string // dot-path into EligibilityOutput for write-back
  priority: number // lower = asked first
  source: 'generated' | 'biller' | 'va'
}

// A required piece of knowledge for a verification type. `path` is checked against
// the 271 result; if already filled, we DON'T generate a question for it.
interface Requirement {
  itemKey: string
  question: string
  rationale?: string
  answerType: AnswerType
  options?: string[]
  path: string // EligibilityOutput path that satisfies this requirement
  priority: number
  // optional gate — only include when this returns true for the case
  when?: (elig: EligibilityOutput | null) => boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

function isFilled(elig: EligibilityOutput | null, path: string): boolean {
  const v = getPath(elig, path)
  return v !== undefined && v !== null && v !== ''
}

function medicarePrimary(elig: EligibilityOutput | null): boolean {
  const cob = elig?.coordinationOfBenefits
  if (!cob) return false
  return Boolean(cob.isSecondary) || /medicare/i.test(cob.primaryPayer ?? '')
}

function outOfNetwork(elig: EligibilityOutput | null): boolean {
  return elig?.plan?.isInNetworkVerified === false
}

// ── Requirement registries ───────────────────────────────────────────────────
// Hearing-aid is the richest path; the diagnostic/ABR/etc. types fall back to a
// per-code loop below.
const HEARING_AID_REQS: Requirement[] = [
  { itemKey: 'ha_covered', question: 'Are hearing aids a covered benefit under this plan?', rationale: 'Confirms the benefit exists at all before pricing.', answerType: 'boolean', path: 'benefits.hearingAidBenefit.covered', priority: 10 },
  { itemKey: 'ha_allowance', question: 'What is the hearing aid allowance, and is it per ear or per pair?', rationale: 'Drives the patient quote.', answerType: 'money', path: 'benefits.hearingAidBenefit.allowanceAmount', priority: 20 },
  { itemKey: 'ha_frequency', question: 'How often is a new hearing aid covered? (e.g. once every 3 years)', rationale: 'Replacement eligibility.', answerType: 'frequency', path: 'benefits.hearingAidBenefit.frequency', priority: 30 },
  { itemKey: 'ha_benefit_available', question: 'Has the hearing aid benefit already been used this period? If so, when?', rationale: 'A covered benefit may already be exhausted.', answerType: 'text', path: 'benefits.hearingAidBenefit.benefitStillAvailable', priority: 35 },
  { itemKey: 'ha_prior_auth', question: 'Is prior authorization required for hearing aids (HCPCS V5261)? If so, what documentation and turnaround?', rationale: 'Blocks dispensing if missed.', answerType: 'boolean', path: 'benefits.hearingAidBenefit.requiresPriorAuth', priority: 40 },
  { itemKey: 'ha_vendor', question: 'Is there a carve-out vendor (TruHearing, NationsHearing, etc.) or required network for hearing aids?', rationale: 'Carve-outs route the claim elsewhere entirely.', answerType: 'text', path: 'benefits.hearingAidBenefit.vendorRestriction', priority: 50 },
  { itemKey: 'ha_cost_share', question: 'What is the patient cost share for hearing aids — copay or coinsurance %?', rationale: 'Needed for the quote.', answerType: 'percent', path: 'benefits.hearingAidBenefit.coinsurancePercent', priority: 60 },
  { itemKey: 'ha_deductible', question: 'Does the plan deductible apply to hearing aids?', rationale: 'Affects out-of-pocket.', answerType: 'boolean', path: 'benefits.hearingAidBenefit.deductibleApplies', priority: 65 },
  { itemKey: 'ha_codes', question: 'Which HCPCS codes are covered — V5261, V5257, V5260? Any code-specific limits?', rationale: 'Some plans are code-specific.', answerType: 'text', path: 'benefits.hearingAidBenefit.codesMentioned', priority: 70 },
  // Conditional — only when the situation calls for it
  { itemKey: 'cob_medicare', question: 'Since Medicare is primary and this plan is secondary, how are hearing-aid claims coordinated — is a Medicare EOB/denial required first?', rationale: 'Crossover rules vary; wrong order = denial.', answerType: 'text', path: 'coordinationOfBenefits.note', priority: 15, when: medicarePrimary },
  { itemKey: 'oon_details', question: 'This provider looks out-of-network — how does coverage differ (allowance, cost share) out-of-network?', rationale: 'OON can gut the allowance.', answerType: 'text', path: 'benefits.outOfNetwork.details', priority: 55, when: outOfNetwork },
]

// Always asked at the end of any call, regardless of type — documentation.
const CALL_REFERENCE_REQS: Requirement[] = [
  { itemKey: 'ref_rep_name', question: "Get the representative's name.", rationale: 'Required for the audit trail.', answerType: 'text', path: 'callReference.repName', priority: 900 },
  { itemKey: 'ref_call_number', question: 'Get the call reference / ticket number.', rationale: 'Proof of verification if the claim is later disputed.', answerType: 'text', path: 'callReference.callReferenceNumber', priority: 910 },
]

// Generic per-code requirements for diagnostic / ABR / APD / vestibular.
function codeReqs(code: string, i: number): Requirement[] {
  const base = 100 + i * 10
  // These paths are illustrative; the codes capture form writes to structured_output_codes.
  return [
    { itemKey: `code_${code}_covered`, question: `Is CPT ${code} a covered service?`, answerType: 'boolean', path: `__code.${code}.covered`, priority: base },
    { itemKey: `code_${code}_auth`, question: `Does ${code} require prior authorization or a referral?`, answerType: 'boolean', path: `__code.${code}.priorAuthRequired`, priority: base + 1 },
    { itemKey: `code_${code}_cost`, question: `What is the patient cost share for ${code} (copay / coinsurance), and does the deductible apply?`, answerType: 'text', path: `__code.${code}.copay`, priority: base + 2 },
    { itemKey: `code_${code}_limits`, question: `Any frequency limits or dollar caps on ${code}?`, answerType: 'text', path: `__code.${code}.frequencyLimits`, priority: base + 3 },
  ]
}

// ── Entry point ───────────────────────────────────────────────────────────────
export function generateChecklist(call: Pick<Call, 'verification_type' | 'codes_requested' | 'structured_output_eligibility'>): ChecklistItem[] {
  const elig = call.structured_output_eligibility ?? null
  const type = (call.verification_type ?? 'diagnostic') as VerificationType

  let reqs: Requirement[]
  if (type === 'hearing_aid') {
    reqs = HEARING_AID_REQS
  } else {
    const codes = (call.codes_requested ?? '')
      .split(/[,\s]+/)
      .map(c => c.trim())
      .filter(Boolean)
    reqs = codes.flatMap((c, i) => codeReqs(c, i))
  }

  const items: ChecklistItem[] = reqs
    // drop conditional items that don't apply to this case
    .filter(r => (r.when ? r.when(elig) : true))
    // drop anything the electronic 271 already answered (code paths use __code sentinel → always ask)
    .filter(r => r.path.startsWith('__code') || !isFilled(elig, r.path))
    .concat(CALL_REFERENCE_REQS)
    .map(r => ({
      itemKey: r.itemKey,
      question: r.question,
      rationale: r.rationale,
      answerType: r.answerType,
      options: r.options,
      eligibilityPath: r.path.startsWith('__code') ? undefined : r.path,
      priority: r.priority,
      source: 'generated' as const,
    }))
    .sort((a, b) => a.priority - b.priority)

  return items
}

// Render the structured checklist as a readable script the VA can read verbatim.
export function renderScript(
  call: Pick<Call, 'patient_name' | 'member_id' | 'verification_type'>,
  items: ChecklistItem[],
): string {
  const typeLabel = call.verification_type === 'hearing_aid' ? 'hearing aid' : 'service'
  const intro =
    `Hi, I'm calling to verify ${typeLabel} benefits for ${call.patient_name}, member ID ${call.member_id}. ` +
    `I've confirmed eligibility and general benefits electronically — I just need the ${typeLabel}-specific details below.`
  const questions = items
    .filter(i => !i.itemKey.startsWith('ref_'))
    .map((i, n) => `${n + 1}. ${i.question}`)
    .join('\n')
  const closing = `Finally, can I get your name and a call reference number for our records?`
  return `${intro}\n\n${questions}\n\n${closing}`
}
