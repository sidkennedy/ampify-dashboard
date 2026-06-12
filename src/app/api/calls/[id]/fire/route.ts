import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startVapiCall } from '@/lib/vapi'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: call, error: callErr } = await supabase
      .from('calls')
      .select('*')
      .eq('id', id)
      .single()

    if (callErr || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.status !== 'queued') {
      return NextResponse.json({ error: `Call is not in queued state (current: ${call.status})` }, { status: 400 })
    }

    const { callId: vapiCallId } = await startVapiCall({
      patientName: call.patient_name,
      dob: call.dob,
      memberId: call.member_id,
      providerNPI: call.provider_npi ?? '',
      clinicTaxId: call.clinic_tax_id ?? '',
      clinicName: call.clinic_name ?? '',
      clinicAddress: call.clinic_address ?? '',
      codesRequested: call.codes_requested,
      insurancePhone: call.insurance_phone,
      verificationType: call.verification_type ?? '',
      dateOfService: call.date_of_service ?? '',
      planType: call.plan_type ?? '',
      state: call.state ?? '',
      diagnosisCode: call.diagnosis_code ?? '',
      callbackNumber: call.callback_number ?? '',
      subscriberName: call.subscriber_name ?? '',
      subscriberDob: call.subscriber_dob ?? '',
    })

    await supabase
      .from('calls')
      .update({ vapi_call_id: vapiCallId, status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ vapiCallId, status: 'in_progress' })
  } catch (err: unknown) {
    console.error('Fire call error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fire call' },
      { status: 500 }
    )
  }
}
