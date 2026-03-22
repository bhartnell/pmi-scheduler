-- 2. Student Communication Log
CREATE TABLE IF NOT EXISTS student_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('phone', 'email', 'meeting', 'text', 'other')),
  summary TEXT NOT NULL,
  details TEXT,
  flagged BOOLEAN DEFAULT false,
  follow_up_needed BOOLEAN DEFAULT false,
  follow_up_date DATE,
  follow_up_completed BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_communications_student ON student_communications(student_id);
CREATE INDEX IF NOT EXISTS idx_student_communications_flagged ON student_communications(flagged) WHERE flagged = true;
CREATE INDEX IF NOT EXISTS idx_student_communications_follow_up ON student_communications(follow_up_needed, follow_up_completed) WHERE follow_up_needed = true AND follow_up_completed = false;
