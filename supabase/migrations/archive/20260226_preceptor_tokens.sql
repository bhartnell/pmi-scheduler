-- 1. Preceptor Evaluation Tokens
CREATE TABLE IF NOT EXISTS preceptor_eval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID REFERENCES student_internships(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  preceptor_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_preceptor_tokens_token ON preceptor_eval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_preceptor_tokens_internship ON preceptor_eval_tokens(internship_id);

ALTER TABLE preceptor_eval_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_select" ON preceptor_eval_tokens FOR SELECT USING (true);
CREATE POLICY "tokens_insert" ON preceptor_eval_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "tokens_update" ON preceptor_eval_tokens FOR UPDATE USING (true);
