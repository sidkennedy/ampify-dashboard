-- Records the clinic's acceptance of the Services Agreement + BAA at onboarding.
-- Capturing name + title + timestamp + version is what makes a checkbox a valid
-- electronic signature (an audit trail you can produce if ever challenged).
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS terms_accepted_by_name text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS terms_accepted_by_title text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS terms_version text;
