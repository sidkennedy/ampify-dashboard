import { createClient } from '@/lib/supabase/server'
import NewCallForm from './NewCallForm'

export default async function NewCallPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, clinics(npi, tax_id, name, address, caller_name, callback_number)')
    .eq('id', user!.id)
    .single()

  const clinic = (profile?.clinics as unknown as { npi: string | null; tax_id: string | null; name: string | null; address: string | null; caller_name: string | null; callback_number: string | null } | null)

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.25rem' }}>New Eligibility Call</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Select a verification type, enter patient and insurance details, then run the call.</p>
      </div>
      <NewCallForm
        clinicId={profile?.clinic_id ?? ''}
        clinicNpi={clinic?.npi ?? ''}
        clinicTaxId={clinic?.tax_id ?? ''}
        clinicName={clinic?.name ?? ''}
        clinicAddress={clinic?.address ?? ''}
        callerName={clinic?.caller_name ?? ''}
        callbackNumber={clinic?.callback_number ?? ''}
      />
    </div>
  )
}
