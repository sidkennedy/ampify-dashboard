-- Per-clinic callback number (for multi-tenant scaling).
-- Caller NAME is hardcoded to "Ben Letterman" in the Vapi prompt — not configurable.
-- The AI gives this callback number if an insurance rep asks for one.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS callback_number text;

-- Snapshot the callback number onto each call record (same pattern as clinic_name/clinic_address)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS callback_number text;
