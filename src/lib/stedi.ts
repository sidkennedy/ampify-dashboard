// Stedi real-time eligibility (270/271) client.
// Docs: https://www.stedi.com/docs/healthcare/send-eligibility-checks
// Endpoint auth header is the raw API key (NOT "Bearer ..."). Dates are YYYYMMDD.

const STEDI_BASE = 'https://healthcare.us.stedi.com/2024-04-01'
const STEDI_API_KEY = process.env.STEDI_API_KEY!

// Cost per Stedi eligibility transaction. Stedi doesn't return a cost in the
// response, so we estimate it. Conservative default; override with the real
// invoice rate via STEDI_COST_PER_CHECK. Tiered pricing drops with volume.
export const STEDI_COST_PER_CHECK = Number(process.env.STEDI_COST_PER_CHECK ?? '0.25')

import type { VerificationType } from './verification-templates'
import type { EligibilityOutput } from '@/types'

// ── Service Type Codes per verification type ─────────────────────────────
// '30' = general/health-benefit-plan-coverage → returns the FULL benefit dump on
//        every payer tested (Excellus 87, Aetna 37, UHC 55, UMR 303 lines).
// CRITICAL (verified 2026-06-11): do NOT add STC '71' (audiology). Payers that
//   itemize by service type (e.g. UMR) STARVE the response when 71 is included —
//   UMR returned 303 lines for [30] but 0/errored for [30,71]. Payers that ignore
//   71 (Aetna/Excellus) returned the IDENTICAL result with or without it. So 71 is
//   either useless or harmful → never send it.
// 'DM' = Durable Medical Equipment → safe to add for hearing aids; adds DME
//   cost-share (verified not to starve UMR: [30,DM] returned 27 lines).
const SERVICE_TYPE_CODES: Record<VerificationType, string[]> = {
  diagnostic: ['30'],
  hearing_aid: ['30', 'DM'],
  abr: ['30'],
  apd: ['30'],
  vestibular: ['30'],
  bcbs_oos: ['30'],
}

// ── Helpers ──────────────────────────────────────────────────────────────
/** Convert an ISO-ish date ("1980-01-01", "1980/01/01", or already "19800101") to Stedi's YYYYMMDD. */
export function toStediDate(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error(`Cannot convert "${raw}" to YYYYMMDD — got ${digits.length} digits, expected 8.`)
  }
  return digits
}

export function serviceTypeCodesFor(type: VerificationType): string[] {
  return SERVICE_TYPE_CODES[type] ?? ['30']
}

// ── Types ────────────────────────────────────────────────────────────────
export interface StediEligibilityParams {
  /** Stedi payer id / primary payer id / alias (e.g. "aetna", "00803"). */
  tradingPartnerServiceId: string
  providerNpi: string
  providerOrganizationName: string
  // Subscriber = the patient (adults). At least one of memberId / dateOfBirth / lastName required.
  subscriberFirstName?: string
  subscriberLastName?: string
  subscriberDateOfBirth?: string // any parseable date; converted to YYYYMMDD
  subscriberMemberId?: string
  serviceTypeCodes: string[]
  /** Optional date of service, YYYYMMDD (defaults to payer's "today" if omitted). */
  dateOfService?: string
}

// 271 responses are large/variable; we keep the shape loose and pull what we need.
export interface StediBenefitInformation {
  code?: string
  name?: string
  serviceTypeCodes?: string[]
  serviceTypes?: string[]
  insuranceTypeCode?: string
  insuranceType?: string
  timeQualifierCode?: string
  timeQualifier?: string
  benefitAmount?: string
  benefitPercent?: string
  benefitQuantity?: string
  quantityQualifierCode?: string
  inPlanNetworkIndicatorCode?: string
  inPlanNetworkIndicator?: string
  coverageLevelCode?: string
  coverageLevel?: string
  additionalInformation?: Array<{ description?: string }>
  benefitsDateInformation?: Record<string, string>
  [k: string]: unknown
}

export interface StediEligibilityResponse {
  meta?: { traceId?: string; applicationMode?: string; [k: string]: unknown }
  controlNumber?: string
  tradingPartnerServiceId?: string
  provider?: Record<string, unknown>
  subscriber?: Record<string, unknown>
  payer?: { name?: string; payorIdentification?: string; [k: string]: unknown }
  planInformation?: Record<string, unknown>
  planDateInformation?: Record<string, unknown>
  benefitsInformation?: StediBenefitInformation[]
  errors?: Array<{ field?: string; code?: string; description?: string; followupAction?: string; location?: string; possibleResolutions?: string }>
  eligibilitySearchId?: string
  id?: string
  [k: string]: unknown
}

