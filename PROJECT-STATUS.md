# Ampify — Project Status (READ THIS FIRST after a context clear)
_Master snapshot. Last updated 2026-06-11. Companion docs: `PRODUCT-ARCHITECTURE.md` (design/blueprint), `VAPI-CALL-TEST-LOG.md` (call-by-call test history)._

## What this project is
An **AI audiology insurance-verification system** for Preferred Audiology Care (DBA Syracuse Hearing Solutions). Client contacts: **Nicole** (owner), **Tammy** (full-time biller). The system verifies patient benefits via two channels — **electronic** (instant, no call) and **AI phone calls** (Vapi) — and routes each request to the cheapest channel that can answer. Dashboard is a Next.js app (lives in GitHub + Replit). The Vapi assistant + prompt are tuned via the Vapi API.

---

## ✅ WHAT'S PROVEN (validated on real calls)
- **Diagnostic via electronic (Stedi/EDI 270-271):** ✅ **VALIDATED LIVE 2026-06-11 via the production API** with the clinic's real NPI (`1033449558`). Three real patients from the prod DB, zero errors:
  - **Aetna** (Donna Michaud) → 37 benefits · MAPD · ded $0 · OOP $500
  - **Excellus** (Matthew Tryniski) → 87 benefits · ded $1,200/$2,400 · OOP $6,000 (remaining $5,893.51) · 20% OON coins
  - **UnitedHealthcare** (Peter Jacobs) → 55 benefits · NYSHIP · $25 office copay · prior-auth=Yes · self-insured large group
  - Returns active coverage, plan, deductible, OOP, cost-share, prior-auth & funding-type flags in ~2 sec. **Works for the no-bot payers (Excellus, UHC) — electronic is their ONLY channel, and it returns MORE than a call would.** HA allowance/carve-out detail is still NOT electronic.
  - Built: **`src/lib/stedi.ts`** — `checkEligibility()`, `serviceTypeCodesFor()`, `toStediDate()`, `searchPayers()`, and **`mapStediToEligibility()`** (271 → the same `EligibilityOutput` shape the Vapi assistant emits → reuses existing dashboard UI). Tested against all 3 real responses.
- **AI phone calls — bot-friendly payers:** Aetna ✅ (6+ successful calls — HA + diagnostic + ABR + APD + Vestibular).
- **Scenario 3 (ABR / APD / Vestibular):** ALL THREE validated on Aetna. APD even captured "experimental/investigational" coverage nuance + clinical policy bulletin + prior-auth.
- **Carve-out vendors are BOT-FRIENDLY:** TruHearing ✅ and Nation's Hearing ✅ both took AI calls and completed verifications. This is the key unlock (autonomy ~55% → ~85-90%).
- **Honest AI disclosure:** agent never claims to be human; says "automated assistant" when asked.
- **Hold survival:** agent waits through long holds (silence timeout 60 min, max call 2 hr).
- **Outcome capture:** structured `outcome` field flags redirect / needs-callback / not-covered (one extraction miss on a very complex call).

## ❌ WHAT DOESN'T WORK / KNOWN LIMITS
- **Excellus + UnitedHealthcare** refuse AI phone calls (policy) → use ELECTRONIC for diagnostic; VENDOR for HA.
- **BCBS BlueCard by phone** — member-ID prefix-spelling step is ~1/3 reliable → use ELECTRONIC for BlueCard, not phone.
- **Cigna** — won't take unapproved bots, BUT has a formal approval process (email sent to aibot.approval.request@evernorth.com). Provider line 800-882-4462.
- **UMR** — automated line is fax-only (no verbal path). Need fax # from practice.
- **Humana** — 1-800-457-4708 didn't answer (likely TTY/wrong). Need correct provider line.

