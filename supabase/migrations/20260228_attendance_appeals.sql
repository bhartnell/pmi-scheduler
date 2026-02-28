-- Attendance Appeals
-- Students can submit an appeal for an absence; admins can approve or deny.
-- If approved, the attendance record can be updated accordingly.

CREATE TABLE IF NOT EXISTS attendance_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  absence_date DATE NOT NULL,
  reason TEXT NOT NULL,
  documentation_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row-level security
ALTER TABLE attendance_appeals ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes)
CREATE POLICY IF NOT EXISTS "service_role_all_attendance_appeals"
  ON attendance_appeals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_student ON attendance_appeals(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_status ON attendance_appeals(status);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_created ON attendance_appeals(created_at DESC);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
