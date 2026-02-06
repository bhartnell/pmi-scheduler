-- Field Trip Attendance tracking for cohorts
-- Allows quick checkbox-based attendance marking for field trips

-- 1. Field Trips table
CREATE TABLE IF NOT EXISTS field_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trip_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT, -- Email of creator
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_trips_cohort ON field_trips(cohort_id);
CREATE INDEX IF NOT EXISTS idx_field_trips_date ON field_trips(trip_date DESC);
CREATE INDEX IF NOT EXISTS idx_field_trips_active ON field_trips(is_active) WHERE is_active = true;

-- 2. Field Trip Attendance (junction table)
CREATE TABLE IF NOT EXISTS field_trip_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_trip_id UUID NOT NULL REFERENCES field_trips(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  marked_by TEXT, -- Email of person who marked attendance
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_trip_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_field_trip_attendance_trip ON field_trip_attendance(field_trip_id);
CREATE INDEX IF NOT EXISTS idx_field_trip_attendance_student ON field_trip_attendance(student_id);

-- RLS Policies
ALTER TABLE field_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_trip_attendance ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access (PMI staff)
CREATE POLICY "Allow all access to field_trips" ON field_trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to field_trip_attendance" ON field_trip_attendance FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE field_trips IS 'Field trips organized for cohorts';
COMMENT ON TABLE field_trip_attendance IS 'Student attendance records for field trips';
