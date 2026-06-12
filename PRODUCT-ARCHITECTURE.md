# Ampify — Product Architecture & Logic Flow
_Reference doc for how this gets built. Last updated 2026-06-11._

## Vapi assistants (kept separate so vendor experiments never risk proven payer calls)
| Assistant | ID | Use for |
|-----------|----|---------|
| **Eligibility AI** (proven — Aetna/BlueCard) | `3857a8f2-4013-4731-b03a-3e299dbdd5d8` | Payer calls |
| **Eligibility AI - Vendors** (clone for experiments) | `7d13a6c3-70d3-4c70-97e9-f4b03fe2c93a` | Vendor calls (TruHearing, NationsHearing, …) |
Both share the same structured outputs (`4d4d45ca…`, `6d982bdb…`) and tools (dtmf, endCall). The dashboard routes each call to the right assistant ID.

---

## The core idea
**A multi-channel audiology verification engine.** A biller submits a patient + verification type once; the system auto-routes to the cheapest/fastest channel that can answer, and returns the result to one dashboard. The biller's time goes almost entirely to *talking to live reps* — never dialing, navigating, or holding.

---

## The three channels

| # | Channel | What it returns | Speed | Works for |
|---|---------|-----------------|-------|-----------|
| 1 | **Electronic** (Stedi / EDI 270-271) | Eligibility, plan, deductible, OOP, cost-share, prior-auth & COB flags | ~20 sec | **Every payer** (even no-bot ones) |
| 2 | **Autonomous AI call** (Vapi) | Deep hearing-aid detail: allowance, carve-out, frequency, prior-auth # | 10–25 min, hands-off | Bot-friendly payers + **carve-out vendors** |
| 3 | **Hybrid AI call** (Vapi + transfer) | Same, but a human finishes it | Biller talks ~2 min | No-bot payers w/ no vendor carve-out |

---

## Routing logic (what the backend decides, invisibly)

```
Biller submits (patient + verification type)
│
├─ DIAGNOSTIC  ───────────────► Channel 1 (Stedi). Done in ~20s. ~45% of volume.
│
└─ HEARING AID
   │
   ├─ Run Stedi first (eligibility + plan + cost-share foundation)
   │
   ├─ Look up carve-out vendor from KNOWLEDGE MAP (see below)
   │     ├─ Vendor known ──► Channel 2: AI calls the VENDOR (bot-friendly). Done.
   │     │
   │     └─ No vendor / payer handles in-house
   │            ├─ Bot-friendly payer (Aetna/BlueCard) ──► Channel 2: AI calls payer.
   │            └─ No-bot payer (Excellus/UHC) ─────────► Channel 3: HYBRID (Tammy).
```

---

## The carve-out vendor map (KEY ASSET — provided by the client, Nicole)
Most hearing-aid benefits are carved out to a third-party vendor. **You already know the mapping**, so you route straight to the vendor instead of fighting the no-bot payer:

| Payer | Hearing-aid vendor | Vendor provider line |
|-------|-------------------|----------------------|
| BCBS (Excellus / BlueCard) | **TruHearing** | 844-394-5420 (plan-specific); 800-334-1807 (general) |
| UnitedHealthcare | **UHC Hearing** | _TBD_ |
| Cigna | **Start Hearing** | _TBD_ |
| Aetna | **Nation's Hearing** | 877-225-0137 (Aetna line); 800-921-4559 (general provider) |

