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

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES lab_users(id);
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS flag_level TEXT;
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE student_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_flagged ON student_notes(student_id) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_student_notes_author ON student_notes(author_id);

ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can manage student notes" ON student_notes;
CREATE POLICY "Instructors can manage student notes" ON student_notes FOR ALL USING (true);
