# Ampify — Vapi Call Test Log & Issue Tracker

**Purpose:** Track every test verification call, the issues found, and whether they're resolved — so we systematically harden the Vapi prompt and never lose track of what was already fixed.

**How it works:** After each test call, give Claude the **call ID**. Claude pulls the transcript via the Vapi API, logs the call below (grouped by verification type), records any new issues in the Issue Tracker, and — once a fix is applied to the prompt/settings — moves the issue to **Resolved** with the fix and date.

**Assistant:** `Eligibility AI` (`3857a8f2-4013-4731-b03a-3e299dbdd5d8`)

---

## 🔴 Issue Tracker (the running memory)

### Open issues
| # | Verification Type | Issue | First seen (call ID) | Notes |
|---|---|---|---|---|
| O6 | UHC (info) | Oliver Brown's plan is out-of-scope for general advocate — routed to "EMParts" dept (Kingston NY, 877-769-7447). Plan-specific, not an agent bug | 019eb79d | Use a different UHC patient (Angela Samponga / Joan Booth / Jeffrey Johnson) for a clean UHC benefits test |
| O7 | All (low priority) | Agent's name came out as "Benel" → rep heard "Daniel/Danielle" repeatedly | 019eb79d | Have agent state "Ben Letterman" slowly/clearly on first human contact |
| O8 | Cigna (number issue) | Both Cigna calls connected but produced 0 messages / $0 / twilio-completed — line never engaged. `1-800-997-1654` is a Cigna **member/HealthSpring** line, not provider eligibility | 019eb79f (both) | NOT an agent issue. Verify Cigna **provider** number with the practice. Standard provider lines: 800-882-4462 (main), 888-831-0761 (PPO eligibility) |
| O9 | All (structured output, minor) | `outcome` field captured `status: needs_callback` ✅ but did NOT populate `redirectPhone`/`nextAction` even though the callback # (877-842-3210) was given | 019eb7c0 | Tighten outcome-field descriptions to also pull the redirect number/next action when status≠benefits_captured. R15 honest-disclosure + R16 outcome status both CONFIRMED working on this call. (Later FULLY worked on 019eb7cd BlueCard.) |
| O10 | All (IVR recognition) | IVRs repeatedly "didn't understand" the agent at speech steps (BlueCard ID-prefix spelling failed & hung up; UMR; Cigna). **Hypothesis: `backgroundSound: office` (R17) is degrading IVR speech recognition** | 019eb80b-7aef, -9448 | Background sound gives ~no benefit (policy rejections beat it anyway). RECOMMEND removing it. Also: when spelling letters to an IVR, may need clearer/slower single-letter strategy. |
| O11 | BlueCard | Member-ID 3-char prefix spelling not recognized; IVR hangs up. **~1-in-3 success** (UCK worked; LEN, NUA failed). **CONFIRMED: NOT background sound** — failed again with bg sound OFF (019eb844-102a, -1c98). Systemic IVR-recognition + agent re-saying letters after "correct?" | 019eb80b-7aef, 019eb844-102a, 019eb844-1c98 | Phone unreliable for BlueCard prefix → prefer **electronic (Stedi)** for BlueCard. Prompt fix: confirm with only "yes/no", never re-say the value. |
| O12 | All (Aetna seen) | Agent goes PASSIVE after an automated eligibility readout ("I'm listening") instead of pressing to reach a rep → IVR disconnects before getting the type-specific detail | 019eb844-35b0 (APD) | Prompt fix: after an automated eligibility readout, if more detail is needed, PROACTIVELY select the option to reach a representative — don't just wait. |
| O1 | All (low priority) | Diagnosis code H90.3 mis-read aloud as "h nine eighty point three" | 019eb354 | Cosmetic; reps care about CPT codes. Fix later with a "read codes character-by-character" rule if it recurs. NOTE: read correctly on 019eb375, so may be intermittent. |
| O2 | All (low priority) | Agent narrated reasoning out loud during IVR ("Looking at this group... let me continue to the fourth group") instead of silently pressing keys | 019eb375 | Didn't break anything — call succeeded. Minor polish: reinforce "navigate silently" if it recurs. |
| O3 | Data/test (watch) | IVR couldn't match patient DOB to member ID (George Sedlack 09/29/1948; Horace White also mis-heard as "Orest White") — errored before transfer | 019eb3a1, 019eb3a9 | Recurring on test data — IVR voice-matching of name/DOB fails, then transfers to human (who validates manually). For REAL patients this matters less since a human re-validates, but exact DOB entry helps. Not blocking — both calls still succeeded via rep. |
| O4 | All (low priority) | Agent occasionally speaks during the IVR before reaching a human (O2 recurrence) — IVR replies "I didn't understand" | 019eb3a9 | Self-recovers, doesn't block. Tighten "navigate silently / don't speak until a human greets you" if it keeps happening. |

