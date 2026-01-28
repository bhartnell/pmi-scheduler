-- EMT Student Tracking table
CREATE TABLE IF NOT EXISTS emt_student_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mce_complete BOOLEAN DEFAULT FALSE,
  vax_complete BOOLEAN DEFAULT FALSE,
  ride_along_complete BOOLEAN DEFAULT FALSE,
  vitals_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id)
);

-- AEMT Student Tracking table (includes clinical rotations)
CREATE TABLE IF NOT EXISTS aemt_student_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mce_complete BOOLEAN DEFAULT FALSE,
  vax_complete BOOLEAN DEFAULT FALSE,
  ride_along_complete BOOLEAN DEFAULT FALSE,
  clinical_1_complete BOOLEAN DEFAULT FALSE,
  clinical_2_complete BOOLEAN DEFAULT FALSE,
  clinical_3_complete BOOLEAN DEFAULT FALSE,
  vitals_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_emt_tracking_student ON emt_student_tracking(student_id);
CREATE INDEX IF NOT EXISTS idx_aemt_tracking_student ON aemt_student_tracking(student_id);

-- Enable RLS
ALTER TABLE emt_student_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE aemt_student_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for EMT tracking
CREATE POLICY "Allow authenticated users to view EMT tracking"
  ON emt_student_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert EMT tracking"
  ON emt_student_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update EMT tracking"
  ON emt_student_tracking FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for AEMT tracking
CREATE POLICY "Allow authenticated users to view AEMT tracking"
  ON aemt_student_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert AEMT tracking"
  ON aemt_student_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update AEMT tracking"
  ON aemt_student_tracking FOR UPDATE
  TO authenticated
  USING (true);
