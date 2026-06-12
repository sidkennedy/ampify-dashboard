import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as serviceClient } from '@supabase/supabase-js'

const TERMS_VERSION = '1.0'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    const clinicId = profile?.clinic_id
    if (!clinicId) return NextResponse.json({ error: 'No clinic on your account.' }, { status: 400 })

    const b = await req.json()
    if (!b.name || !b.npi) return NextResponse.json({ error: 'Clinic name and NPI are required.' }, { status: 400 })
    if (!b.acceptName?.trim() || !b.acceptTitle?.trim() || !b.agreed) {
      return NextResponse.json({ error: 'You must enter your name and title and agree to the Services Agreement and BAA.' }, { status: 400 })
    }

    // Service role: verified this is the user's own clinic above.
    const admin = serviceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await admin.from('clinics').update({
      name: b.name,
      address: b.address || null,
      npi: b.npi,
      tax_id: b.taxId || null,
      callback_number: b.callbackNumber || null,
      biller_phone: b.billerPhone || null,
      vendor_contracts: Array.isArray(b.vendorContracts) ? b.vendorContracts : [],
      terms_accepted_at: new Date().toISOString(),
      terms_accepted_by_name: b.acceptName.trim(),
      terms_accepted_by_title: b.acceptTitle.trim(),
      terms_version: TERMS_VERSION,
    }).eq('id', clinicId)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onboarding failed' }, { status: 500 })
  }
}
