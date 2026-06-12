import { createClient } from '@/lib/supabase/server'
import NewCallForm from './NewCallForm'

export default async function NewCallPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, clinics(npi, tax_id, name, address, callback_number)')
    .eq('id', user!.id)
    .single()

  const clinic = (profile?.clinics as unknown as { npi: string | null; tax_id: string | null; name: string | null; address: string | null; callback_number: string | null } | null)

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.25rem' }}>New Verification</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Pick the verification type, patient, and payer — the system chooses the fastest way to get the answer.</p>
      </div>
      <NewCallForm
        clinicId={profile?.clinic_id ?? ''}
        clinicNpi={clinic?.npi ?? ''}
        clinicTaxId={clinic?.tax_id ?? ''}
        clinicName={clinic?.name ?? ''}
        clinicAddress={clinic?.address ?? ''}
        callbackNumber={clinic?.callback_number ?? ''}
      />
    </div>
  )
}
