// Stedi 837P professional claim submission.
// Requires a one-time Stedi NPI enrollment for claims (per payer). Endpoint base
// mirrors the eligibility "change/medicalnetwork" pattern — verify the exact path
// on the first live submission (enrollment-gated, so untestable yet).

import { toStediDate } from './stedi'

const STEDI_API_KEY = process.env.STEDI_API_KEY!
const CLAIMS_URL = 'https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/professionalclaims/v3/submission'

export interface ServiceLine {
  procedureCode: string // CPT/HCPCS
  modifiers?: string[]
  chargeAmount: number
  units: number
  serviceDate: string // ISO
  diagnosisPointers?: string[] // e.g. ['1']
}

export interface BillingProvider {
  npi: string
  employerId?: string // Tax ID (EIN), digits only
  organizationName: string
  address?: { address1?: string; city?: string; state?: string; postalCode?: string }
}

export interface SubmitClaimParams {
  tradingPartnerServiceId: string
  payerName?: string
  billing: BillingProvider
  subscriberFirstName: string
  subscriberLastName: string
  subscriberDateOfBirth?: string
  subscriberGender?: string
  memberId: string
  patientControlNumber: string
  diagnosisCodes: string[] // ICD-10, principal first
  serviceLines: ServiceLine[]
  placeOfServiceCode?: string // default 11 (office)
  claimFilingCode?: string // default CI (commercial)
}

export interface SubmissionRaw {
  errors?: Array<{ code?: string; description?: string; possibleResolutions?: string }>
  claimReference?: Record<string, unknown>
  [k: string]: unknown
}

export async function submitClaim(p: SubmitClaimParams): Promise<SubmissionRaw> {
  const pos = p.placeOfServiceCode || '11'
  const totalCharge = p.serviceLines.reduce((s, l) => s + Number(l.chargeAmount || 0), 0)

  const body = {
    controlNumber: String(Math.floor(100000000 + Math.random() * 900000000)),
    tradingPartnerServiceId: p.tradingPartnerServiceId,
    submitter: {
      organizationName: p.billing.organizationName,
      contactInformation: { name: p.billing.organizationName },
    },
    receiver: { organizationName: p.payerName || 'PAYER' },
    billing: {
      providerType: 'BillingProvider',
      npi: p.billing.npi,
      ...(p.billing.employerId ? { employerId: p.billing.employerId.replace(/\D/g, '') } : {}),
      organizationName: p.billing.organizationName,
      ...(p.billing.address ? { address: p.billing.address } : {}),
    },
    subscriber: {
      paymentResponsibilityLevelCode: 'P',
      firstName: p.subscriberFirstName,
      lastName: p.subscriberLastName,
      memberId: p.memberId,
      ...(p.subscriberDateOfBirth ? { dateOfBirth: toStediDate(p.subscriberDateOfBirth) } : {}),
      ...(p.subscriberGender ? { gender: p.subscriberGender } : {}),
    },
    claimInformation: {
      claimFilingCode: p.claimFilingCode || 'CI',
      patientControlNumber: p.patientControlNumber,
      claimChargeAmount: totalCharge.toFixed(2),
      placeOfServiceCode: pos,
      claimFrequencyCode: '1', // new claim
      signatureIndicator: 'Y',
      planParticipationCode: 'A',
      benefitsAssignmentCertificationIndicator: 'Y',
      releaseInformationCode: 'Y',
      healthCareCodeInformation: p.diagnosisCodes.map((code, i) => ({
        diagnosisTypeCode: i === 0 ? 'ABK' : 'ABF',
        diagnosisCode: code.replace(/\./g, ''),
      })),
      serviceLines: p.serviceLines.map(l => ({
        professionalService: {
          procedureIdentifier: 'HC',
          procedureCode: l.procedureCode,
          ...(l.modifiers?.length ? { procedureModifiers: l.modifiers } : {}),
          lineItemChargeAmount: Number(l.chargeAmount).toFixed(2),
          measurementUnit: 'UN',
          serviceUnitCount: String(l.units || 1),
          compositeDiagnosisCodePointers: { diagnosisCodePointers: l.diagnosisPointers?.length ? l.diagnosisPointers : ['1'] },
        },
        serviceDate: toStediDate(l.serviceDate),
      })),
    },
  }

  const res = await fetch(CLAIMS_URL, {
    method: 'POST',
    headers: { Authorization: STEDI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await res.json()) as SubmissionRaw
}

export interface NormalizedSubmission {
  status: 'accepted' | 'rejected' | 'submitted' | 'error'
  detail: string | null
  controlNumber: string | null
  needsEnrollment: boolean
}

export function normalizeSubmission(resp: SubmissionRaw): NormalizedSubmission {
  const needsEnrollment = (resp.errors ?? []).some(e => /enroll/i.test(e.possibleResolutions ?? '') || e.code === '41')
  if (needsEnrollment) return { status: 'error', detail: 'NPI not enrolled for claims submission.', controlNumber: null, needsEnrollment: true }
  if (resp.errors?.length) return { status: 'rejected', detail: resp.errors.map(e => e.description).filter(Boolean).join('; ') || 'Rejected', controlNumber: null, needsEnrollment: false }
  const ref = (resp.claimReference ?? {}) as Record<string, unknown>
  const cn = (ref.patientControlNumber as string) ?? (ref.correlationId as string) ?? (resp.controlNumber as string) ?? null
  // A clean 999/277CA-accepted response (no errors) = accepted into the payer's queue.
  return { status: 'accepted', detail: 'Accepted by the clearinghouse.', controlNumber: cn, needsEnrollment: false }
}