// AAA reject codes that indicate a NAME mismatch (not a member-not-found).
const NAME_ERROR_CODES = new Set(['65', '73'])

async function fireEligibility(params: StediEligibilityParams, includeFirstName: boolean): Promise<StediEligibilityResponse> {
  const body: Record<string, unknown> = {
    controlNumber: String(Math.floor(100000 + Math.random() * 900000)),
    tradingPartnerServiceId: params.tradingPartnerServiceId,
    provider: {
      organizationName: params.providerOrganizationName,
      npi: params.providerNpi,
    },
    subscriber: {
      ...(includeFirstName && params.subscriberFirstName ? { firstName: params.subscriberFirstName } : {}),
      ...(params.subscriberLastName ? { lastName: params.subscriberLastName } : {}),
      ...(params.subscriberDateOfBirth ? { dateOfBirth: toStediDate(params.subscriberDateOfBirth) } : {}),
      ...(params.subscriberMemberId ? { memberId: params.subscriberMemberId } : {}),
    },
    encounter: {
      serviceTypeCodes: params.serviceTypeCodes,
      ...(params.dateOfService ? { dateOfService: toStediDate(params.dateOfService) } : {}),
    },
  }

  const res = await fetch(`${STEDI_BASE}/change/medicalnetwork/eligibility/v3`, {
    method: 'POST',
    headers: { Authorization: STEDI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as StediEligibilityResponse
  if (!res.ok) {
    const msg = (json as { message?: string }).message || JSON.stringify(json).slice(0, 300)
    throw new Error(`Stedi eligibility error (HTTP ${res.status}): ${msg}`)
  }
  return json
}

// ── Core call ────────────────────────────────────────────────────────────
// Tries with the first name, and if the payer rejects on a NAME mismatch, retries
// with just memberId + DOB + lastName (the first name on file often differs —
// nicknames, hyphenation, maiden names). Member ID + DOB is enough to match.
export async function checkEligibility(params: StediEligibilityParams): Promise<StediEligibilityResponse> {
  let transactions = 1
  const first = await fireEligibility(params, true)
  const nameRejected = (first.errors ?? []).some(e => e.code && NAME_ERROR_CODES.has(e.code))
  const canRetry = nameRejected && !!params.subscriberFirstName && !!(params.subscriberMemberId && params.subscriberDateOfBirth)
  let chosen = first
  if (canRetry) {
    transactions = 2
    const retry = await fireEligibility(params, false)
    if (eligibilityHasBenefits(retry) || (retry.errors ?? []).length < (first.errors ?? []).length) chosen = retry
  }
  // Stash the transaction count for cost tracking (meta is loosely typed).
  chosen.meta = { ...(chosen.meta ?? {}), __stediTransactions: transactions }
  return chosen
}

/** Number of billable Stedi transactions a checkEligibility() response represents. */
export function stediTransactionsOf(resp: StediEligibilityResponse): number {
  const n = (resp.meta as { __stediTransactions?: number } | undefined)?.__stediTransactions
  return typeof n === 'number' ? n : 1
}

// ── Payer directory lookup (non-billable) ────────────────────────────────
export interface StediPayer {
  stediId?: string
  displayName?: string
  primaryPayerId?: string
  aliases?: string[]
  transactionSupport?: { eligibilityCheck?: string; [k: string]: unknown }
  [k: string]: unknown
}

// The /payers `query` param does NOT filter server-side — it returns the full
// directory in stediId order. So we load the whole directory once, cache it in
// memory, and filter client-side.
let _payerCache: StediPayer[] | null = null
let _payerCacheAt = 0
const PAYER_CACHE_TTL = 60 * 60 * 1000 // 1h

async function loadAllPayers(): Promise<StediPayer[]> {
  const all: StediPayer[] = []
  let token = ''
  for (let i = 0; i < 25; i++) {
    const url = new URL(`${STEDI_BASE}/payers`)
    url.searchParams.set('pageSize', '1000')
    if (token) url.searchParams.set('pageToken', token)
    const res = await fetch(url.toString(), { headers: { Authorization: STEDI_API_KEY } })
    if (!res.ok) throw new Error(`Stedi payers error (HTTP ${res.status})`)
    const json = (await res.json()) as { items?: StediPayer[]; nextPageToken?: string }
    all.push(...(json.items ?? []))
    if (!json.nextPageToken) break
    token = json.nextPageToken
  }
  return all
}

/** Search Stedi's payer network by display name (eligibility-supporting payers first). Non-billable, cached 1h. */
export async function searchPayers(query: string, limit = 20): Promise<StediPayer[]> {
  if (!_payerCache || Date.now() - _payerCacheAt > PAYER_CACHE_TTL) {
    _payerCache = await loadAllPayers()
    _payerCacheAt = Date.now()
  }
  const q = query.trim().toLowerCase()
  if (!q) return []
  const matches = _payerCache.filter(p => (p.displayName ?? '').toLowerCase().includes(q))
  // Eligibility-supporting payers first.
  matches.sort((a, b) => {
    const sa = (a.transactionSupport?.eligibilityCheck === 'SUPPORTED') ? 0 : 1
    const sb = (b.transactionSupport?.eligibilityCheck === 'SUPPORTED') ? 0 : 1
    return sa - sb || (a.displayName ?? '').localeCompare(b.displayName ?? '')
  })
  return matches.slice(0, limit)
}

// ── Convenience: did the check actually return usable benefits? ───────────
export function eligibilityHasBenefits(resp: StediEligibilityResponse): boolean {
  return Array.isArray(resp.benefitsInformation) && resp.benefitsInformation.length > 0
}

/** AAA-style rejection errors (provider not recognized, member not found, etc.). */
export function eligibilityErrors(resp: StediEligibilityResponse): string[] {
  return (resp.errors ?? []).map(e => `${e.code ?? '?'}: ${e.description ?? 'error'}${e.location ? ` (${e.location})` : ''}`)
}

// ── 271 → EligibilityOutput mapper ────────────────────────────────────────
// Transforms Stedi's raw 271 into the SAME EligibilityOutput shape the Vapi
// assistant produces, so the electronic channel reuses the existing dashboard UI.
function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}
function pctToWhole(v: unknown): number | null {
  // X12 EB08 percents come as decimals: "0.2" = 20%. >1 means already whole.
  const n = num(v)
  if (n == null) return null
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}
// A deductible/OOP line is "plan-level" (governs an audiology visit) if it's tagged
// to the overall plan or general medical. Different payers tag it differently:
// Aetna/Excellus/UHC use "Health Benefit Plan Coverage"; UMR/POMCO use "Medical Care".
function isHealthPlanLevel(sts: string[] | undefined): boolean {
  return !sts || sts.length === 0
    || sts.includes('Health Benefit Plan Coverage')
    || sts.includes('Medical Care')
}
function netFromIndicator(ind?: string): boolean | undefined {
  if (!ind) return undefined
  if (ind === 'Yes' || ind === 'W') return true
  if (ind === 'No') return false
  return undefined
}
// Classify a deductible/OOP line by its time qualifier:
//  remaining = what's left · ytd = amount already met (NOT the cap) · total = the period cap.
function tqClass(tq: string): 'remaining' | 'ytd' | 'total' {
  if (/Remaining/i.test(tq)) return 'remaining'
  if (/Year to Date|\bYTD\b/i.test(tq)) return 'ytd'
  return 'total'
}
// For a period cap, keep the LARGEST value seen (a $0 "met" line must not clobber a real cap).
function setMaxTotal(obj: Record<string, number | null | undefined>, key: string, v: number | null) {
  if (v == null) return
  const cur = obj[key]
  if (cur == null || v > cur) obj[key] = v
}

function fmtStediDateOut(d?: string | null): string | null {
  if (!d) return null
  const digits = d.replace(/\D/g, '')
  if (digits.length !== 8) return d
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}
function fmtPhoneOut(p?: string | null): string | null {
  if (!p) return null
  const d = p.replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return p
}
function fmtAddressOut(a: unknown): string | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, string>
  const parts = [o.address1, o.address2, [o.city, o.state].filter(Boolean).join(', '), o.postalCode].filter(Boolean)
  return parts.join(', ') || null
}

export function mapStediToEligibility(resp: StediEligibilityResponse): EligibilityOutput {
  const sub = (resp.subscriber ?? {}) as Record<string, string>
  const subRaw = (resp.subscriber ?? {}) as Record<string, unknown>
  const plan = (resp.planInformation ?? {}) as Record<string, string>
  const planDateInfo = (resp.planDateInformation ?? {}) as Record<string, string>
  const planStatus = (resp.planStatus as Array<Record<string, unknown>> | undefined) ?? []
  const payer = resp.payer ?? {}
  const bi = resp.benefitsInformation ?? []

  // Real plan name lives in planStatus[].planDetails (e.g. "CLASSIC BLUE COMPREHENSIVE");
  // groupDescription is the EMPLOYER/sponsor, not the plan.
  const planDetailsName = (planStatus.find(p => p.planDetails)?.planDetails as string | undefined) ?? null

  const out: EligibilityOutput = {
    member: {
      patientName: [sub.firstName, sub.lastName].filter(Boolean).join(' ') || '',
      dob: sub.dateOfBirth || '',
      memberId: sub.memberId || '',
      gender: sub.gender || null,
      address: fmtAddressOut(subRaw.address),
      groupNumber: plan.groupNumber || null,
      groupName: plan.groupDescription || null,
      eligibilityStatus: null,
      eligibilityEffectiveDate: fmtStediDateOut(planDateInfo.planBegin),
    },
    plan: {
      planName: planDetailsName || plan.groupDescription || plan.planNumber || null,
      payerName: payer.name || null,
      priorAuthRequired: null,
      fundingType: null,
    },
    benefits: {
      deductible: {},
      outOfPocketMax: {},
      coinsurance: {},
      copays: {},
      audiologyExam: {},
      hearingAidBenefit: {},
    },
    provider: {},
    confidence: 'high',
    notes: 'Captured electronically via Stedi 270/271 (no phone call).',
    outcome: { status: 'benefits_captured', nextAction: null },
  }

  const ded = out.benefits!.deductible!
  const oop = out.benefits!.outOfPocketMax!
  const coins = out.benefits!.coinsurance!
  const copays = out.benefits!.copays!
  const aud = out.benefits!.audiologyExam!
  const ha = out.benefits!.hearingAidBenefit!
  const haNotes = new Set<string>()
  let redirectEntity: string | null = null
  let insuranceType: string | null = null
  let umPhone: string | null = null
  let cobPrimary: string | null = null
  let cobPolicy: string | null = null

  for (const b of bi) {
    const name = b.name
    const sts = (b.serviceTypes as string[] | undefined) ?? []
    const stc = b.serviceTypeCodes ?? []
    const lvl = (b.coverageLevel as string | undefined) ?? ''
    const tq = (b.timeQualifier as string | undefined) ?? ''
    const net = netFromIndicator(b.inPlanNetworkIndicator as string | undefined)
    const ai = (b.additionalInformation ?? []).map(x => x.description).filter(Boolean).join('; ')
    const isAudio = stc.includes('71') || /audio|hearing/i.test(JSON.stringify(b))
    const isOffice = sts.includes('Professional (Physician) Visit - Office') || sts.includes('Diagnostic Medical')
      || sts.includes('Professional (Physician)') || sts.includes('Medical Care')
    const isDME = stc.includes('DM') || sts.some(s => /Durable Medical Equipment/i.test(s))
    const cls = tqClass(tq)
    const outOfNet = net === false // skip out-of-network for the headline accumulators (clinic is in-network)

    if (name === 'Active Coverage' && isHealthPlanLevel(sts)) {
      out.member.eligibilityStatus = out.member.eligibilityStatus || 'Active'
      if (/funding type\s*=\s*([^;]+)/i.test(ai)) out.plan!.fundingType = RegExp.$1.trim()
    }
    // Deductible / OOP — in-network, skip YTD-met lines; remaining vs the period cap (largest wins).
    if (name === 'Deductible' && isHealthPlanLevel(sts) && cls !== 'ytd' && !outOfNet) {
      const v = num(b.benefitAmount)
      const isFam = /Family/i.test(lvl)
      if (cls === 'remaining') { if (isFam) ded.familyRemaining = v; else ded.individualRemaining = v }
      else setMaxTotal(ded as Record<string, number | null | undefined>, isFam ? 'familyTotal' : 'individualTotal', v)
    }
    if (name === 'Out of Pocket (Stop Loss)' && isHealthPlanLevel(sts) && cls !== 'ytd' && !outOfNet) {
      const v = num(b.benefitAmount)
      const isFam = /Family/i.test(lvl)
      if (cls === 'remaining') { if (isFam) oop.familyRemaining = v; else oop.individualRemaining = v }
      else setMaxTotal(oop as Record<string, number | null | undefined>, isFam ? 'familyTotal' : 'individualTotal', v)
    }
    if (name === 'Co-Insurance' && (isOffice || isAudio)) {
      const p = pctToWhole(b.benefitPercent)
      if (p != null) { if (net === false) coins.outOfNetworkPercent = p; else coins.inNetworkPercent = p }
    }
    if (name === 'Co-Payment' && (isOffice || isAudio)) {
      const v = num(b.benefitAmount)
      if (v != null) { if (isAudio) copays.hearingExam = v; else copays.audiologyVisit = copays.audiologyVisit ?? v }
    }
    if (isAudio && (name === 'Active Coverage' || name === 'Co-Payment' || name === 'Co-Insurance' || name === 'Limitations')) {
      aud.covered = aud.covered ?? (name !== 'Limitations' ? true : aud.covered)
      if (ai) aud.coverageDetails = [aud.coverageDetails, ai].filter(Boolean).join(' | ')
      if (stc.length && !aud.codesMentioned) aud.codesMentioned = stc
    }
    // DME cost-share (from STC DM on hearing-aid checks) → enrich the HA benefit.
    // NOTE: payers do NOT return the HA allowance/frequency electronically — that
    // still needs the vendor (if contracted) or a call. This only adds DME cost-share.
    if (isDME) {
      if (name === 'Active Coverage') ha.covered = ha.covered ?? true
      if (name === 'Co-Payment') { const v = num(b.benefitAmount); if (v != null && ha.copayAmount == null) ha.copayAmount = v }
      if (name === 'Co-Insurance') { const p = pctToWhole(b.benefitPercent); if (p != null && net !== false && ha.coinsurancePercent == null) ha.coinsurancePercent = p }
      if (name === 'Deductible' && cls !== 'ytd') ha.deductibleApplies = true
      if (ai) ai.split(';').forEach(s => { const t = s.trim(); if (t) haNotes.add(t) })
    }
    if (/prior auth/i.test(ai)) out.plan!.priorAuthRequired = true
    // Redirect: payer says benefits are administered elsewhere (e.g. AARP Medicare
    // Supplement, a carve-out). Captured when it's the MAIN coverage (STC 30).
    if (name === 'Contact Following Entity for Eligibility or Benefit Information' && stc.includes('30')) {
      const ent = (b as { benefitsRelatedEntity?: { entityName?: string } }).benefitsRelatedEntity
      if (ent?.entityName && !redirectEntity) redirectEntity = ent.entityName
    }
    // Plan-level metadata + utilization-management (prior-auth) contact, from Active Coverage.
    if (name === 'Active Coverage') {
      const it = (b as Record<string, unknown>).insuranceType as string | undefined
      if (it && !insuranceType) insuranceType = it
      const ent = (b as { benefitsRelatedEntity?: { contactInformation?: { contacts?: Array<{ communicationMode?: string; communicationNumber?: string }> } } }).benefitsRelatedEntity
      const tel = ent?.contactInformation?.contacts?.find(c => /tele|phone/i.test(c.communicationMode ?? ''))?.communicationNumber
      if (tel && !umPhone) umPhone = tel
    }
    // Coordination of benefits — a payer that pays BEFORE this one (e.g. Medicare primary).
    if (name === 'Other or Additional Payor') {
      const ent = (b as { benefitsRelatedEntity?: { entityIdentifier?: string; entityName?: string } }).benefitsRelatedEntity
      const addl = (b as { benefitsAdditionalInformation?: { policyNumber?: string } }).benefitsAdditionalInformation
      if (ent?.entityName && /primary/i.test(ent.entityIdentifier ?? '') && !cobPrimary) {
        cobPrimary = ent.entityName
        cobPolicy = addl?.policyNumber ?? null
      }
    }
  }
  if (haNotes.size) ha.coverageNotes = Array.from(haNotes).join(' | ').slice(0, 400)
  if (insuranceType) out.plan!.insuranceType = insuranceType
  if (umPhone) out.plan!.priorAuthPhone = fmtPhoneOut(umPhone)
  if (cobPrimary) {
    out.coordinationOfBenefits = {
      primaryPayer: cobPrimary,
      primaryPolicyNumber: cobPolicy,
      isSecondary: true,
      note: `${payer.name ?? 'This plan'} is SECONDARY — ${cobPrimary} pays first. Bill ${cobPrimary} before this plan.`,
    }
  }

  // Did we capture any real coverage/cost-share?
  const hasRealBenefits = ded.individualTotal != null || ded.individualRemaining != null
    || oop.individualTotal != null || copays.audiologyVisit != null
    || aud.covered === true || ha.covered === true || out.member.eligibilityStatus === 'Active'

  if (redirectEntity && !hasRealBenefits) {
    // Benefits live at another administrator — surface it instead of a blank result.
    out.outcome = {
      status: 'redirected',
      nextAction: `Verify benefits with ${redirectEntity}.`,
      redirectReason: `This plan's eligibility is administered by ${redirectEntity} (e.g. a Medicare Supplement / AARP plan) — the main payer routes benefits there.`,
      redirectPhone: null,
    }
  } else if (out.member.eligibilityStatus == null && hasRealBenefits) {
    out.member.eligibilityStatus = 'Active'
  }
  return out
}

// ── Insurance Discovery ───────────────────────────────────────────────────
// Find a patient's ACTIVE coverage from minimal demographics (name + NPI; DOB/
// SSN/zip improve the match). Requires a one-time NPI enrollment with Stedi
// (Payer ID "DISCOVERY") before it returns results.
const DISCOVERY_URL = `${STEDI_BASE}/insurance-discovery/check/v1`

export interface DiscoveryParams {
  providerNpi: string
  providerOrganizationName?: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  ssn?: string
  zip?: string
  dateOfService?: string
}

export interface DiscoveredCoverage {
  payerName?: string | null
  memberId?: string | null
  planName?: string | null
  status?: string | null
  confidence?: string | null
}

export interface DiscoveryResponse {
  errors?: Array<{ code?: string; description?: string; possibleResolutions?: string }>
  items?: unknown[]
  coverages?: unknown[]
  [k: string]: unknown
}

export async function discoverInsurance(params: DiscoveryParams): Promise<DiscoveryResponse> {
  const today = new Date().toISOString().slice(0, 10)
  const body: Record<string, unknown> = {
    provider: {
      npi: params.providerNpi,
      ...(params.providerOrganizationName ? { organizationName: params.providerOrganizationName } : {}),
    },
    subscriber: {
      firstName: params.firstName,
      lastName: params.lastName,
      ...(params.dateOfBirth ? { dateOfBirth: toStediDate(params.dateOfBirth) } : {}),
      ...(params.ssn ? { ssn: params.ssn.replace(/\D/g, '') } : {}),
      ...(params.zip ? { address: { postalCode: params.zip } } : {}),
    },
    encounter: { dateOfService: toStediDate(params.dateOfService || today) },
  }
  const res = await fetch(DISCOVERY_URL, {
    method: 'POST',
    headers: { Authorization: STEDI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as DiscoveryResponse
}

/** True if discovery failed because the NPI isn't enrolled (vs. a real "no coverage" result). */
export function discoveryNeedsEnrollment(resp: DiscoveryResponse): boolean {
  return (resp.errors ?? []).some(e => /enroll/i.test(e.possibleResolutions ?? '') || e.code === '41')
}

/** Pull found coverages out of the (loosely-shaped) discovery response. */
export function extractDiscoveredCoverages(resp: DiscoveryResponse): DiscoveredCoverage[] {
  const arr = (resp.items ?? resp.coverages ?? []) as Array<Record<string, unknown>>
  return arr.map(it => {
    const payer = (it.payer ?? it.payerInformation ?? {}) as Record<string, unknown>
    const plan = (it.planInformation ?? {}) as Record<string, unknown>
    const sub = (it.subscriber ?? {}) as Record<string, unknown>
    return {
      payerName: (payer.name as string) ?? (it.payerName as string) ?? null,
      memberId: (sub.memberId as string) ?? (it.memberId as string) ?? null,
      planName: (plan.planName as string) ?? (plan.groupDescription as string) ?? null,
      status: (it.eligibilityStatus as string) ?? (it.status as string) ?? null,
      confidence: (it.confidence as string) ?? null,
    }
  })
}
