// Curated payer registry — the routing profile for each payer the clinic bills.
// This is the "brain data": Stedi id (electronic), provider phone (calls),
// whether the line accepts bots (autonomous vs hybrid), and the hearing-aid
// carve-out vendor. Seeded from real testing (see PROJECT-STATUS.md).
//
// v1 lives in code (curated). Payers NOT here can still be verified
// electronically via Stedi directory search — they just won't have phone/bot/
// vendor routing until enriched. Later this can move to a `payers` DB table.

export interface HearingAidVendor {
  name: string
  phone: string | null
}

export interface PayerProfile {
  /** Stable key we use internally. */
  key: string
  /** Display name shown to the biller. */
  name: string
  /** Stedi tradingPartnerServiceId for electronic eligibility (null = electronic not set up). */
  stediPayerId: string | null
  /** Provider/eligibility phone line for AI calls (E.164-able). */
  providerPhone: string | null
  /** Does this payer's phone line accept automated/bot calls? false → hybrid (human transfer). */
  acceptsBots: boolean
  /** Hearing-aid carve-out vendor (TPA), if the HA benefit runs through one. */
  hearingAidVendor: HearingAidVendor | null
  /** Member-ID prefixes that hint this payer (used for soft auto-suggest). */
  memberIdHints?: string[]
  /** Phone numbers historically seen for this payer (helps migrate old records). */
  knownPhones?: string[]
  notes?: string
}

// The carve-out vendors (TPAs) a clinic can be credentialed with. Used by the
// settings UI checklist; values stored in clinics.vendor_contracts and matched
// (punctuation-insensitively) against each payer's hearingAidVendor.name.
export const KNOWN_VENDORS: string[] = [
  'TruHearing',
  "Nation's Hearing",
  'UHC Hearing',
  'Start Hearing',
  'Amplifon',
  'HearUSA',
]

