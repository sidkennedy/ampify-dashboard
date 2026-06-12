-- Per-clinic feature flags ("expansion mode"). Base features (eligibility,
-- discovery) are always on in code; expansion features (claim_status, claims,
-- era, cob) are toggled per clinic by a superadmin. Shape: {"claim_status": true}.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;
