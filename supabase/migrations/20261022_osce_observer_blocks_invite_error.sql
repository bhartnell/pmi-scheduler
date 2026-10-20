-- OSCE CAL 2/4: record a failed calendar invite/removal on the signup row.
-- Additive, nullable; read by the admin invite-status view (CAL 3/4).
ALTER TABLE osce_observer_blocks ADD COLUMN IF NOT EXISTS calendar_invite_error text;

-- ROLLBACK:
-- ALTER TABLE osce_observer_blocks DROP COLUMN IF EXISTS calendar_invite_error;
