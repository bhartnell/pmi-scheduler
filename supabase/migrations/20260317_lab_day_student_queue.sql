-- Lab Day Student Queue: tracks individual student testing at stations
-- Used by the Individual Testing mode on lab day detail pages

CREATE TABLE IF NOT EXISTS lab_day_student_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  station_id UUID REFERENCES lab_stations(id),
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed')),
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result TEXT CHECK (result IN ('pass', 'fail', 'incomplete')),
  evaluation_id UUID REFERENCES student_skill_evaluations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_queue_lab_day ON lab_day_student_queue(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_student_queue_student ON lab_day_student_queue(student_id);
CREATE INDEX IF NOT EXISTS idx_student_queue_station ON lab_day_student_queue(station_id);

ALTER TABLE lab_day_student_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do anything on lab_day_student_queue"
  ON lab_day_student_queue FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view lab_day_student_queue"
  ON lab_day_student_queue FOR SELECT
  USING (true);

-- Add lab_mode to lab_days
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS lab_mode TEXT DEFAULT 'group_rotations'
  CHECK (lab_mode IN ('group_rotations', 'individual_testing'));
