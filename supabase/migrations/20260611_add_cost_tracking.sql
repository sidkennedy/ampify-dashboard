-- Per-verification cost tracking (internal / superadmin only).
-- call.cost already holds the REAL Vapi phone-call cost from the webhook.
-- These add the electronic (Stedi) side so total = electronic_cost + cost.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS electronic_checks integer NOT NULL DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS electronic_cost numeric(10,4) NOT NULL DEFAULT 0;

-- Backfill existing verifications: each one that captured eligibility ran ~1 Stedi
-- check. (Rate matches STEDI_COST_PER_CHECK default of $0.25.)
UPDATE calls SET electronic_checks = 1, electronic_cost = 0.25
  WHERE structured_output_eligibility IS NOT NULL AND electronic_checks = 0;