> **✅ CONFIRMED 2026-06-11: VENDORS ARE BOT-FRIENDLY.** NationsHearing (Aetna) completed a FULL autonomous hearing-aid verification — rep Mary assisted the bot, no rejection (call `019eb891-ec97`, outcome captured perfectly). TruHearing's rep (Dale) also engaged the bot (call `019eb897`, dropped mid-call — needs clean re-run, but bot-friendly).
> **This validates the whole strategy:** no-bot payer HA → route to the carve-out vendor → AI calls vendor autonomously. Pushes autonomy ~55% → ~90%. Tammy only for HA that's neither bot-friendly-payer nor vendor-carved-out.
> **Business note (CONFIRMED by BOTH vendors):** Preferred Audiology Care is NOT in-network with Nation's Hearing OR TruHearing (both reps said so independently — TruHearing call `019eb8c1`). Clinic must register with these vendors to bill hearing aids on the big plans. Real revenue gap to flag to Nicole.
> **Next:** clean TruHearing re-run; find UHC Hearing / Start Hearing provider lines; run vendor calls on the VENDOR assistant (7d13a6c3).

---

## Volume math (from the 92 records in the DB, 2026-06-11)
- **Diagnostic: 45%** → electronic, fully autonomous
- **Hearing aid: 53%**
  - bot-friendly payer: 11% → autonomous call
  - no-bot payer: 38% → hybrid **unless carved out to a vendor**
- **Autonomous today: ~55% guaranteed.** Up to **~90%+** if carve-out vendors are bot-friendly.
- **Tammy's load: 10–30%** (only no-bot HA with no vendor carve-out).

---

## Dashboard UX (keep it SIMPLE — no developer needed for v1)
The complexity is backend routing the biller never sees. Her screen is just **submit → status list:**

| Status | Meaning | Biller acts? |
|--------|---------|--------------|
| ✅ Verified | Electronic or autonomous call done; data shown | No |
| ⏳ In progress | A call is running in the background | No |
| 🔔 Needs you | A live rep is on the line | **Yes — answer** |
| ⚠️ Action / failed | Redirect, not covered, etc. | Glance |

Her mental model: *"I submit everything. Diagnostics come back in seconds. Calls happen on their own. If one needs me, my phone rings and I talk for two minutes."*

---

## The hybrid transfer — how the live hand-off actually works
Cold-dialing Tammy fails (rep waits 30s, hangs up). Two models:

**v1 (simple, no call-center build):** when the AI reaches a live rep, it **calls Tammy's cell** and says *"I have a UnitedHealthcare rep on the line for James Shane, member ID …, connecting you now,"* then bridges (Vapi transfer). She gets context in a 5-sec verbal brief. Workable; slight gap.

**v2 (polished, needs a developer):** Tammy sits in "ready" mode in the app. Live reps route to her **instantly** (no dialing), with a **screen-pop** showing patient/payer/questions. She speaks first — no gap, no bot exposure. AI holds on many calls in parallel and feeds her live reps one at a time → one biller clears far more verifications.

---

## Build order (each piece small; Replit-buildable for v1)
1. **Stedi API for diagnostics** — one API call, instant results. Biggest win, simplest.
2. **Keep the Vapi call** for hearing aids (already built & tuned).
3. **Add the carve-out vendor map** as a lookup → which vendor to call.
4. **Simple hybrid** (Vapi transfer to Tammy's phone + verbal brief) — last, only for no-vendor no-bot cases.

> You only need a real developer when you outgrow v1 — i.e., the v2 ready-state/parallel-hold orchestration. Not yet.

---

## Per-payer reality (see VAPI-CALL-TEST-LOG.md for full detail)
- **Aetna:** ✅ bot-friendly (phone) — proven
- **BCBS BlueCard:** ✅ bot-friendly but phone prefix-spelling unreliable → prefer electronic
- **Excellus / UHC:** ❌ no bots → electronic for diagnostic, **vendor** for HA, hybrid as last resort
- **Cigna:** 🟡 bot-approval pending (Evernorth)
- **UMR:** fax-only line (set aside for now)
- **Humana:** number unconfirmed

## Open tests / next
- [ ] **Call the carve-out vendors** (TruHearing first) — are they bot-friendly? (decides the 55%→90% question)
- [ ] Excellus/UHC hearing-aid carve-out rate
- [ ] Find vendor provider lines (UHC Hearing, Start Hearing, Nation's Hearing)
