import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.clinic_id) return NextResponse.json({ error: 'No clinic associated with your account' }, { status: 400 })
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only admins can add team members' }, { status: 403 })
    }

    const { email, role, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const serviceClient = await createServiceClient()

    // Create user with a set password — no invite email sent
    const { data, error } = await serviceClient.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
    })

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 })
      }
      throw error
    }

    if (data?.user) {
      await serviceClient
        .from('profiles')
        .upsert({
          id: data.user.id,
          clinic_id: profile.clinic_id,
          role: role ?? 'staff',
          email: email.trim(),
        }, { onConflict: 'id' })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create user' }, { status: 500 })
  }
}
