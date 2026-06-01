import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify superadmin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, email, password, npi, tax_id, address } = await req.json()
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // Create clinic
    const { data: clinic, error: clinicErr } = await serviceClient
      .from('clinics')
      .insert({ name: name.trim(), npi: npi || null, tax_id: tax_id || null, address: address || null, status: 'active' })
      .select()
      .single()

    if (clinicErr) throw new Error(clinicErr.message)

    // Create user with a set password — no invite email sent
    const { data: userData, error: userErr } = await serviceClient.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true, // skip email confirmation step
    })

    if (userErr) {
      // Clean up clinic if user creation fails
      await serviceClient.from('clinics').delete().eq('id', clinic.id)
      throw new Error(userErr.message)
    }

    // Create admin profile
    if (userData?.user) {
      await serviceClient
        .from('profiles')
        .upsert({
          id: userData.user.id,
          clinic_id: clinic.id,
          role: 'admin',
          email: email.trim(),
        }, { onConflict: 'id' })
    }

    return NextResponse.json({ clinicId: clinic.id, ok: true })
  } catch (err: unknown) {
    console.error('Create clinic error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create clinic' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { clinicId, status } = await req.json()
    if (!clinicId || !status) return NextResponse.json({ error: 'clinicId and status required' }, { status: 400 })

    const serviceClient = await createServiceClient()
    const { error } = await serviceClient.from('clinics').update({ status }).eq('id', clinicId)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update clinic' }, { status: 500 })
  }
}
