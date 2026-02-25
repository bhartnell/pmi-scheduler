-- 2. Lab Day Debriefs
CREATE TABLE IF NOT EXISTS lab_day_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  instructor_email TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  went_well TEXT,
  to_improve TEXT,
  student_concerns TEXT,
  equipment_issues TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lab_day_id, instructor_email)
);

CREATE INDEX IF NOT EXISTS idx_lab_day_debriefs_lab_day ON lab_day_debriefs(lab_day_id);
