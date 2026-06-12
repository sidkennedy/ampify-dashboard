// Stedi real-time claim status (276/277) client.
// NOTE: claim status requires a one-time Stedi NPI enrollment (like discovery).
// Endpoint base mirrors the eligibility "change/medicalnetwork" pattern; verify
// the exact path on the first live test (it's enrollment-gated, so untestable yet).

import { toStediDate } from './stedi'

const STEDI_API_KEY = process.env.STEDI_API_KEY!
const CLAIM_STATUS_URL = 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/claimstatus/v2'

export interface ClaimStatusParams {
  tradingPartnerServiceId: string
  providerNpi: string
  providerOrganizationName: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  gender?: string
  memberId: string
  serviceDateFrom: string // ISO date
  serviceDateTo?: string
}

export interface ClaimStatusRaw {
  errors?: Array<{ code?: string; description?: string; possibleResolutions?: string }>
  claims?: Array<Record<string, unknown>>
  [k: string]: unknown
}

export async function checkClaimStatus(p: ClaimStatusParams): Promise<ClaimStatusRaw> {
  const from = toStediDate(p.serviceDateFrom)
  const to = p.serviceDateTo ? toStediDate(p.serviceDateTo) : from
  const body = {
    tradingPartnerServiceId: p.tradingPartnerServiceId,
    providers: [{ npi: p.providerNpi, organizationName: p.providerOrganizationName, providerType: 'BillingProvider' }],
    subscriber: {
      firstName: p.firstName,
      lastName: p.lastName,
      memberId: p.memberId,
      ...(p.dateOfBirth ? { dateOfBirth: toStediDate(p.dateOfBirth) } : {}),
      ...(p.gender ? { gender: p.gender } : {}),
    },
    encounter: { beginningDateOfService: from, endDateOfService: to },
  }
  const res = await fetch(CLAIM_STATUS_URL, {
    method: 'POST',
    headers: { Authorization: STEDI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as ClaimStatusRaw
}

export type NormalizedStatus = 'paid' | 'denied' | 'pending' | 'acknowledged' | 'not_found' | 'error'

export interface NormalizedClaimStatus {
  status: NormalizedStatus
  detail: string | null
  paidAmount: number | null
  payerClaimNumber: string | null
  needsEnrollment: boolean
}

// Map the 277 Health Care Claim Status Category Code to a simple status.
// F1 = paid, F2 = denied, F* = finalized, A* = acknowledged, P* = pending,
// D = not found, E/R = error/needs info.
export function normalizeClaimStatus(resp: ClaimStatusRaw): NormalizedClaimStatus {
  const needsEnrollment = (resp.errors ?? []).some(e => /enroll/i.test(e.possibleResolutions ?? '') || e.code === '41')
  if (needsEnrollment) return { status: 'error', detail: 'NPI not enrolled for claim status.', paidAmount: null, payerClaimNumber: null, needsEnrollment: true }
  if (resp.errors?.length) return { status: 'error', detail: resp.errors.map(e => e.description).filter(Boolean).join('; ') || 'Error', paidAmount: null, payerClaimNumber: null, needsEnrollment: false }

  const claim = (resp.claims?.[0] ?? {}) as Record<string, unknown>
  const cs = (claim.claimStatus ?? {}) as Record<string, unknown>
  const cat = String(cs.statusCategoryCode ?? '').toUpperCase()
  const detail = (cs.statusCategoryCodeValue as string) || (cs.statusCodeValue as string) || (cs.statusCode as string) || null
  const paidAmount = num(claim.totalClaimChargeAmount) ?? num(cs.amountPaid) ?? num(claim.amountPaid)
  const payerClaimNumber = (claim.payerClaimControlNumber as string) ?? ((claim.payer as Record<string, unknown>)?.claimControlNumber as string) ?? null

  let status: NormalizedStatus = 'pending'
  if (cat === 'F1') status = 'paid'
  else if (cat === 'F2') status = 'denied'
  else if (cat.startsWith('F')) status = 'paid' // finalized (other) — treat as resolved
  else if (cat.startsWith('A')) status = 'acknowledged'
  else if (cat.startsWith('P')) status = 'pending'
  else if (cat === 'D' || cat === 'D0') status = 'not_found'
  else if (cat === 'E' || cat === 'R') status = 'error'

  return { status, detail, paidAmount, payerClaimNumber, needsEnrollment: false }
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}
