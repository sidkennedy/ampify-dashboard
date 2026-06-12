-- Per-clinic carve-out vendor (TPA) contracts.
-- Which hearing-aid TPAs is this clinic credentialed with? Drives HA routing:
--   contracted    → autonomous call to the vendor for the allowance
--   not contracted → refer-out / private-pay disposition (no call)
-- Empty array = in no vendor networks (correct default for practices that avoid TPAs).
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS vendor_contracts text[] NOT NULL DEFAULT '{}';
