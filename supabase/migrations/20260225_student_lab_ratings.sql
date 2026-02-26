-- Migration: student_lab_ratings
-- Stores instructor quick ratings for students on a per lab-day basis.

CREATE TABLE IF NOT EXISTS student_lab_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  instructor_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lab_day_id, student_id, instructor_email)
);

-- Row-level security
ALTER TABLE student_lab_ratings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by API routes)
CREATE POLICY "Service role full access" ON student_lab_ratings
  FOR ALL USING (true);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_student_lab_ratings_lab_day ON student_lab_ratings(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_student_lab_ratings_student ON student_lab_ratings(student_id);
CREATE INDEX IF NOT EXISTS idx_student_lab_ratings_instructor ON student_lab_ratings(instructor_email);
