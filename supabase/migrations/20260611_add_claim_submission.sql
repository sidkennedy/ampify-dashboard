-- Claims submission (837P) — extends the claims record so one claim flows
-- submit → status → ERA. Gated by the clinic's 'claims' feature flag.
ALTER TABLE claims ADD COLUMN IF NOT EXISTS diagnosis_codes text[];
ALTER TABLE claims ADD COLUMN IF NOT EXISTS service_lines jsonb;          -- [{procedureCode, modifiers, chargeAmount, units, serviceDate}]
ALTER TABLE claims ADD COLUMN IF NOT EXISTS place_of_service text DEFAULT '11'; -- 11 = office
ALTER TABLE claims ADD COLUMN IF NOT EXISTS submission_status text;       -- draft | submitted | accepted | rejected | error
ALTER TABLE claims ADD COLUMN IF NOT EXISTS claim_control_number text;    -- our patient control number (PCN)
ALTER TABLE claims ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS submission_detail text;
