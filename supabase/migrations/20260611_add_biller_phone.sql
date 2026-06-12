-- Per-clinic biller phone number — where hybrid calls transfer the live payer
-- rep once the AI has navigated to a human. Set during onboarding / in Settings.
-- Different for every clinic. Falls back to a system default if blank.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS biller_phone text;
