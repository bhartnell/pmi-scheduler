-- Student notes and flags system
-- Private instructor-only notes with flag levels for student tracking

CREATE TABLE IF NOT EXISTS student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES lab_users(id),
  author_email TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('academic', 'behavioral', 'medical', 'other')),
  is_flagged BOOLEAN DEFAULT false,
  flag_level TEXT CHECK (flag_level IN ('yellow', 'red') OR flag_level IS NULL),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_flagged ON student_notes(student_id) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_student_notes_author ON student_notes(author_id);

ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Instructors can manage student notes" ON student_notes FOR ALL USING (true);
