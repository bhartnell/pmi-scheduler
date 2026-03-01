-- 2. Two Factor Auth
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[];
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ;
NOTIFY pgrst, 'reload schema';
