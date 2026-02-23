-- Lab Day Attendance Tracking
-- Tracks student attendance for each lab day with status: present, absent, excused, late

CREATE TABLE IF NOT EXISTS lab_day_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'excused', 'late')),
  notes TEXT,
  marked_by TEXT NOT NULL,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lab_day_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_day_attendance_lab_day ON lab_day_attendance(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_attendance_student ON lab_day_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_attendance_status ON lab_day_attendance(status);

-- RLS
ALTER TABLE lab_day_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage attendance" ON lab_day_attendance
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE lab_day_attendance IS 'Student attendance records for lab days';
COMMENT ON COLUMN lab_day_attendance.status IS 'Attendance status: present, absent, excused, or late';
COMMENT ON COLUMN lab_day_attendance.marked_by IS 'Email of the instructor who marked attendance';
