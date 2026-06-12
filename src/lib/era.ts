// Stedi 835 ERA (electronic remittance advice) retrieval + matching.
// ERAs arrive after a claim is submitted AND paid, so this is fully downstream —
// untestable until there are real submitted/paid claims + enrollment. Endpoint
// paths follow the "change/medicalnetwork/reports" pattern; VERIFY on first live ERA.

const STEDI_API_KEY = process.env.STEDI_API_KEY!
const BASE = 'https://healthcare.us.stedi.com/2024-04-01'
const POLL_URL = `${BASE}/change/medicalnetwork/reports/v2`

export interface EraClaimPayment {
  patientControlNumber: string | null // matches our claim's claim_control_number
  payerClaimNumber: string | null
  paidAmount: number | null
  patientResponsibility: number | null
  statusCode: string | null
  adjustmentReasons: string[] // CARC/RARC reason codes + descriptions (why short-paid/denied)
}

// Pull adjustment reason codes (CARC/RARC) from anywhere in the claim object — the
// "why" behind a denial or short-pay. Defensive: field names vary; verify on live ERA.
function extractAdjustments(claim: Record<string, unknown>): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(walk)
    const o = v as Record<string, unknown>
    const code = (o.adjustmentReasonCode ?? o.claimAdjustmentReasonCode ?? o.reasonCode) as string | undefined
    const desc = (o.adjustmentReasonCodeValue ?? o.reasonDescription ?? o.adjustmentReason) as string | undefined
    if (code || desc) out.push([code, desc].filter(Boolean).join(' — '))
    Object.values(o).forEach(walk)
  }
  walk(claim)
  return [...new Set(out)].slice(0, 6)
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Find transaction IDs of available 835 ERA reports. VERIFY endpoint/shape on first live ERA. */
export async function pollEraTransactions(): Promise<string[]> {
  try {
    const res = await fetch(`${POLL_URL}?transactionType=835`, { headers: { Authorization: STEDI_API_KEY } })
    if (!res.ok) return []
    const json = (await res.json()) as { items?: Array<Record<string, unknown>>; transactions?: Array<Record<string, unknown>> }
    const items = json.items ?? json.transactions ?? []
    return items.map(i => (i.transactionId ?? i.id) as string).filter(Boolean)
  } catch { return [] }
}

export async function fetchEra(transactionId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${POLL_URL}/${transactionId}/835`, { headers: { Authorization: STEDI_API_KEY } })
  return (await res.json()) as Record<string, unknown>
}

/** Extract per-claim payments from an 835, keyed by patientControlNumber for matching. */
export function parseEraPayments(era: Record<string, unknown>): EraClaimPayment[] {
  const claims = (era.claims ?? era.claimPayments ?? []) as Array<Record<string, unknown>>
  return claims.map(c => ({
    patientControlNumber: (c.patientControlNumber as string) ?? null,
    payerClaimNumber: (c.payerClaimControlNumber as string) ?? ((c.payer as Record<string, unknown>)?.claimControlNumber as string) ?? null,
    paidAmount: num(c.claimPaymentAmount) ?? num(c.totalClaimPaymentAmount),
    patientResponsibility: num(c.patientResponsibilityAmount),
    statusCode: (c.claimStatusCode as string) ?? null,
    adjustmentReasons: extractAdjustments(c),
  }))
}
