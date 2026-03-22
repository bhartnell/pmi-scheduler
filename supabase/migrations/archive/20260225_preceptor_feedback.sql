-- Preceptor feedback tracking for clinical internship students
CREATE TABLE IF NOT EXISTS preceptor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  internship_id UUID,
  preceptor_name TEXT NOT NULL,
  preceptor_email TEXT,
  clinical_site TEXT,
  shift_date DATE,
  clinical_skills_rating INTEGER CHECK (clinical_skills_rating BETWEEN 1 AND 5),
  professionalism_rating INTEGER CHECK (professionalism_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  comments TEXT,
  is_flagged BOOLEAN DEFAULT false,
  submitted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS internship_id UUID;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS preceptor_name TEXT;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS preceptor_email TEXT;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS clinical_site TEXT;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS shift_date DATE;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS clinical_skills_rating INTEGER;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS professionalism_rating INTEGER;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS communication_rating INTEGER;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS overall_rating INTEGER;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS strengths TEXT;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS areas_for_improvement TEXT;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS submitted_by TEXT;
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE preceptor_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_preceptor_feedback_student ON preceptor_feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_preceptor_feedback_date ON preceptor_feedback(shift_date);
CREATE INDEX IF NOT EXISTS idx_preceptor_feedback_flagged ON preceptor_feedback(is_flagged) WHERE is_flagged = true;

-- Row-level security
ALTER TABLE preceptor_feedback ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (all API routes use service role)
DROP POLICY IF EXISTS "Service role full access on preceptor_feedback" ON preceptor_feedback;
CREATE POLICY "Service role full access on preceptor_feedback"
  ON preceptor_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
