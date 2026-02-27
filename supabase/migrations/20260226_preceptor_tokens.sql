CREATE TABLE IF NOT EXISTS preceptor_eval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  internship_id UUID NOT NULL REFERENCES student_internships(id) ON DELETE CASCADE,
  preceptor_email TEXT NOT NULL,
  preceptor_name TEXT,
  student_name TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_preceptor_tokens_token ON preceptor_eval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_preceptor_tokens_internship ON preceptor_eval_tokens(internship_id);

ALTER TABLE preceptor_eval_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_select" ON preceptor_eval_tokens FOR SELECT USING (true);
CREATE POLICY "tokens_insert" ON preceptor_eval_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "tokens_update" ON preceptor_eval_tokens FOR UPDATE USING (true);
