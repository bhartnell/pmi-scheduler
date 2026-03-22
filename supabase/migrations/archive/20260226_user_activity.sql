-- 3. User Activity
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  page_path TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_email);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_page ON user_activity(page_path);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON user_activity FOR SELECT USING (true);
CREATE POLICY "activity_insert" ON user_activity FOR INSERT WITH CHECK (true);
