ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'google';
