-- 2. Attendance Appeals
CREATE TABLE IF NOT EXISTS attendance_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  absence_date DATE NOT NULL,
  reason TEXT NOT NULL,
  documentation_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_status ON attendance_appeals(status);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_student ON attendance_appeals(student_id);
NOTIFY pgrst, 'reload schema';
