import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clinicHasFeature } from '@/lib/features'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('clinic_id, clinics(features)').eq('id', user.id).single()
    const clinicId = profile?.clinic_id
    const clinic = profile?.clinics as unknown as { features?: Record<string, boolean> | null } | null
    if (!clinicId) return NextResponse.json({ error: 'No clinic on your account.' }, { status: 400 })
    if (!clinicHasFeature(clinic, 'claim_status')) return NextResponse.json({ error: 'Claim status tracking is not enabled for this clinic.' }, { status: 403 })

    const b = await req.json()
    if (!b.patientName || !b.memberId || !b.payerStediId || !b.serviceDateFrom) {
      return NextResponse.json({ error: 'Patient name, member ID, payer, and date of service are required.' }, { status: 400 })
    }

    const serviceLines = Array.isArray(b.serviceLines) ? b.serviceLines : null
    const lineTotal = serviceLines?.reduce((s: number, l: { chargeAmount?: number }) => s + Number(l.chargeAmount || 0), 0)
    const { data, error } = await supabase.from('claims').insert({
      clinic_id: clinicId,
      patient_name: b.patientName,
      patient_dob: b.patientDob || null,
      gender: b.gender || null,
      member_id: b.memberId,
      payer_stedi_id: b.payerStediId,
      payer_name: b.payerName || null,
      service_date_from: b.serviceDateFrom,
      service_date_to: b.serviceDateTo || null,
      charge_amount: b.chargeAmount ? Number(b.chargeAmount) : (lineTotal || null),
      diagnosis_codes: Array.isArray(b.diagnosisCodes) && b.diagnosisCodes.length ? b.diagnosisCodes : null,
      service_lines: serviceLines && serviceLines.length ? serviceLines : null,
      place_of_service: b.placeOfService || '11',
      submission_status: serviceLines && serviceLines.length ? 'draft' : null,
    }).select().single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ claim: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add claim' }, { status: 500 })
  }
}
