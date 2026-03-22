-- 3. Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  ip_address TEXT,
  last_active TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
NOTIFY pgrst, 'reload schema';
