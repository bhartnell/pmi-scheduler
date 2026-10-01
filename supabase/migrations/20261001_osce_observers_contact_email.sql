-- osce_observers.contact_email: correspondence address, separate from identity `email`.
-- Nullable; consumers fall back to `email` when unset. Additive + idempotent.
ALTER TABLE osce_observers ADD COLUMN IF NOT EXISTS contact_email text;
COMMENT ON COLUMN osce_observers.contact_email IS 'Correspondence address (invites/reminders). Falls back to email when NULL. email remains identity/login.';

-- ROLLBACK:
-- ALTER TABLE osce_observers DROP COLUMN IF EXISTS contact_email;
