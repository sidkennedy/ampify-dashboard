const VAPI_BASE = 'https://api.vapi.ai'
const VAPI_API_KEY = process.env.VAPI_API_KEY!
const ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID!
const PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID!

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
}

export async function startVapiCall(params: StartCallParams): Promise<{ callId: string }> {
  const res = await fetch(`${VAPI_BASE}/call`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId: ASSISTANT_ID,
      phoneNumberId: PHONE_NUMBER_ID,
      customer: { number: params.insurancePhone },
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
