const VAPI_BASE = 'https://api.vapi.ai'
const VAPI_API_KEY = process.env.VAPI_API_KEY!
const ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID! // payer (default, proven autonomous)
const VENDOR_ASSISTANT_ID = process.env.VAPI_VENDOR_ASSISTANT_ID
const HYBRID_ASSISTANT_ID = process.env.VAPI_HYBRID_ASSISTANT_ID
const PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID!

export type CallTarget = 'payer' | 'vendor' | 'hybrid'

// Pick the assistant for this call type. Falls back to the payer assistant if a
// specialized one isn't configured.
function assistantIdFor(target?: CallTarget): string {
  if (target === 'hybrid' && HYBRID_ASSISTANT_ID) return HYBRID_ASSISTANT_ID
  if (target === 'vendor' && VENDOR_ASSISTANT_ID) return VENDOR_ASSISTANT_ID
  return ASSISTANT_ID
}

export function toE164(raw: string): string {
  const stripped = raw.trim()
  if (stripped.startsWith('+')) {
    const digits = stripped.slice(1).replace(/\D/g, '')
    if (digits.length < 10) throw new Error(`Phone number too short after stripping: "${raw}"`)
    return `+${digits}`
  }
  const digits = stripped.replace(/\D/g, '')
  if (digits.length < 10) throw new Error(`Phone number too short after stripping: "${raw}"`)
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  throw new Error(`Cannot convert "${raw}" to E.164 — unexpected digit count (${digits.length})`)
}

export interface StartCallParams {
  patientName: string
  dob: string
  memberId: string
  providerNPI: string
  clinicTaxId: string
  clinicName: string
  clinicAddress: string
  codesRequested: string
  insurancePhone: string
  // Template-specific fields
  verificationType: string
  dateOfService: string
  planType: string
  state: string
  diagnosisCode: string
  // Per-clinic callback number (caller name is hardcoded to "Ben Letterman" in the assistant)
  callbackNumber: string
  subscriberName: string
  subscriberDob: string
  // Hybrid transfer: 'autonomous' (AI completes) or 'hybrid' (AI navigates to a live
  // rep then transfers to the biller). billerPhone is the E.164 transfer destination.
  callMode?: string
  billerPhone?: string
  // Which assistant to use: payer (default), vendor (HA TPA calls), or hybrid (transfer).
  target?: CallTarget
}

export async function startVapiCall(params: StartCallParams): Promise<{ callId: string }> {
  const res = await fetch(`${VAPI_BASE}/call`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId: assistantIdFor(params.target),
      phoneNumberId: PHONE_NUMBER_ID,
      customer: { number: toE164(params.insurancePhone) },
      assistantOverrides: {
        variableValues: {
          patientName: params.patientName,
          dob: params.dob,
          memberId: params.memberId,
          providerNPI: params.providerNPI,
          clinicTaxId: params.clinicTaxId,
          clinicName: params.clinicName,
          clinicAddress: params.clinicAddress,
          codesRequested: params.codesRequested,
          verificationType: params.verificationType,
          dateOfService: params.dateOfService,
          planType: params.planType,
          state: params.state,
          diagnosisCode: params.diagnosisCode,
          callbackNumber: params.callbackNumber,
          subscriberName: params.subscriberName,
          subscriberDob: params.subscriberDob,
          callMode: params.callMode ?? 'autonomous',
          billerPhone: params.billerPhone ?? '',
        },
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`VAPI error: ${err}`)
  }

  const data = await res.json()
  return { callId: data.id }
}

export async function getVapiCall(callId: string) {
  const res = await fetch(`${VAPI_BASE}/call/${callId}`, {
    headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
  })
  if (!res.ok) throw new Error('Failed to fetch VAPI call')
  return res.json()
}