// Syracuse Hearing Solutions' real payers (from the production call data + testing).
export const CURATED_PAYERS: PayerProfile[] = [
  {
    key: 'aetna',
    name: 'Aetna',
    stediPayerId: 'aetna', // alias confirmed working; primary id 60054
    providerPhone: '888-632-3862',
    acceptsBots: true, // proven: Aetna takes autonomous AI calls
    hearingAidVendor: { name: "Nation's Hearing", phone: '877-225-0137' },
    memberIdHints: ['W', '101'],
    knownPhones: ['1-888-632-3862', '888-632-3862'],
    notes: 'Bot-friendly. Diagnostic/ABR/APD/Vestibular all proven on autonomous calls. Electronic validated.',
  },
  {
    key: 'excellus',
    name: 'Excellus BlueCross BlueShield',
    stediPayerId: '10323', // stediId HIANX
    providerPhone: '800-920-8889',
    acceptsBots: false, // refuses bots → electronic for diagnostic, vendor for HA
    hearingAidVendor: { name: 'TruHearing', phone: '800-334-1807' },
    memberIdHints: ['SRO', 'YND', 'VYW', 'VYC', 'VYM', 'NFJ'],
    knownPhones: ['1-800-920-8889', '800-920-8889'],
    notes: 'No-bot payer. Electronic validated (87 benefit lines). HA → TruHearing.',
  },
  {
    key: 'uhc',
    name: 'UnitedHealthcare',
    stediPayerId: '87726', // stediId KMQTZ
    providerPhone: '877-842-3210',
    acceptsBots: false, // refuses bots → electronic for diagnostic, vendor for HA
    hearingAidVendor: { name: 'UHC Hearing', phone: null }, // vendor line TBD
    memberIdHints: ['890', '044', '022'],
    knownPhones: ['1-877-842-3210', '877-842-3210'],
    notes: 'No-bot payer. Electronic validated (55 benefit lines; NYSHIP). HA → UHC Hearing (line TBD).',
  },
  {
    key: 'bcbs_bluecard',
    name: 'BlueCross BlueShield (BlueCard / Out-of-State)',
    stediPayerId: '10323', // VERIFIED: submit BlueCard members to the LOCAL plan (Excellus, Syracuse) → routes nationally via BlueCard. Tested 5 prefixes (LEN/NUA/UCK/NYR/UCR), all returned rich data.
    providerPhone: '800-676-2583',
    acceptsBots: false, // phone member-ID-prefix spelling ~1/3 reliable → prefer electronic
    hearingAidVendor: { name: 'TruHearing', phone: '800-334-1807' },
    memberIdHints: ['UCR', 'NYR', 'UCK', 'NUA', 'LEN'],
    knownPhones: ['1-800-676-2583', '800-676-2583'],
    notes: 'BlueCard: submit to local Excellus host plan (10323) — Stedi routes to the member\'s home Blue plan automatically. Electronic-first (phone prefix-spelling unreliable). HA → TruHearing.',
  },
  {
    key: 'cigna',
    name: 'Cigna',
    stediPayerId: 'cigna', // alias; primary id 62308
    providerPhone: '800-882-4462',
    acceptsBots: false, // formal bot-approval process pending (aibot.approval.request@evernorth.com)
    hearingAidVendor: { name: 'Start Hearing', phone: null }, // line TBD
    notes: 'Bot approval pending with Evernorth. Use electronic meanwhile. HA → Start Hearing (line TBD).',
  },
  {
    key: 'humana',
    name: 'Humana',
    stediPayerId: 'humana', // alias; primary id 61101
    providerPhone: null, // correct provider line TBD (800-457-4708 did not answer)
    acceptsBots: false,
    hearingAidVendor: { name: 'TruHearing', phone: '800-334-1807' },
    knownPhones: ['1-800-457-4708', '800-457-4708'],
    notes: 'Provider line TBD. Electronic available.',
  },
  {
    key: 'umr',
    name: 'UMR',
    stediPayerId: '39026', // UMR on Stedi, eligibility SUPPORTED (regional variants also exist)
    providerPhone: null, // varies by plan; phone path is gated by a passcode (see notes) → not autonomous
    acceptsBots: false, // UMR requires a PASSCODE (via fax/portal) before a rep gives benefits by phone
    hearingAidVendor: { name: 'UHC Hearing', phone: null }, // UMR is UHC-administered; HA likely UHC Hearing
    knownPhones: ['1-800-826-9781', '800-826-9781'],
    notes: 'ELECTRONIC-FIRST — VERIFIED 2026-06-11 on real patient (Bixby): Stedi returned 303 rich benefit lines (deductible/OOP/copay/coinsurance), bypassing UMR\'s passcode/fax/call gate entirely. NOTE: UMR starves the response if STC 71 is sent — request STC 30 only (handled in serviceTypeCodesFor). Member match worked on memberId+DOB (first name on file differed). Phone/portal fallback would need a passcode (fax-back 315-320-0245 or umr.com) → hybrid/manual; we never fax.',
  },
]

const BY_KEY = new Map(CURATED_PAYERS.map(p => [p.key, p]))
const BY_STEDI = new Map(CURATED_PAYERS.filter(p => p.stediPayerId).map(p => [p.stediPayerId!.toLowerCase(), p]))

export function getPayerByKey(key: string): PayerProfile | undefined {
  return BY_KEY.get(key)
}

export function getPayerByStediId(stediId: string): PayerProfile | undefined {
  return BY_STEDI.get(stediId.toLowerCase())
}

/** Soft-match a curated payer from a legacy insurance phone number. */
export function getPayerByPhone(phone: string): PayerProfile | undefined {
  const norm = phone.replace(/\D/g, '').replace(/^1/, '')
  return CURATED_PAYERS.find(p =>
    (p.knownPhones ?? []).some(k => k.replace(/\D/g, '').replace(/^1/, '') === norm),
  )
}

/** Curated list for the form's quick-pick. */
export function listCuratedPayers(): PayerProfile[] {
  return CURATED_PAYERS
}
