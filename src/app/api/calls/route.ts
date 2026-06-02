import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startVapiCall } from '@/lib/vapi'
import { shouldSchedule } from '@/lib/insurance-hours'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      clinicId, patientName, dob, memberId, insurancePhone, codesRequested,
      providerNPI, clinicTaxId, clinicName, clinicAddress,
    } = body

    // Check insurance hours
    const { schedule, scheduledFor } = shouldSchedule()

    // Insert call record
    const { data: callRecord, error: dbError } = await supabase
      .from('calls')
      .insert({
        clinic_id: clinicId,
        patient_name: patientName,
        dob,
        member_id: memberId,
        insurance_phone: insurancePhone,
        codes_requested: codesRequested,
        provider_npi: providerNPI,
        clinic_tax_id: clinicTaxId,
        clinic_name: clinicName,
        clinic_address: clinicAddress,
        phone_number_id: process.env.VAPI_PHONE_NUMBER_ID,
        status: schedule ? 'scheduled' : 'queued',
        scheduled_for: schedule && scheduledFor ? scheduledFor.toISOString() : null,
      })
      .select()
      .single()

    if (dbError) throw new Error(dbError.message)

    // If outside hours, return early (scheduled)
    if (schedule) {
      return NextResponse.json({
        callId: callRecord.id,
        status: 'scheduled',
        scheduledFor: scheduledFor?.toISOString(),
      })
    }

    // TRIAL MODE — skip Vapi entirely, just save the record and return
    if (process.env.TRIAL_MODE === 'true') {
      return NextResponse.json({ callId: callRecord.id, status: 'queued' })
    }

    // Place call via VAPI
    const { callId: vapiCallId } = await startVapiCall({
      patientName,
      dob,
      memberId,
      providerNPI,
      clinicTaxId,
      clinicName,
      clinicAddress,
      codesRequested,
      insurancePhone,
    })

    // Update with VAPI call ID
    await supabase
      .from('calls')
      .update({ vapi_call_id: vapiCallId, status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', callRecord.id)

    return NextResponse.json({ callId: callRecord.id, vapiCallId, status: 'in_progress' })
  } catch (err: unknown) {
    console.error('Call creation error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to start call' }, { status: 500 })
  }
}
