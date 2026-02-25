-- Migration: lab_day_debriefs
-- Creates the table for post-lab debrief submissions by instructors

CREATE TABLE IF NOT EXISTS lab_day_debriefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES lab_users(id),
  what_went_well TEXT,
  what_could_improve TEXT,
  student_concerns TEXT,
  equipment_issues TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_day_debriefs_lab_day ON lab_day_debriefs(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_debriefs_submitted_by ON lab_day_debriefs(submitted_by);

ALTER TABLE lab_day_debriefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read debriefs"
  ON lab_day_debriefs FOR SELECT
  USING (true);

CREATE POLICY "Instructors can manage debriefs"
  ON lab_day_debriefs FOR ALL
  USING (true);
