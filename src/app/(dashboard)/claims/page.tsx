export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { clinicHasFeature } from '@/lib/features'
import { Claim } from '@/types'
import ClaimsClient from './ClaimsClient'

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('clinic_id, clinics(npi, name, features)').eq('id', user.id).single()
  const clinic = profile?.clinics as unknown as { npi: string | null; name: string | null; features?: Record<string, boolean> | null } | null

  if (!profile?.clinic_id) {
    return <Notice title="No clinic" body="Claim tracking is used inside a clinic. Sign in with a clinic account to use it." />
  }
  if (!clinicHasFeature(clinic, 'claim_status') && !clinicHasFeature(clinic, 'claims')) {
    return <Notice title="Claims isn't enabled" body="This feature is part of expansion mode. A superadmin can enable claim status tracking and/or claims submission for your clinic in the Admin panel." />
  }

  const { data: claims } = await supabase
    .from('claims').select('*').order('created_at', { ascending: false })
  const canSubmit = clinicHasFeature(clinic, 'claims')

  // Prefill from a verification (verify → bill in one click).
  let prefill: { patientName?: string; patientDob?: string; memberId?: string } | null = null
  if (from) {
    const { data: call } = await supabase.from('calls').select('patient_name, dob, member_id').eq('id', from).single()
    if (call) prefill = { patientName: call.patient_name, patientDob: call.dob, memberId: call.member_id }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117' }}>Claims</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {canSubmit
            ? 'Submit claims electronically and track their status — no more calling payers to ask “did it get paid?”'
            : 'Track the status of submitted claims — stop calling payers to ask “did it get paid?”'}
        </p>
      </div>
      <ClaimsClient initialClaims={(claims ?? []) as Claim[]} canSubmit={canSubmit} canEra={clinicHasFeature(clinic, 'era')} prefill={prefill} />
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.5rem' }}>Claim Status</h1>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
        <p style={{ fontWeight: 600, color: '#0D1117', marginBottom: '0.375rem' }}>{title}</p>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>{body}</p>
      </div>
    </div>
  )
}
