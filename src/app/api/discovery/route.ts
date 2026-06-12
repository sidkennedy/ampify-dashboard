import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverInsurance, discoveryNeedsEnrollment, extractDiscoveredCoverages } from '@/lib/stedi'

const FALLBACK_NPI = '1033449558' // PAC — used when a superadmin (no clinic) runs discovery

/**
 * Insurance Discovery: find a patient's active coverage from minimal demographics.
 * Name + DOB runs, but a match usually needs SSN — that dramatically lifts the hit rate.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { firstName, lastName, dateOfBirth, ssn, zip } = await req.json()
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
    }

    // Provider NPI from the user's clinic (fallback to PAC for superadmin testing).
    let providerNpi = FALLBACK_NPI
    let org: string | undefined
    const { data: profile } = await supabase.from('profiles').select('clinic_id').eq('id', user.id).single()
    if (profile?.clinic_id) {
      const { data: clinic } = await supabase.from('clinics').select('npi, name').eq('id', profile.clinic_id).single()
      if (clinic?.npi) providerNpi = clinic.npi
      org = clinic?.name ?? undefined
    }

    const resp = await discoverInsurance({
      providerNpi, providerOrganizationName: org,
      firstName, lastName, dateOfBirth: dateOfBirth || undefined,
      ssn: ssn || undefined, zip: zip || undefined,
    })

    if (discoveryNeedsEnrollment(resp)) {
      return NextResponse.json({ error: 'This NPI is not yet enrolled for Insurance Discovery.', needsEnrollment: true }, { status: 400 })
    }

    const coverages = extractDiscoveredCoverages(resp)
    return NextResponse.json({
      coveragesFound: (resp.coveragesFound as number | undefined) ?? coverages.length,
      coverages,
    })
  } catch (err: unknown) {
    console.error('Discovery error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Discovery failed' }, { status: 500 })
  }
}
