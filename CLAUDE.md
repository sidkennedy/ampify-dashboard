# Ampify Dashboard — Project Bible

This is a **Next.js + Supabase** web app built for audiology clinics. Staff enter patient insurance details, the system calls the insurance company via an AI agent (Vapi), and the results (eligibility, deductibles, coverage, CPT code breakdown) are displayed back to staff automatically.

The client is **Nicole at Fine Tone Hearing** (audiology clinic). This tool is specifically for insurance verification — before a patient appointment, staff check what their insurance actually covers so there are no billing surprises.

---

## What the app does (the full flow)

1. Staff go to `/calls/new` and fill in:
   - Patient name, DOB, member/policy ID
   - Insurance provider phone number
   - CPT/HCPCS codes to verify (e.g. `92557, 92550`)
   - Clinic details (NPI, Tax ID, name, address — pre-filled from settings)

2. On submit, `/api/calls` saves everything to Supabase (`calls` table) and fires a Vapi call to the insurance company's phone number.

3. The Vapi AI agent calls the insurer, navigates the IVR, speaks to a rep, and extracts structured data.

4. When the call ends, Vapi sends a webhook to `/api/webhooks/vapi`. This writes the results back to Supabase.

5. Staff view the call at `/calls/[id]` — three tabs:
   - **Overview** — member eligibility, deductible, out-of-pocket, copays, hearing aid benefit, call reference number
   - **Code-by-Code** — table of each CPT code with covered/auth/copay/limits
   - **Transcript** — full call transcript

---

## The 3 deployment phases

### Phase 1 — Trial mode (CURRENT)
**What it does:** Staff submit the form → data saves to Supabase → nothing else happens. No Vapi call fires.

**Why:** Collect real patient data to test with. Confirm the form works, the DB is getting good data, and the flow makes sense before touching live insurance calls.

**What staff see:** A green banner — "Thank you — data submitted for testing"

**How Sidney uses it:** Log into Supabase (see below), look at the `calls` table, copy the patient details out, and manually fire a test call in the Vapi dashboard to verify the AI agent works correctly.

**The switch:** `TRIAL_MODE=true` in env vars.

---

### Phase 2 — Auto-fire Vapi, results still hidden
**What it does:** Form submit → Supabase → Vapi call fires automatically. But staff still only see the "submitted" confirmation screen, not the actual results yet.

**Why:** Verify the end-to-end pipeline (Vapi fires, call completes, webhook writes back to DB) is stable before surfacing results to the clinic.

**How Sidney uses it:** Check Supabase to confirm results are being written correctly. Review transcripts and structured output for accuracy.

**The switch:** `TRIAL_MODE=false` + a new `HIDE_RESULTS=true` flag (needs ~5 lines of code when ready — not built yet, takes 2 minutes).

---

### Phase 3 — Full production
**What it does:** The complete flow. Form → Vapi call → results shown to staff. Done.

**The switch:** `TRIAL_MODE=false` + `HIDE_RESULTS=false` (or just remove the flag).

---

## Environment variables

These live in `.env.local` locally and in **Replit Secrets** in production.

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to expose in browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only — never expose) |
| `VAPI_API_KEY` | Vapi API key for making calls |
| `VAPI_ASSISTANT_ID` | The specific Vapi assistant/agent that handles insurance calls |
| `VAPI_PHONE_NUMBER_ID` | The Vapi phone number the AI calls from |
| `NEXT_PUBLIC_APP_URL` | The app's public URL (e.g. `https://your-app.replit.app`) |
| `SUPERADMIN_EMAIL` | Sidney's email — gets superadmin role automatically |
| `TRIAL_MODE` | `true` = save to DB only, no Vapi. `false` = full live flow. |

---

## Supabase — how to access the data

**URL:** https://supabase.com/dashboard/project/idkrzuqszkfocmpxabuz

Go to **Table Editor → calls** to see every submission.

Key columns to check during Phase 1:

| Column | What it tells you |
|---|---|
| `patient_name` / `dob` / `member_id` | What the staff entered |
| `insurance_phone` | The number Vapi would call |
| `codes_requested` | CPT codes they want verified |
| `clinic_name` / `provider_npi` / `clinic_tax_id` | Clinic details |
| `status` | `queued` in Phase 1, `in_progress` / `completed` / `failed` in production |
| `structured_output_eligibility` | The eligibility JSON Vapi returns (empty in Phase 1) |
| `structured_output_codes` | The code-by-code JSON Vapi returns (empty in Phase 1) |
| `transcript` | Full call transcript (empty in Phase 1) |
| `created_at` | Sort by this descending to see the latest entries |

---

## Vapi — key info

- **Dashboard:** https://vapi.ai (log in there to manually trigger test calls)
- **Webhook URL** (for when Phase 2/3 goes live): `https://your-replit-url/api/webhooks/vapi`
  - This must be set in the Vapi dashboard under the assistant's settings
  - Not needed in Phase 1 since no calls fire
- **What Vapi sends back** (the `end-of-call-report` webhook): transcript, recording URL, call duration, and two structured data objects:
  - `Audiology Eligibility & Benefits` → maps to `structured_output_eligibility`
  - `Code-by-Code Benefits` → maps to `structured_output_codes`

---

## Replit deployment

The `.replit` file is already configured. On deploy it runs:
```
npm install && npm run build && npm run start
```
Port 3000 maps to port 80 automatically.

**Checklist before deploying:**
- [ ] All env vars added to Replit Secrets (copy from `.env.local`)
- [ ] `NEXT_PUBLIC_APP_URL` updated to the actual Replit URL
- [ ] `TRIAL_MODE=true` in Replit Secrets for Phase 1

---

## File structure (the important bits)

```
src/
  app/
    (dashboard)/
      calls/
        new/
          NewCallForm.tsx      ← The staff form
        [id]/
          page.tsx             ← Call detail page
          CallDetailTabs.tsx   ← Results tabs (Overview / Code-by-Code / Transcript)
        page.tsx               ← Calls list
    api/
      calls/route.ts           ← Handles form submission + Vapi call trigger
      webhooks/vapi/route.ts   ← Receives Vapi results and writes to Supabase
  lib/
    vapi.ts                    ← Vapi API calls
    supabase/                  ← Supabase client setup
  types/index.ts               ← All TypeScript types (Call, EligibilityOutput, CodesOutput etc.)
```

---

## Auth / roles

- Users log in via Supabase Auth (email + password)
- Roles: `staff`, `admin`, `superadmin`
- `SUPERADMIN_EMAIL` in env vars gets superadmin automatically on first login
- Staff are scoped to a clinic — they only see calls for their clinic
- Superadmin (Sidney) can see everything via `/admin`

---

## Outside hours behaviour

The `shouldSchedule()` function in `src/lib/insurance-hours.ts` checks if the current time is within insurance business hours. If it's outside hours, the call gets status `scheduled` and fires automatically when hours open. This works independently of `TRIAL_MODE` — in trial mode, the schedule check still runs but the Vapi call is always skipped regardless.
