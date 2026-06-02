-- Add verification template fields to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS verification_type text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS date_of_service date;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS plan_type text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS state text DEFAULT 'NY';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS diagnosis_code text;
