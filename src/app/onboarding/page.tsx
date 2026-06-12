export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingWizard from './OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, clinic_id, clinics(*)').eq('id', user.id).single()
  const clinic = profile?.clinics as unknown as Record<string, unknown> | null

  // Superadmins don't belong to a clinic.
  if (!profile?.clinic_id) {
    return (
      <div style={{ maxWidth: 480, margin: '6rem auto', textAlign: 'center', padding: '0 1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.5rem' }}>Onboarding is for clinics</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Your account isn&apos;t tied to a clinic. Sign in with a clinic account to complete setup.</p>
        <a href="/dashboard" style={{ display: 'inline-block', marginTop: '1.5rem', color: '#00C853', fontWeight: 600, textDecoration: 'none' }}>Go to dashboard →</a>
      </div>
    )
  }
  // Already onboarded → straight to the app.
  if (clinic?.terms_accepted_at) redirect('/dashboard')

  return (
    <OnboardingWizard
      clinic={{
        name: (clinic?.name as string) ?? '',
        address: (clinic?.address as string) ?? '',
        npi: (clinic?.npi as string) ?? '',
        taxId: (clinic?.tax_id as string) ?? '',
        callbackNumber: (clinic?.callback_number as string) ?? '',
        billerPhone: (clinic?.biller_phone as string) ?? '',
        vendorContracts: (clinic?.vendor_contracts as string[]) ?? [],
      }}
    />
  )
}
