export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/ui/Sidebar'
import HybridCallBanner from '@/components/calls/HybridCallBanner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, clinics(*)')
    .eq('id', user.id)
    .single()

  // Clinic members must finish onboarding (incl. agreement acceptance) before using the app.
  // Superadmins aren't tied to a clinic, so they skip it.
  const clinic = profile?.clinics as { terms_accepted_at?: string | null } | null
  if (profile?.clinic_id && profile.role !== 'superadmin' && !clinic?.terms_accepted_at) {
    redirect('/onboarding')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar profile={profile} />
      <main style={{ flex: 1, marginLeft: 240, padding: '2rem', maxWidth: 'calc(100vw - 240px)' }}>
        <HybridCallBanner />
        {children}
      </main>
    </div>
  )
}
