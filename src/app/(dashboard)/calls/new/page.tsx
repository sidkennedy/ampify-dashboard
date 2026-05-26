import { createClient } from '@/lib/supabase/server'
import NewCallForm from './NewCallForm'

export default async function NewCallPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('clinic_id, clinics(npi, tax_id, name, address)')
    .eq('id', user!.id)
    .single()

  const clinic = (profile?.clinics as unknown as { npi: string | null; tax_id: string | null; name: string | null; address: string | null } | null)

  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('clinic_id', profile?.clinic_id)
    .order('name')

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.25rem' }}>New Eligibility Call</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Enter patient and insurance details to start the AI verification call.</p>
      </div>
      <NewCallForm
        clinicId={profile?.clinic_id ?? ''}
        clinicNpi={clinic?.npi ?? ''}
        clinicTaxId={clinic?.tax_id ?? ''}
        clinicName={clinic?.name ?? ''}
        clinicAddress={clinic?.address ?? ''}
        templates={templates ?? []}
      />
    </div>
  )
}
