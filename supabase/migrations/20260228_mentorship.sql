CREATE TABLE IF NOT EXISTS mentorship_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  goals TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mentorship_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES mentorship_pairs(id) ON DELETE CASCADE,
  log_date DATE DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL,
  logged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentorship_pairs_mentor ON mentorship_pairs(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_pairs_mentee ON mentorship_pairs(mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_logs_pair ON mentorship_logs(pair_id);
NOTIFY pgrst, 'reload schema';
