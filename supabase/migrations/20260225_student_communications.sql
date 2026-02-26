-- Student Communication Log
-- Tracks all instructor-to-student communications (phone, email, meeting, text, other)

CREATE TABLE IF NOT EXISTS student_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  comm_type TEXT NOT NULL CHECK (comm_type IN ('phone', 'email', 'meeting', 'text', 'other')),
  subject TEXT NOT NULL,
  summary TEXT NOT NULL,
  follow_up_needed BOOLEAN DEFAULT false,
  follow_up_date DATE,
  follow_up_completed BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  logged_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_student_comms_student ON student_communications(student_id);
CREATE INDEX IF NOT EXISTS idx_student_comms_type ON student_communications(comm_type);
CREATE INDEX IF NOT EXISTS idx_student_comms_flagged ON student_communications(is_flagged) WHERE is_flagged = true;

-- Row Level Security
ALTER TABLE student_communications ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes)
CREATE POLICY IF NOT EXISTS "Service role full access on student_communications"
  ON student_communications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