## 🔧 WHAT'S LEFT TO BUILD (none of this is "does it work?" — it's "wire it together")
1. **Dynamic hybrid transfer destination** — hybrid transfer is BUILT (see below) but the transfer number is currently STATIC (`+17473898407`, the test mobile) baked into the hybrid assistant's transferCall tool, because Vapi rejects a `{{variable}}` as a static destination at config time. To make it per-clinic: implement the **`transfer-destination-request` server webhook** (set `server.url` on the hybrid assistant → handler reads `call...variableValues.billerPhone` → responds `{destination:{type:'number',number:billerPhone,...}}`). The `billerPhone` variable + `clinics.biller_phone` plumbing is ALREADY built and flowing; only the Vapi destination needs to become dynamic. ⚠️ **SQL to run:** `supabase/migrations/20260611_add_biller_phone.sql` → `ALTER TABLE clinics ADD COLUMN IF NOT EXISTS biller_phone text;`
2. **Hybrid transfer live test** — fire one hybrid call to a no-bot payer (e.g. Excellus, ABR) and confirm: AI navigates IVR/hold → reaches a human → warm-transfers to the mobile with the briefing message. Tune the hybrid prompt from the transcript.
3. **Per-clinic vendor contracts** — ✅ BUILT (Settings → "Hearing-Aid Vendor Contracts" checklist; `/api/calls` reads `clinics.vendor_contracts` and feeds the router). ⚠️ **ONE MANUAL STEP:** run `supabase/migrations/20260611_add_vendor_contracts.sql` in the Supabase SQL editor — `ALTER TABLE clinics ADD COLUMN IF NOT EXISTS vendor_contracts text[] NOT NULL DEFAULT '{}';` (PostgREST can't DDL; no DB conn/mgmt token available). Until run: everything works, HA stays refer-out (correct default), but the Save button on the vendor card errors. Vendor list = `KNOWN_VENDORS` in `payer-registry.ts`.
4. **Find UHC Hearing + Start Hearing vendor lines** — only matters for clinics actually contracted with them (number missing → those HA cases route to `needs_setup` instead of an autonomous call). Add to `src/lib/payer-registry.ts`.
4b. ~~**Webhook merge**~~ ✅ DONE — `/api/webhooks/vapi` deep-merges a completed call's result OVER the electronic foundation (call wins where present, foundation fills gaps); keeps the foundation when a call has no structured output (e.g. hybrid).
5. **Dashboard display** — ✅ BUILT. `ChannelBadge` (⚡ Electronic / 📞 AI Call / 👤 Hybrid / ↪ Refer-out / ⚙ Needs setup) on the calls list (replaced the Insurance Phone column) + call detail header. Detail also shows an **outcome banner** (refer-out / needs-callback / not-covered) from `structured_output_eligibility.outcome`. Channel now in a dedicated **`calls.channel`** column (NOT `ended_reason` — the Vapi webhook owns that). ⚠️ **SECOND MANUAL SQL:** `supabase/migrations/20260611_add_call_channel.sql` → `ALTER TABLE calls ADD COLUMN IF NOT EXISTS channel text;` — **required before creating new calls** (the insert writes `channel`).
6. ~~**Deductible/OOP accumulator selection**~~ ✅ DONE — `mapStediToEligibility` now ignores "Year-to-Date met" lines and takes the period cap (largest), so a $0 YTD line no longer clobbers the real deductible (fixed UHC $0→$1,250). Also captures DME cost-share into `hearingAidBenefit`.
7. **Payer registry → DB table** (optional) — move `src/lib/payer-registry.ts` to a `payers` table for admin editing at scale (needs the SQL run in Supabase; no direct PG conn available).

### 🔬 ELECTRONIC RESEARCH (2026-06-11) — see `STEDI-RESEARCH-FINDINGS.md`
Tested STCs + procedure codes against real patients. **Conclusion: routing is already cost-optimal.** Procedure codes (CPT/HCPCS) add NOTHING — payers ignore them and return the general dump → **ABR/APD/vestibular genuinely can't go electronic** (the call is necessary). Hearing-aid **allowance/frequency is NOT in the 271** (only DME cost-share) → HA still needs vendor/refer. **Do NOT send procedure codes.** No easy electronic win is being left on the table.

### ✅ DONE — HYBRID TRANSFER + PER-TARGET ASSISTANT ROUTING (built 2026-06-11, build passes)
- **Architecture decision:** hybrid uses a SEPARATE lean assistant — NOT a branch in the proven autonomous prompt — so the proven autonomous flow has zero regression risk. Three assistants now: PAYER (autonomous, proven), VENDOR (HA TPA calls), HYBRID (transfer).
- **HYBRID assistant** `3b521c71-a4a0-4a65-8ea0-28e39edc07c7` ("Eligibility AI — Hybrid Transfer") — cloned the payer assistant's voice/transcriber/settings (maxDur 7200, silence 3600, bgSound off) + dtmf/endCall tools; prompt = `vapi-hybrid-prompt.md` (front-half only: identity/disclosure/IVR/DTMF/hold + "reach a human then TRANSFER, never verify"). Added inline **`transferCall`** tool, warm-transfer-say-message, destination `+17473898407` (static for now).
- **`startVapiCall` routes by `target`** ('payer' | 'vendor' | 'hybrid') → picks `VAPI_ASSISTANT_ID` / `VAPI_VENDOR_ASSISTANT_ID` / `VAPI_HYBRID_ASSISTANT_ID`. This also resolved the old "vendor assistant selection" item.
- **`/api/calls`:** `hybrid_call` channel now FIRES a real Vapi call (was staged/queued) with `callMode='hybrid'`, `target='hybrid'`, `billerPhone` (clinic's `biller_phone` → E.164, else default mobile). Autonomous vendor HA calls → `target='vendor'`.
- **Settings:** "Biller Transfer Number" field added (saves `clinics.biller_phone`). Will be an onboarding field per clinic.
- Env added: `VAPI_HYBRID_ASSISTANT_ID`, `VAPI_VENDOR_ASSISTANT_ID`. Hybrid prompt shares the front-half with `vapi-system-prompt.md` — keep IVR/DTMF/disclosure rules in sync across both.

### ✅ DONE — PAYER-DRIVEN MULTI-CHANNEL DASHBOARD (built 2026-06-11, full `next build` passes)
- **Reframe: payer-first, not phone-first.** Biller picks the PAYER (no phone number entry); the system auto-routes to the cheapest channel + correct number.
- **`src/lib/payer-registry.ts`** — curated profiles for the clinic's real payers (Aetna, Excellus, UHC, BCBS/BlueCard, Cigna, Humana) with Stedi id, provider phone, `acceptsBots`, HA carve-out vendor. (This is also the per-clinic "which TPAs am I in" config — "number three".)
- **`src/lib/routing.ts`** — the routing brain: `planRoute(type, payer, contractedVendors)` + `resolveChannel()`. Electronic-first, escalate only if needed. Validated across Aetna/Excellus/UHC × diagnostic/HA/ABR.
- **Carve-out vendor logic (per-clinic contracts).** A clinic is only called into a TPA it's CONTRACTED with. `planRoute` takes `contractedVendors` (default `[]`). For hearing aids: contracted → autonomous vendor call; **not contracted → `carve_out_refer`**: no call, returns a complete "refer / private-pay" disposition via `outcome.status='redirected'` (vendor name, reason, nextAction). **Preferred Audiology Care is in NO vendor networks (TruHearing + Nation's Hearing both confirmed not-in-network) → all their HA verifications return refer-out, zero pointless vendor calls.** `contractedVendors` currently passed as `[]`; will come from clinic onboarding.
- **`/api/payers`** — curated quick-picks + Stedi directory search (the form's payer selector).
- **`/api/calls` rewritten** — resolve payer → read clinic `vendor_contracts` → run Stedi electronic first → if it completes, status `completed` (no call); else auto-fire the right call (autonomous Vapi to payer/vendor), or stage hybrid/needs-setup, or return `carve_out_refer`. Electronic runs even in TRIAL_MODE (it's not a call). Channel saved to the dedicated `calls.channel` column.
- **`NewCallForm.tsx`** — phone field replaced with a searchable payer selector (SAVED + ⚡Electronic badges) + a plain-English channel preview. Button now "Verify X" (not "Run Call").
- Channel decisions confirmed: Aetna diag→electronic, HA→Nation's Hearing; Excellus diag→electronic, HA→TruHearing, ABR→hybrid; UHC diag→electronic, ABR→hybrid, HA→needs-setup (vendor # missing).

### ✅ DONE (merged from Replit 2026-06-11 — local repo is now the integrated source of truth, type-checks clean)
- Dashboard: **6 verification cards** incl. **BCBS Out-of-State** (`bcbs_oos`, manual code entry)
- **Subscriber Name + DOB** wired form→API→DB→Vapi variableValues
- **E.164 phone normalization** (`toE164()` in `lib/vapi.ts`) + bad-number rejection
- **Outcome object + 4 HA fields** in `types/index.ts` (match the Vapi structured outputs)
- **"Fire Call" feature** (`FireCallButton.tsx` + `api/calls/[id]/fire/route.ts`) — manually trigger a queued call
- DOB validation, expanded plan types
- _(Replit's `.migration-backup/src` was the canonical app; `artifacts/*` folders are restructuring mess — ignored. Local repo `src/` now has it all.)_

---

## 🚀 EXPANSION MODE — REVENUE-CYCLE PLATFORM (built 2026-06-11, build passes)
The product grew from "AI verification" into a full audiology revenue-cycle platform, **toggle-able per clinic** via feature flags. Base product (always on): **Eligibility + Insurance Discovery**. Expansion (per-clinic flags in `clinics.features` jsonb): **Claim Status, Claims Submission, ERA, COB**.

- **Feature system:** `src/lib/features.ts` (registry + `clinicHasFeature()`), `clinics.features jsonb`, superadmin toggle UI in **Admin → "Feature access — expansion mode"** (`ClinicFeatureManager.tsx`). PAC has claim_status/claims/era enabled.
- **Insurance Discovery:** `discoverInsurance()` in `stedi.ts`. Finds coverage from name+DOB. ⚠️ needs one-time NPI enrollment (Payer ID `DISCOVERY`).
- **Claims module** (`/claims`, gated): `claims` table (RLS), `lib/claim-status.ts` (276/277), `lib/claims-submit.ts` (837P), `lib/era.ts` (835 + CARC/RARC denial reasons). Track → **Submit (837)** → **Check status / Check all (276/277)** → **Sync remittances (835)** auto-posts payments. **AR/denials overview** on the page + the **home dashboard**.
- **Verify → bill:** verification detail has a "Create claim" button → `/claims?from=<callId>` pre-fills the claim.
- **Cost tracking:** `calls.electronic_checks/electronic_cost` + Vapi `cost` → superadmin **Cost Tracker** (`/costs`). `STEDI_COST_PER_CHECK` env (default $0.25).
- ⚠️ **All expansion transactions need NPI enrollment** (untestable until then). **3 endpoint URLs are best-guesses** (claim status `…/claimstatus/v2`, claims `…/professionalclaims/v3/submission`, ERA `…/reports/v2/{id}/835`) — VERIFY on first live transaction.
- **Pending SQL run? YES** (user ran features + claims tables 2026-06-11). Migrations: `add_clinic_features`, `add_claims`, `add_claim_submission`, `add_cost_tracking`, `add_biller_phone`.
- **Superadmin = no clinic** (Fine Tone deleted). Clinic-facing tools (New Verification, Claims) need a clinic login.

## SCENARIO HANDLING (how each is routed)
| Scenario | Channel | Notes |
|----------|---------|-------|
| **Diagnostic** | Electronic (Stedi STC `71` / `30`) | ~30s, no call. Works every payer. |
| **Hearing Aid** | Electronic foundation + **call** | Bot-friendly payer → AI calls payer. Carve-out → AI calls VENDOR (TruHearing etc.). No-bot + no vendor → hybrid (Tammy). |
| **ABR / APD / Vestibular** | Electronic foundation + **call the PAYER** (not a vendor — not carved out) | Bot-friendly payer → autonomous. No-bot → hybrid. ABR/APD/Vestibular all proven on Aetna. |
| **BCBS Out-of-State** | Mostly electronic (BlueCard routes by member prefix to home plan) + maybe payer/portal check for provider participation | Not a vendor. Untested (needs card). |

**Only hearing aids go to an outside vendor. Everything else is the payer directly.**

---

## 🧭 STRATEGIC FINDING: why audiology clinics avoid the hearing-aid vendors (TPAs) — important for scaling
**Researched 2026-06-11.** The carve-out "vendors" are **Third-Party Administrators (TPAs)** — companies that manage a payer's hearing benefit: TruHearing, Nation's Hearing, UHC Hearing, Amplifon, HearUSA. A lot of hearing-aid benefits run through them. Verified on calls: **both TruHearing AND Nation's Hearing independently confirmed Preferred Audiology Care is NOT in their network.**

**WHY many quality audiology practices deliberately refuse to join these TPAs:**
1. **Terrible reimbursement.** TPAs pay the provider only a **small fitting fee** and cap follow-up at roughly **$65/visit or $250/year**. Practices frequently **lose money** on every TPA patient once rent/staff/time are factored in. Prominent audiologist **Dr. Cliff Olson publicly documented "Why I Had To Leave TruHearing."**
2. **Conflict of interest / product control.** TruHearing is owned by **WS Audiology (WSA)** — the world's #3 hearing-aid *manufacturer* (Widex, Signia, Rexton, also owns HearUSA, hear.com). The TPA steers patients to its own private-label devices, commoditizing the audiologist into a low-margin fitting service.
3. **Loss of autonomy & quality-of-care concerns** — TPAs control pricing, product, and process; the financial pressure pushes providers to spend less time per patient.
4. **Enrollment itself is usually FREE** — the barrier isn't a signup cost, it's the unfavorable economics, which is why practices *choose* to opt out.

**PRODUCT IMPLICATIONS (this is the important part):**
- **Do NOT make vendor registration an onboarding requirement** when scaling to ~100 clinics. Many of the best target practices avoid TPAs on purpose; forcing it would kill onboarding.
- **The verification works EITHER way:**
  - Clinic IS in the TPA network → the vendor call returns the **full hearing-aid benefit detail** (allowance, frequency, etc.).
  - Clinic is NOT in the network (common) → the vendor call still returns a complete, useful answer: *"This benefit runs through TruHearing; you're not in their network; the patient goes through them"* → tells the biller it's a **TPA-only benefit = private-pay or refer-out**, not something they bill. Still fully autonomous, just a different (and accurate) result.
- So the product is **more** scalable for *not* depending on clinics joining the TPAs.
- For the client email: **soften the "would you register?" ask** — frame it as "many practices skip TPAs due to reimbursement, totally fine; the system flags TPA-only benefits either way so Tammy knows it's private-pay/refer."

**Sources:** Dr. Cliff Olson "Why I Left TruHearing" (hearingup.com); "Hearing Aid TPAs Explained" (hearshearingandhearables.com); TruHearing owned by WS Audiology.

---

## ⚙️ OPERATIONAL REFERENCE (how to actually run things)
**Vapi assistants:**
- PAYER (proven — Aetna/BlueCard, autonomous): `3857a8f2-4013-4731-b03a-3e299dbdd5d8` · prompt `vapi-system-prompt.md`
- VENDOR (HA TPA calls): `7d13a6c3-70d3-4c70-97e9-f4b03fe2c93a`
- HYBRID (transfer to biller): `3b521c71-a4a0-4a65-8ea0-28e39edc07c7` · prompt `vapi-hybrid-prompt.md` · has inline `transferCall` (warm, dest +17473898407 static)
- Env: `VAPI_ASSISTANT_ID` (payer), `VAPI_VENDOR_ASSISTANT_ID`, `VAPI_HYBRID_ASSISTANT_ID`. `startVapiCall({target})` picks.
- Tools (both): `de4c7eec…` (dtmf), `e077d9d2…` (endCall)
- Structured outputs (both): `4d4d45ca…` (Eligibility & Benefits — has the `outcome` field), `6d982bdb…` (Code-by-Code)
- Settings: `maxDurationSeconds 7200`, `silenceTimeoutSeconds 3600`, `backgroundSound "off"`, `messagePlan.idleMessages []`
- The full prompt is in `vapi-system-prompt.md`. To update: PATCH `/assistant/{id}` with the model block (keep toolIds + the settings above). **Pull live first** before editing (someone may have edited in the Vapi dashboard).

**Outbound calling:**
- Working phone number ID (Twilio): `9140fdc9-caa3-4797-affa-7183d0a159fe`
- **Test callback number = `747-389-8407`** (the user's number — ALWAYS set `callbackNumber` to this for tests so the client isn't called back).
- Fire a call: `POST https://api.vapi.ai/call` with `{assistantId, phoneNumberId, customer:{number:"+1…"}, assistantOverrides:{variableValues:{…}}}`. Numbers must be **E.164** (`+1` + 10 digits).
- variableValues keys: patientName, dob, memberId, providerNPI, clinicTaxId, clinicName, clinicAddress, callbackNumber, verificationType, codesRequested, diagnosisCode, dateOfService, planType, state, subscriberName, subscriberDob

**Clinic (hardcoded) info:**
- NPI `1033449558` · Tax ID `26-4259617` · "Preferred Audiology Care (DBA Syracuse Hearing Solutions)" · 307 Kasson Rd, Camillus, NY 13031

**Codes per verification type (corrected per Nicole's email):**
- diagnostic: `92557, 92567, 92550, 92625` / `H90.3`
- hearing_aid: `V5261, V5260, V5257, V5256, V5264` / `H90.3`
- abr: `92652, 92653` / `H93.0`
- apd: `92620, 92621` / `H93.25`
- vestibular: `97750, 92540, 92537, 92546, 92517, 92518, 92519, 92653, 92584, 92547` / `R42.0`

**Carve-out vendor map (from Nicole) + numbers:**
- BCBS → **TruHearing** (844-394-5420 UAW plan / 800-334-1807 general)
- Aetna → **Nation's Hearing** (877-225-0137 Aetna / 800-921-4559 general)
- UHC → **UHC Hearing** (number TBD) · Cigna → **Start Hearing** (number TBD)

**Stedi (electronic eligibility) — OPERATIONAL:**
- Endpoint: `POST https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3`
- Auth header: `Authorization: <STEDI_API_KEY>` (RAW key, **not** "Bearer"). Key in `.env.local` as `STEDI_API_KEY`. It is a **PRODUCTION** key (`meta.applicationMode: production`) → real checks, billable. Mock/canned data needs a separate TEST key.
- **Dates must be `YYYYMMDD`** (no dashes). `src/lib/stedi.ts` `toStediDate()` handles it.
- Request: `{controlNumber, tradingPartnerServiceId, provider:{organizationName, npi}, subscriber:{firstName,lastName,dateOfBirth,memberId}, encounter:{serviceTypeCodes:[...]}}`. Subscriber = the patient (adults). At least one of memberId/dob/lastName required.
- STCs: always send `30` (general dump) + specific: diagnostic/ABR/APD/vestibular `71` (Audiology Exam), hearing aid `DM` (DME). Payers often ignore the specific code and return the full `30` dump — still gives the foundation.
- **Confirmed Stedi payer IDs:** Aetna `aetna` (alias works) · Excellus BCBS `10323` (stediId HIANX) · UnitedHealthcare `87726` (stediId KMQTZ) · **UMR `39026`** (send STC 30 only!) · **BCBS BlueCard → `10323`** (submit to local Excellus host plan; Stedi routes nationally by member prefix — verified on LEN/NUA/UCK/NYR/UCR). Payer lookup: page `GET /2024-04-01/payers?pageSize=1000` (the `query` param does NOT filter; grep client-side. `/search/payers` 404s at this version). Eligibility support flag = `transactionSupport.eligibilityCheck` (SUPPORTED / ENROLLMENT_REQUIRED / NOT_SUPPORTED).
- AAA errors: `43` Invalid/Missing Provider ID (NPI not registered / payer needs agreement) · `79` Invalid Participant ID (wrong payer id) · `75` member not found.

**Keys (all in `.env.local`, gitignored):** Vapi API key, Supabase URL + anon + service-role keys, Vapi assistant/phone IDs, TRIAL_MODE.
**Query Supabase:** REST API at `https://idkrzuqszkfocmpxabuz.supabase.co/rest/v1/calls` with the service-role key as `apikey` + `Authorization: Bearer`.

---

## IMMEDIATE NEXT STEPS (when resuming)
1. Find **UHC Hearing + Start Hearing** provider lines; test them on the VENDOR assistant.
2. Build the **Stedi integration** + **dashboard routing** (Replit).
3. **Replit→GitHub merge** when user uploads the zip.
4. Send the client email (draft is in conversation; soften the vendor-registration ask per the TPA finding).
5. Cigna: await Evernorth bot-approval reply.
