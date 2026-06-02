-- Per-clinic caller identity (for multi-tenant scaling)
-- The AI introduces itself with these on insurance calls.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS caller_name text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS callback_number text;

-- Snapshot the caller identity onto each call record (same pattern as clinic_name/clinic_address)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS callback_number text;
