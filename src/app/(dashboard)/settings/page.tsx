export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForms from './SettingsForms'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get profile + clinic
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clinics(*)')
    .eq('id', user.id)
    .single()

  const clinic = profile?.clinics as any

  // Get templates
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: true })

  // Get staff members for this clinic
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('clinic_id', profile?.clinic_id ?? '')
    .order('created_at', { ascending: true })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117' }}>Settings</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your clinic profile, templates, and team.</p>
      </div>

      <SettingsForms
        profile={profile}
        clinic={clinic}
        templates={templates ?? []}
        staff={staff ?? []}
        userId={user.id}
      />
    </div>
  )
}
