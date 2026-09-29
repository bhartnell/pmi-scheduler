-- AHA credential level(s) + typed (cursive) signature text/face on lab_users.
-- Additive, nullable, idempotent. Credential level is orthogonal to app role.
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS aha_credentials text[];
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS signature_text text;
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS signature_face text;
-- signature_kind now also allows 'typed' (no CHECK constraint on the column).

-- ROLLBACK:
-- ALTER TABLE lab_users DROP COLUMN IF EXISTS aha_credentials;
-- ALTER TABLE lab_users DROP COLUMN IF EXISTS signature_text;
-- ALTER TABLE lab_users DROP COLUMN IF EXISTS signature_face;
