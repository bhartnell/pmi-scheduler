CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  totp_secret TEXT,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes JSONB DEFAULT '[]',
  remembered_devices JSONB DEFAULT '[]',
  required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_2fa_email ON user_2fa(user_email);
NOTIFY pgrst, 'reload schema';
