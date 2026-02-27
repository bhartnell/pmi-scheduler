CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  page_path TEXT NOT NULL,
  action TEXT DEFAULT 'page_view',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_email ON user_activity_log(user_email);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_page ON user_activity_log(page_path);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON user_activity_log FOR SELECT USING (true);
CREATE POLICY "activity_insert" ON user_activity_log FOR INSERT WITH CHECK (true);
