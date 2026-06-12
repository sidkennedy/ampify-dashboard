# Stedi Electronic-Eligibility — What Comes Back (real-data experiments)

_2026-06-11. Fired real eligibility checks against real patients (Aetna/Excellus/UHC) varying service-type codes (STCs) and procedure codes. Goal: find where electronic can replace phone calls. Conclusion: **our routing is already cost-optimal — there's no easy electronic win we're missing.**_

## TL;DR
| Verification type | Can electronic fully answer? | Why |
|---|---|---|
| **Diagnostic** | ✅ Yes (electronic-complete) | Audiology exam bills under the office/medical benefit; the plan-level deductible/OOP/cost-share IS the answer. |
| **ABR / APD / Vestibular** | ❌ No — foundation only | Payers do NOT return per-procedure coverage electronically (see below). Procedure-specific coverage/prior-auth needs a call. |
| **Hearing aids** | ❌ No — DME cost-share only | The **allowance ($) and frequency** are NOT in the 271. They live with the carve-out vendor or require a call. |

## Finding 1 — Procedure codes (CPT/HCPCS) add NOTHING
Stedi accepts procedure codes (`encounter.procedureCode` / `medicalProcedures[]`, qualifiers `CJ`=CPT, `HC`=HCPCS). But sending them returned the **identical** response — e.g. Excellus returned **87 benefit lines whether or not** procedure codes were included, and **zero** procedure-specific benefit lines in any test. **Payers ignore procedure codes on the 270 and return the general benefit dump.**
→ **Do NOT send procedure codes.** They don't enable per-CPT coverage. ABR/APD/vestibular genuinely cannot be made electronic-complete; the phone call is necessary, not lazy routing.

## Finding 2 — STC choice matters for hearing aids, but only for cost-share
Sending STC **`DM`** (Durable Medical Equipment) returns a **DME-specific** benefit set:
- **Aetna:** DME coinsurance 0%, copay $0, deductible waived (rolled into Catastrophic OOP).
- **UHC:** DME deductible $1,250, copay $0, coinsurance 0% in / 20% out — plus literally *"CALL CUSTOMER SERVICE FOR HCAP RULES FOR SPECIFIC SERVICES."*
- **Excellus:** DME lines are all diabetic-supplies / braces / oxygen — no hearing-aid line at all.

**What's NOT there:** the hearing-aid **allowance amount** and **frequency (every X years)** — the two things a biller actually needs for HA. Those require the carve-out vendor (if contracted) or a call. UHC even tells you to call.
→ Routing confirmed correct: HA = electronic foundation + vendor (if contracted) / refer-out. We now ALSO capture the DME cost-share into `hearingAidBenefit` as enrichment (`mapStediToEligibility`).

## Finding 3 — Send STC `30` ONLY. Never send `71`. (⚠️ verified, important)
STC `30` (general health-benefit-plan-coverage) returns the full dump: active coverage, deductible/OOP (ind + family, total + remaining), office-visit cost-share, network status, funding type, sometimes prior-auth. This foundation fully answers **diagnostic**; for ABR/APD/vestibular it's a useful foundation but not procedure-specific.

**Adding STC `71` (audiology) is at best useless and at worst breaks the response:**
| Payer | `[30,71]` | `[30]` only |
|---|---|---|
| Excellus | 87 | 87 (identical) |
| Aetna | 37 | 37 (identical) |
| **UMR** | **0 / error 42** | **303** |

Payers that itemize by service type (UMR) **starve** the response when an unrecognized specific code is included; payers that ignore it return the same thing. → `serviceTypeCodesFor` now sends **`['30']`** for all non-HA types, **`['30','DM']`** for hearing aids (DM verified safe on UMR: 27 lines).

## Finding 4 — UMR is fully electronic (bypasses the passcode/fax/call gate)
Real patient (Bixby, member 19459808): UMR's phone path demands a **passcode** (via fax-back `315-320-0245` or the umr.com portal) before a rep gives benefits — a notorious time-sink. **Electronic skips it entirely:** STC 30 returned **303 lines / 250 financial** (deductible $500 in-net with $204.29 remaining, OOP, copays). Member matched on **memberId + DOB** — the first name on file differed from our record, so DON'T over-constrain on first name (Stedi needs only one of memberId/dob/lastName). UMR self-funded plans are NOT thin electronically after all — the earlier "3 lines" was the STC-71 starvation bug, not a thin plan.

## Finding 5 — Payers tag the deductible/OOP differently (mapper must handle it)
The mapper originally only read lines tagged `"Health Benefit Plan Coverage"` → it returned **empty** deductible/OOP for UMR, which tags them `"Medical Care"`. Fixed: treat `"Health Benefit Plan Coverage"` OR `"Medical Care"` (or untagged) as plan-level. Also now **prefer in-network** lines for the headline deductible/OOP (clinic is in-network) — this corrected Excellus from $1,200 (was showing the out-of-network figure) to the correct in-network **$600**. UMR/Bixby now returns in-network deductible **$500** with cost-share, not empty.

## Is it "specific enough"? (the real question)
For **diagnostic**: YES. Electronic returns eligibility + in-network deductible/remaining + medical copay/coinsurance — the audiology exam bills under the medical/office benefit, so that IS the billable answer. It does NOT return a discrete "audiology exam covered" line (no payer itemizes that) or procedure-specific prior-auth — a call adds certainty only in edge cases. For **hearing aids**: electronic gives the medical/DME foundation but NOT the allowance/frequency (needs vendor/refer). Net: diagnostic is electronic-complete; HA is foundation + vendor/refer; ABR/APD/vestibular are foundation + call.

## What we changed as a result
- **Kept requests STC-only** (no procedure codes — proven useless).
- **`mapStediToEligibility`:** (a) accumulator fix — ignore "Year-to-Date met" lines so a $0 YTD line no longer clobbers the real deductible cap (fixed UHC: total $0 → $1,250); (b) capture DME cost-share + payer notes (e.g. UHC's "call for HCAP rules") into `hearingAidBenefit`.

## Cost takeaway
For a no-TPA practice (e.g. Preferred Audiology Care): **diagnostics = electronic (≈free), hearing aids = refer-out (no call), only ABR/APD/vestibular hit the phone** — and those are unavoidable. The experiment rules out procedure codes as a shortcut, so we stop hunting for electronic wins that don't exist and trust the design.
