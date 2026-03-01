CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  location TEXT,
  user_agent TEXT,
  last_active TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_current BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(last_active);
NOTIFY pgrst, 'reload schema';