### ✅ Resolved issues
| # | Type | Issue | Fix applied | Resolved | Call(s) |
|---|------|-------|-------------|----------|---------|
| R1 | All | Agent spoke to the IVR ("Oh") instead of pressing keys; never entered member ID / DOB | Rewrote IVR/DTMF section: never speak to an IVR, use the `dtmf` tool, enter IDs/dates as digit tones | 2026-06-10 | 019eb2b7 |
| R2 | All | Agent went silent after IVR→human transfer (`silence-timed-out`) | Added "transition to human / never go silent" rules | 2026-06-10 | 019eb2b7 |
| R3 | All | Call cut off at 10 min while rep was pulling benefits (`exceeded-max-duration`) | `maxDurationSeconds` 600 → 3600 (60 min) | 2026-06-10 | 019eb314 |
| R4 | All | Spoke the callback number too fast; rep had to ask twice | Added "speak all numbers slowly, one digit at a time, grouped with pauses" rule | 2026-06-10 | 019eb314 |
| R5 | All | Got stuck in an IVR service-type-code submenu | Added generalized "when stuck, reach a representative" fallback (doesn't assume 0) | 2026-06-10 | 019eb314 |
| R6 | Hearing Aid | Missing client-required fields: fee-schedule vs flat, benefit still available / last used, prior-auth phone #, payer→vendor mapping | Added to HA checklist in prompt + added 4 fields to Vapi structured output | 2026-06-10 | (client doc) |
| R7 | ABR/APD/Vestibular | Not asking "are codes valid & billable" or capturing prior-auth phone # | Added to all three sections (client Scenario 3) | 2026-06-10 | (client doc) |
| R8 | Infra | All calls failing at start (`call.start.error-get-transport`) across all providers | Vapi account/transport issue — fixed on Vapi's side (not code) | 2026-06-10 | 019ea8xx |
| R9 | All | Died on a HOLD — rep put agent on hold, 30s silence timeout killed the call | `silenceTimeoutSeconds` 30 → 300; added "handling holds — never hang up during a hold" rule | 2026-06-10 | 019eb354 |
| R10 | All | Agent said the word "pause" out loud when reading numbers (read "(pause)" from prompt literally) | Reworded slow-numbers rule to use silent beats + "never say the word pause" | 2026-06-10 | 019eb354 |
| R11 | All | Long/silent holds risk dropping the call; 60-min total too short for ~50-min holds | maxDuration 60→120 min; silence timeout → 60 min (Vapi max). Idle "still holding" messages were trialed then **removed** as unnecessary — silence timeout alone protects holds; any audio (speech/music) resets the timer, only pure dead air counts down. Vapi limits found: maxDuration ≤ 43200s (12h), idleTimeout ≤ 60s, idleMaxCount ≤ 10 | 2026-06-10 | 019eb354 |
| R12 | All (structured output) | Reference #s and dates sometimes saved as spelled-out WORDS ("three five zero..." / "January one two thousand twenty five"); "no deductible/$0" left blank | Added normalization rules to both Vapi structured outputs: numbers as digits, dates as "Month D, YYYY", phone w/ option, record 0 not blank, 100% covered → coinsurance 0%. (Extraction-only — no new fields, no Replit change.) **Confirmed working on 019eb3c8.** | 2026-06-10 | 019eb375/3a1/3a9 |
| R13 | All (structured output) | When a rep corrects a value mid-call (e.g. OOP $2,650→$9,250), extractor kept the FIRST value | Added "CORRECTIONS: always record the FINAL corrected value" rule to both structured outputs | 2026-06-10 | 019eb3c8 |
| R14 | UnitedHealthcare (+ any conversational-AI payer) | UHC answers with a virtual assistant ("Avery"), not a DTMF tree. Saying "provider eligibility verification" misrouted the call to the **credentialing/contracts** dept, which doesn't do benefits → dead end | Added "CONVERSATIONAL VIRTUAL ASSISTANTS" rules: lead with "member benefits and eligibility," choose "medical" → "benefits and eligibility," never say "provider verification/credentialing/contracting." UHC main line 877-842-3210. | 2026-06-11 | 019eb79b |
| R15 | All | Agent claimed "I'm a human" when directly asked if it was an AI (bot-disclosure/legal risk) | User chose honest deflection: agent never claims to be human — first redirects to the task, and if pressed says "I'm an automated assistant calling on behalf of the clinic." Replaced both "never reveal you are an AI" lines | 2026-06-11 | 019eb79d |
| R16 | All | "Call a different number/department" outcomes (e.g. EMParts redirect) were buried in notes — biller could miss the next step | Vapi side done: added `outcome` field to structured output (status / nextAction / redirectPhone / redirectReason) + prompt rule to capture & read back redirect number/dept/reason. **Replit still needs to display it as a banner.** | 2026-06-11 | 019eb79d |
| R17 | All (esp. UHC) | **UHC advocate (Jose) said "you sound like a bot" and disconnected** — agent sounded synthetic (scripted intro, dead-silent line, uniform responses). R14 routing worked, reached human, but got hung up on | Added `backgroundSound: office` (call-center ambiance) + "SOUND HUMAN" prompt rules (vary wording, fillers, casual tone, short intro, handle bot-suspicion gracefully). **Voice swap (#3) still optional/pending user.** Note: Aetna reps never flagged it across 4 calls. | 2026-06-11 | 019eb7aa |

---

## ✅ Action Items / To-Dos (updated 2026-06-11, 1:30 PM PST)

**🔬 Electronic (Stedi / EDI 270-271) — the new second channel:**
- [x] Confirmed Excellus electronically: **Diagnostic = fully electronic-able; Hearing-Aid specifics = NOT.** (STC 71 ignored → default dump; STC DM honored → general DME 20% coinsurance, but no HA allowance/carve-out/frequency.)
- [x] **UHC via Stedi — CONFIRMED RICH** (Peter Jacobs, `ec_019eb861`/`ec_019eb860`): diagnostic fully electronic incl. prior-auth + COB. HA → "call for HCAP rules." **Recovered the #2 no-bot payer for diagnostic.**
- [ ] Run **BlueCard / Cigna / UMR / Humana** through Stedi to map electronic coverage per payer.
- [ ] **Decision:** for no-bot payers (Excellus, UHC), do **Diagnostic via Stedi (electronic)** instead of phone. Phone bot only for the audiology-specific hearing-aid gaps.

**📞 Phone bot:**
- [ ] **Pull & analyze the 5 calls fired earlier** (BlueCard Kellie HA, BlueCard Joshua diagnostic, Aetna ABR/APD/Vestibular — IDs `019eb844-*`). Background sound was OFF for these → also tests BlueCard spelling reliability + first Scenario-3 results.
- [ ] **UMR — get fax number** from practice → enable fax path (AI provides fax #, UMR faxes benefits; user OK with fax-back).
- [ ] **Humana — retry** number during business hours / confirm correct provider line with practice (457-4708 didn't answer; prefers Availity portal).
- [ ] **Cigna — await Evernorth bot-approval reply** (email sent to aibot.approval.request@evernorth.com; provider line 800-882-4462 works once approved).

**🖥️ Dashboard (Replit):**
- [ ] Display `outcome` banner (redirect / needs-callback / not-covered).
- [ ] Build **BCBS Out-of-State (`bcbs_oos`) card** for Scenario 4.
- [ ] Display the 4 new hearing-aid fields (fee-schedule, benefit-still-available, last-used, prior-auth phone).

**🧭 Strategic:**
- [ ] Lock product model: **electronic-first (diagnostic) + AI phone for audiology gaps (HA allowance/carve-out) + bot-approval registrations.** The defensible niche = audiology-specific HA detail nobody returns electronically.

---

## 🏥 Per-Insurer Viability (ranked by volume)
| Rank | Insurer | Patients | Records | Status | Notes |
|---|---|---|---|---|---|
| 1 | **Excellus BCBS** | 20 | 36 | ❌ **NOT VIABLE (policy)** | **"We cannot speak to a digital assistant"** — 2 reps (Gabby, Amanda) both refused. Agent navigated IVR + held patiently + disclosed honestly; it's policy. Provider must call directly. |
| 2 | **UnitedHealthcare** | 10 | 21 | ❌ **NOT VIABLE (policy)** | Requires LIVE human; declines honestly-disclosed bot (Jose hung up; another advocate asked→declined). Use UHCprovider.com portal/chat. |
| 3 | **BCBS BlueCard** | 5 | 10 | ✅ **VIABLE** | Reps DID help the bot (routed to BCBS Michigan via UCK prefix; 2 reps assisted). Complex IVR navigated fine. Carve-out → TruHearing captured perfectly. NOTE: routes by member prefix, so home-plan policy may vary per patient. |
| 4 | **Aetna** | 5 | 9 | ✅ **VIABLE** | 4 clean successes. Reps don't screen for bots. |
| 5 | **Cigna** | 2 | 4 | 🟡 **VIABLE w/ bot approval** | Provider line **800-882-4462 works** (member line 997-1654 was dead). Rejects UNAPPROVED bots but has a formal approval process: **aibot.approval.request@evernorth.com**. Register the bot → Cigna works. |
| 6 | **UMR** | 2 | 2 | ❌ **fax-only line** | Automated line only faxes benefits, no live-rep path; demanded a fax #. Not a bot rejection (UMR greeting says "we may use AI"). Need portal or a different live-rep number. |
| 7 | **Humana** | 1 | 2 | ❓ **wrong number** | `1-800-457-4708` didn't answer (likely TTY line). Need Humana's real provider line. |

**STRATEGIC FINDING (2026-06-11) — it's PER-PAYER, not family-wide:** Some payers refuse digital assistants as policy (**Excellus BCBS, UnitedHealthcare** — 2 reps each), but others are totally fine (**Aetna, BCBS BlueCard/BCBS-Michigan** — reps assisted the bot through complex flows). So the no-bot policy is **payer-specific, NOT brand/family-wide** (BlueCard works even though Excellus, also BCBS, doesn't).

**Implications:**
- Confirmed VIABLE: Aetna, BlueCard. Confirmed NOT: Excellus, UHC. Untested: Cigna, UMR, Humana.
- For no-bot payers, consider **HYBRID** (AI navigates IVR + holds, warm-transfers to human biller when rep answers) — keeps the no-hold value while satisfying "human only" policy.
- Carve-out flow (BCBS→TruHearing) + `outcome` field both proven working end-to-end on the BlueCard call.

---

## 💻 Electronic Eligibility (Stedi / EDI 270-271) — Findings
**Tested 2026-06-11.** Stedi runs electronic 270/271 eligibility checks — **no phone, no IVR, no bot rejection.** This is the key second channel for the NO-BOT payers (Excellus, UHC) to recover data without calling. (We have a Stedi account.)

### How to run it (per patient)
- **Payer:** select trading partner (e.g., "Excellus BlueCross BlueShield")
- **Provider:** NPI `1033449558`, Organization, name "Preferred Audiology Care" (use the **Fetch** button)
- **Subscriber:** the PATIENT's first/last name + **member ID + DOB** (adult policyholders ARE the subscriber → leave Dependent blank). Member ID + DOB are the key matchers.
- **Encounter:** one **Service Type Code (STC)** per request (most payers ignore extras)

### STC codes for audiology
| Scenario | STC to send |
|---|---|
| Diagnostic hearing testing | **`71`** Audiology Exam |
| Hearing aids | **`DM`** Durable Medical Equipment (also try `12`/`18`/`75`) |
| General baseline | **`30`** Health Benefit Plan Coverage (all payers support) |

### Per-payer STC behavior (varies WILDLY — must test each)
| Payer | STC `71` (audiology) | STC `DM` (hearing aid) | Test calls |
|---|---|---|---|
| **Excellus BCBS** | ❌ IGNORED → returns default STC 30 dump | ✅ HONORED → returns DME benefits (20% coinsurance) | 71: `ec_019eb856` · DM: `ec_019eb85b` (Matthew Tryniski) |
| **UnitedHealthcare** | ❌ ignored 71, BUT default dump is **RICH** — adds Prior-Auth-Required flag + COB (Medicare primary) | ✅ HONORED → DME cost-share (0% in-net / 20% OON, $1,250 ded) + key msg **"CALL CUSTOMER SERVICE FOR HCAP RULES"** (hearing-aid program exists) | 71: `ec_019eb861` · DM: `ec_019eb860` (Peter Jacobs) |

### ✅ What electronic CAN return (confirmed, Excellus / Matthew Tryniski)
- Active coverage, plan name + **type (PPO)**, effective date
- **Deductible** (individual/family, in/out network, remaining) — e.g. $600 ind / $1,200 fam in-net
- **Out-of-pocket** (individual/family, in/out, remaining) — e.g. $3,000 ind / $6,000 fam
- **Office/diagnostic cost-share** (copay $25, coinsurance 0% in-net, deductible)
- **DME cost-share** (20% coinsurance) when STC DM sent
- Cost-share for many service types (specialist, hospital, ER, pharmacy, vision…)

### ❌ What electronic CANNOT return (the gaps → still need phone/portal)
- Hearing-aid **allowance / max $**
- Hearing-aid **frequency** (once every X years)
- **Third-party carve-out** (TruHearing, Nation's Hearing)
- Whether hearing aids are **classified as DME** or have a separate benefit
- **Audiology exam frequency caps** (Excellus ignored STC 71)
- **Code-level** (specific CPT/HCPCS) covered/billable confirmation

### Per-scenario electronic viability
| Scenario | Electronic-able? | Notes |
|---|---|---|
| **Diagnostic** | ✅ ~85–100% | eligibility, plan, deductible, OOP, cost-share all return. Effectively done electronically. |
| **Hearing Aid** | 🟡 ~40% | get the cost-share *framework* (DME 20%) but NOT allowance/frequency/carve-out → portal/phone for specifics |

---

## 🔀 Combined Channel Strategy (phone bot + electronic)
**Strongest product = electronic for the foundation/diagnostic + AI phone calls for the audiology-specific gaps + portal/bot-approval where needed.**

| Payer | Phone bot | Electronic (Stedi) | Best approach |
|---|---|---|---|
| **Aetna** | ✅ full (4 successes) | likely works (untested) | Phone bot proven; electronic could do diagnostic |
| **Excellus BCBS** | ❌ no bots | ✅ diagnostic / 🟡 HA framework | **Electronic for diagnostic; portal for HA specifics** |
| **UnitedHealthcare** | ❌ no bots | ✅ **diagnostic (RICH!) / 🟡 HA framework** | **Electronic for diagnostic — RECOVERED via Stedi. Portal/customer-service for HA "HCAP" detail.** |
| **BCBS BlueCard** | ✅ works | ❓ untested | Phone bot works; electronic could supplement |
| **Cigna** | 🟡 bot approval pending | ❓ untested | Pursue Evernorth approval + test electronic |
| **UMR** | ❌ fax-only | ❓ untested | Test electronic (may bypass the fax problem entirely) |
| **Humana** | ❓ number issue | ❓ untested | Fix number; test electronic |

**🚀 PUNCHLINE (confirmed 2026-06-11):** Both no-bot giants — **Excellus (#1, 20pts) and UHC (#2, 10pts) = ~65% of volume — return STRONG electronic eligibility via Stedi.** So **Diagnostic for both is fully electronic — no bot, no rejection.** UHC electronic even returns Prior-Auth-Required + COB (Medicare primary). The ONLY remaining phone/portal need is the **hearing-aid-specific carve-out/allowance detail** (the audiology niche). The no-bot walls are largely NEUTRALIZED for Diagnostic.

**Product shape now clear:** (1) Electronic (Stedi) = Diagnostic + foundation, every payer. (2) AI phone = hearing-aid detail on bot-friendly payers (Aetna, BlueCard). (3) Portal/manual = hearing-aid detail on no-bot payers (Excellus, UHC HCAP). (4) Pursue bot-approval (Cigna/Evernorth) to expand #2.

---

## 📞 Call Log by Verification Type

### 🦻 Hearing Aid
| Call ID | Date | Patient | Insurance | Number called | Outcome | Issues found | Status |
|---------|------|---------|-----------|---------------|---------|--------------|--------|
| 019eb2b7-0c14-7000-b883-3b61e3db824b | 2026-06-10 | _(not reached)_ | Excellus BCBS (FEP) | +18005846617 | silence-timed-out (19 msgs) | Spoke to IVR / no DTMF / went silent after transfer | ✅ fixes R1, R2 applied |
| 019eb314-a47f-7001-8306-ba7394bff0ca | 2026-06-10 | Dennis Bell | Aetna | +18886323862 | exceeded-max-duration (67 msgs) — **reached rep, was about to get benefits** | Cut off at 10 min; callback # too fast; stuck in service-type menu | ✅ fixes R3, R4, R5 applied |
| 019eb354-ca9d-7000-a8f6-6271c55f7f87 | 2026-06-10 | Dennis Bell | Aetna | +18886323862 | silence-timed-out (71 msgs) — **reached rep, codes confirmed, rep checking benefits** | Died on hold (R9); said "pause" aloud (R10); diag code mis-read (O1) | ✅ R9, R10 applied; O1 open |
| 019eb375-30e1-7001-89d4-5580ae5ce58d | 2026-06-10 | Dennis Bell | Aetna | +18886323862 | **✅ assistant-ended-call (134 msgs) — FULL SUCCESS, all benefits captured** | Survived multiple holds; minor: narrated once during IVR (O2) | 🏆 **FIRST COMPLETE CALL** |
| 019eb3a1-b8f0-7000-b4b7-ccf6f4b1c797 | 2026-06-10 | George Sedlack | Aetna | +18886323862 | **✅ assistant-ended-call (96 msgs) — FULL SUCCESS** | Code-reading fix worked (phonetic); IVR couldn't match DOB→member (test-data issue, O3) | 🏆 **2nd complete call** |

### 🩺 Diagnostic
| Call ID | Date | Patient | Insurance | Number called | Outcome | Issues found | Status |
|---------|------|---------|-----------|---------------|---------|--------------|--------|
| 019eb3a9-464c-7001-a521-31a0ce75b56a | 2026-06-10 | Horace White | Aetna | +18886323862 | **✅ assistant-ended-call (91 msgs) — FULL SUCCESS** | IVR mis-heard name ("Orest White") & couldn't match → transferred; spoke once in IVR (O2 recurred); minor name misspell | 🏆 **3rd complete call — FIRST DIAGNOSTIC** |
| 019eb3c8-bd7d-7001-a6b2-7f1b6ab8b797 | 2026-06-10 | James Shane | Aetna | +18886323862 | **✅ assistant-ended-call (99 msgs) — FULL SUCCESS** | Confirmed R12 normalization works (digits/dates clean); rep self-corrected OOP $2650→$9250 (O5) | 🏆 **4th complete call — 2nd diagnostic** |

### 🧠 ABR / APD / Vestibular
| Call ID | Date | Patient | Insurance | Number called | Outcome | Issues found | Status |
|---------|------|---------|-----------|---------------|---------|--------------|--------|
| 019eb844-291b-7001-b415-380484c058cf | 2026-06-11 | Dennis Bell | Aetna | +18886323862 | **✅ ABR SUCCESS (141 msgs)** — needs_callback: prior auth for 92652/92653 → auth dept 800-624-0756 opt 3 | outcome field fully populated | 🏆 **First ABR — Scenario 3 works** |
| 019eb844-35b0-799f-b22b-47f5e0235ae8 | 2026-06-11 | James Shane | Aetna | +18886323862 | 🟡 Incomplete (28 msgs) — got eligibility, then agent went passive ("I'm listening") → IVR hung up before reaching rep | O12 — passivity after eligibility readout | superseded by re-run ↓ |
| 019eb844-4247-7002-929f-5914c5ead5e9 | 2026-06-11 | George Sedlack | Aetna | +18886323862 | ❌ Didn't connect (0 msgs, twilio-completed) | transient dial failure | superseded by re-run ↓ |
| 019eb86a-60cb-799f-b4eb-dfc331b7779b | 2026-06-11 | James Shane | Aetna | +18886323862 | **✅ APD FULL SUCCESS (88 msgs)** — don't-go-passive fix worked. Captured: codes experimental/investigational under H93.25 (clinical policy bulletin 0668), prior auth 800-624-0756 opt 3, dual status | `outcome` field came back empty on this complex call (O13, minor) | 🏆 **APD validated** |
| 019eb86a-6d5f-7002-aeba-5dd64a3fa1ab | 2026-06-11 | George Sedlack | Aetna | +18886323862 | **✅ VESTIBULAR SUCCESS (89 msgs)** — needs_callback: prior auth team 800-624-0756 opt 3 | clean | 🏆 **Vestibular validated — Scenario 3 COMPLETE (ABR+APD+Vestib all ✅)** |

### 🗺️ BCBS Out-of-State
| Call ID | Date | Patient | Insurance | Number called | Outcome | Issues found | Status |
|---------|------|---------|-----------|---------------|---------|--------------|--------|
| _(no tests yet)_ | | | | | | | |

---

## 🏆 Successful Benefit Captures
_Completed calls where the agent reached a rep AND captured the benefits. This is the "win" log — who we've successfully verified._

| Date | Patient | DOB | Member ID | Insurance | Verification Type | Call ID | Benefits captured (summary) | Rep / Ref # |
|------|---------|-----|-----------|-----------|-------------------|---------|------------------------------|-------------|
| 2026-06-10 | Dennis Bell | 07/19/1960 | 102280490700 | Aetna Medicare Signature PPO | Hearing Aid | 019eb375-30e1-7001-89d4-5580ae5ce58d | Active, eff 6/1/2026, in-network, primary. **$1,700 allowance, 2 aids/yr, 3rd party = Nation Hearing.** Level-based ($0–$1,700/ear/yr). No deductible/coinsurance; OOP $9,200 remaining. Benefit available (unused). Prior auth → research dept **800-624-0756 opt 3** | May / **350571528** |
| 2026-06-10 | George Sedlack | 09/29/1948 | 101844733000 | Aetna Medicare PPO (ESA PPO) | Hearing Aid | 019eb3a1-b8f0-7000-b4b7-ccf6f4b1c797 | In-network, codes valid & billable, primary/no COB. **$500 annual max, once / 36 months, both ears total.** No deductible/coinsurance/copay. Benefit available (unused). No 3rd-party restriction, no age limits. Prior auth → auth dept **800-624-0756 opt 3** | Tina S / **350582309** |
| 2026-06-10 | Horace White | 11/10/1951 | 101672141200 | Aetna Medicare Advantage PPO (ESA PPO) | Diagnostic | 019eb3a9-464c-7001-a521-31a0ce75b56a | In-network, active (eff 1/1/2025, no term), primary/no COB. **Covered 100% — no deductible, no copay, no coinsurance, no OOP. No frequency limits.** Prior auth status → call **800-624-0756 opt 3** | Dia (S.P.) / **350583654** |
| 2026-06-10 | James Shane | 06/06/1967 | 102274696900 | Aetna Medicare Advantage (D-SNP dual complete) | Diagnostic | 019eb3c8-bd7d-7001-a6b2-7f1b6ab8b797 | In-network, active (eff 4/1/2026). Diagnostic codes **covered 100%, copay $0, coinsurance 0%, deductible $0.** **Prior auth REQUIRED** → 800-624-0756 opt 3. OOP: rep corrected $2,650→$9,250 ($113.04 met) | Kim / **350589523** |
| 2026-06-11 | Cindy Jeffries | 07/23/1958 | UCK920178864 | BCBS BlueCard → BCBS Michigan (UAW Retiree PPO) | Hearing Aid | 019eb7cd-5a1f-7ee4-9c5d-97cc541e7b90 | Active eff 1/1/2024. Deductible $175 ind/$350 fam (in-net); OON $1,000/$1,700; OON coins 30%. **Hearing aids CARVED OUT → TruHearing 844-394-5420.** Diagnostic hearing covered under medical. Medicare primary, BCBS secondary. (2 reps assisted the bot fine.) | Reynaldo S & Jacqueline M / **I-52313019** |

---

### 🏬 Carve-out Vendor calls (the autonomy unlock)
| Call ID | Date | Patient | Vendor | Outcome | Status |
|---------|------|---------|--------|---------|--------|
| 019eb891-ec97-7002-ba93-e3347321adf7 | 2026-06-11 | Dennis Bell | **Nation's Hearing** (Aetna) | **✅ FULL SUCCESS** — rep assisted bot, no rejection. Found: no OON HA benefits, clinic not in network, redirect to vendor | 🏆 vendor bot-friendly confirmed |
| 019eb8c1-4caf-7003-87c9-4c37c99b845b | 2026-06-11 | Cindy Jeffries | **TruHearing** (BCBS) | **✅ SUCCESS** (vendor assistant) — rep assisted, found clinic not in network, member calls 866-581-9464 x2329 | 🏆 vendor bot-friendly confirmed |

**KEY:** Both vendors take AI calls AND independently confirmed **Preferred Audiology Care is NOT in their network** (a real revenue gap — clinic not credentialed with the hearing TPAs). See PROJECT-STATUS.md for the TPA reimbursement strategy note. BlueCard phone reruns (`019eb86a-47ac`, `-541e`) FAILED again (spelling/silence) → BlueCard = electronic-only.

## How to read "Outcome" (Vapi endedReason cheat sheet)
- `customer-ended-call` — the rep/IVR hung up
- `customer-did-not-answer` — line didn't pick up
- `silence-timed-out` — agent or line went quiet too long
- `exceeded-max-duration` — hit the call time cap (now 60 min)
- `call.start.error-get-transport` — failed before connecting (Vapi/transport side)
- `assistant-ended-call` — agent used endCall (normal completion)
