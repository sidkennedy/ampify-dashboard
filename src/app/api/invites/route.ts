import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get inviter's profile to find clinic_id and check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.clinic_id) return NextResponse.json({ error: 'No clinic associated with your account' }, { status: 400 })
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 })
    }

    const { email, role } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const serviceClient = await createServiceClient()

    // Use Supabase admin invite (sends magic link email)
    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        clinic_id: profile.clinic_id,
        role: role ?? 'staff',
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    })

    if (error) {
      // If user already exists, just update their profile
      if (error.message.includes('already been registered')) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 })
      }
      throw error
    }

    // Pre-create their profile so RLS works when they sign in
    if (data?.user) {
      await serviceClient
        .from('profiles')
        .upsert({
          id: data.user.id,
          clinic_id: profile.clinic_id,
          role: role ?? 'staff',
          email,
        }, { onConflict: 'id' })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to send invite' }, { status: 500 })
  }
}
