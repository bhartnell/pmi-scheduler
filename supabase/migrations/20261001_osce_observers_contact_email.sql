-- osce_observers: separate correspondence address from identity email.
-- `email` stays the identity/login address; `contact_email` (nullable) is where
-- invites/reminders go. Outbound mail uses COALESCE(contact_email, email).
-- Additive, nullable, idempotent. No data changes.
ALTER TABLE osce_observers ADD COLUMN IF NOT EXISTS contact_email text;

-- ROLLBACK:
-- ALTER TABLE osce_observers DROP COLUMN IF EXISTS contact_email;
