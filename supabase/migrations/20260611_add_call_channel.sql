-- How each verification was handled, for display + analytics.
-- Values: electronic | autonomous_call | hybrid_call | carve_out_refer | needs_setup
-- Stored separately from ended_reason (which the Vapi webhook owns for call outcomes).
ALTER TABLE calls ADD COLUMN IF NOT EXISTS channel text;
