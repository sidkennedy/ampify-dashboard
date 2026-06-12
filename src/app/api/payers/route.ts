import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listCuratedPayers } from '@/lib/payer-registry'
import { searchPayers } from '@/lib/stedi'

export interface PayerOption {
  key: string // curated key, or "stedi:<id>" for directory results
  name: string
  stediPayerId: string | null
  curated: boolean
  acceptsBots: boolean | null
  eligibilitySupported: boolean | null
}

// GET /api/payers            → curated quick-picks
// GET /api/payers?q=excellus → curated matches + Stedi directory matches
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const curated = listCuratedPayers()

  const curatedOptions: PayerOption[] = curated
    .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .map(p => ({
      key: p.key,
      name: p.name,
      stediPayerId: p.stediPayerId,
      curated: true,
      acceptsBots: p.acceptsBots,
      eligibilitySupported: p.stediPayerId ? true : null,
    }))

  if (!q) {
    return NextResponse.json({ payers: curatedOptions })
  }

  // Directory search (deduped against curated by stedi id).
  let directoryOptions: PayerOption[] = []
  try {
    const curatedStediIds = new Set(curated.map(p => (p.stediPayerId ?? '').toLowerCase()).filter(Boolean))
    const results = await searchPayers(q, 15)
    directoryOptions = results
      .map(r => {
        const id = (r.primaryPayerId ?? r.stediId ?? '') as string
        return {
          key: `stedi:${id}`,
          name: r.displayName ?? id,
          stediPayerId: id || null,
          curated: false,
          acceptsBots: null,
          eligibilitySupported: r.transactionSupport?.eligibilityCheck === 'SUPPORTED',
        } as PayerOption
      })
      .filter(o => o.stediPayerId && !curatedStediIds.has(o.stediPayerId.toLowerCase()))
  } catch (err) {
    console.error('Payer directory search failed:', err)
  }

  return NextResponse.json({ payers: [...curatedOptions, ...directoryOptions] })
}
