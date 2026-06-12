import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clinicHasFeature } from '@/lib/features'
import { submitClaim, normalizeSubmission, type ServiceLine } from '@/lib/claims-submit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: claim } = await supabase
      .from('claims').select('*, clinics(npi, name, tax_id, address, features)').eq('id', id).single()
    if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

    const clinic = claim.clinics as unknown as { npi: string | null; name: string | null; tax_id: string | null; address: string | null; features?: Record<string, boolean> | null }
    if (!clinicHasFeature(clinic, 'claims')) return NextResponse.json({ error: 'Claims submission is not enabled for this clinic.' }, { status: 403 })
    if (!clinic?.npi) return NextResponse.json({ error: 'Clinic NPI is required to submit claims.' }, { status: 400 })

    const lines = (claim.service_lines as ServiceLine[] | null) ?? []
    const dx = (claim.diagnosis_codes as string[] | null) ?? []
    if (!lines.length || !dx.length) return NextResponse.json({ error: 'Add at least one diagnosis code and one service line before submitting.' }, { status: 400 })

    const parts = (claim.patient_name as string).trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]

    const resp = await submitClaim({
      tradingPartnerServiceId: claim.payer_stedi_id,
      payerName: claim.payer_name ?? undefined,
      billing: {
        npi: clinic.npi,
        employerId: clinic.tax_id ?? undefined,
        organizationName: clinic.name ?? '',
      },
      subscriberFirstName: firstName,
      subscriberLastName: lastName,
      subscriberDateOfBirth: claim.patient_dob ?? undefined,
      subscriberGender: claim.gender ?? undefined,
      memberId: claim.member_id,
      patientControlNumber: (claim.claim_control_number as string) || `PAC${String(claim.id).slice(0, 8)}`,
      diagnosisCodes: dx,
      serviceLines: lines,
      placeOfServiceCode: claim.place_of_service ?? '11',
    })
    const norm = normalizeSubmission(resp)

    await supabase.from('claims').update({
      submission_status: norm.status,
      submission_detail: norm.detail,
      claim_control_number: norm.controlNumber ?? claim.claim_control_number ?? `PAC${String(claim.id).slice(0, 8)}`,
      submitted_at: new Date().toISOString(),
    }).eq('id', id)

    return NextResponse.json({ status: norm.status, detail: norm.detail, needsEnrollment: norm.needsEnrollment })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Submission failed' }, { status: 500 })
  }
}
