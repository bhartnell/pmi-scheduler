-- Ride-Along Scheduling Tables
-- EMT student ride-along shifts, assignments, availability, and templates

-- 1. Shifts table
CREATE TABLE IF NOT EXISTS ride_along_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semester_id UUID,
  cohort_id UUID,
  agency_id UUID,
  shift_date DATE NOT NULL,
  shift_type TEXT CHECK (shift_type IN ('day', 'night', 'swing')),
  start_time TIME,
  end_time TIME,
  max_students INTEGER DEFAULT 1,
  location TEXT,
  unit_number TEXT,
  preceptor_name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Assignments table
CREATE TABLE IF NOT EXISTS ride_along_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES ride_along_shifts(id) ON DELETE CASCADE,
  student_id UUID,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'completed', 'no_show', 'cancelled')),
  hours_completed DECIMAL(4,1),
  preceptor_name TEXT,
  notes TEXT,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 3. Availability table
CREATE TABLE IF NOT EXISTS ride_along_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID,
  cohort_id UUID,
  semester_id UUID,
  available_days JSONB DEFAULT '{}',
  preferred_shift_type TEXT[],
  preferred_dates DATE[],
  unavailable_dates DATE[],
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Templates table
CREATE TABLE IF NOT EXISTS ride_along_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  agency_id UUID,
  day_of_week INTEGER,
  shift_type TEXT CHECK (shift_type IN ('day', 'night', 'swing')),
  start_time TIME,
  end_time TIME,
  max_students INTEGER DEFAULT 1,
  unit_number TEXT,
  preceptor_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ride_along_shifts_date ON ride_along_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_ride_along_shifts_status ON ride_along_shifts(status);
CREATE INDEX IF NOT EXISTS idx_ride_along_shifts_cohort ON ride_along_shifts(cohort_id);
CREATE INDEX IF NOT EXISTS idx_ride_along_shifts_agency ON ride_along_shifts(agency_id);
CREATE INDEX IF NOT EXISTS idx_ride_along_shifts_semester ON ride_along_shifts(semester_id);
CREATE INDEX IF NOT EXISTS idx_ride_along_assignments_shift ON ride_along_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_ride_along_assignments_student ON ride_along_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_ride_along_assignments_status ON ride_along_assignments(status);
CREATE INDEX IF NOT EXISTS idx_ride_along_availability_student ON ride_along_availability(student_id);
CREATE INDEX IF NOT EXISTS idx_ride_along_availability_cohort ON ride_along_availability(cohort_id);
CREATE INDEX IF NOT EXISTS idx_ride_along_templates_agency ON ride_along_templates(agency_id);

-- RLS policies
ALTER TABLE ride_along_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_along_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_along_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_along_templates ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by API routes via supabase admin)
CREATE POLICY "Service role full access on ride_along_shifts"
  ON ride_along_shifts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on ride_along_assignments"
  ON ride_along_assignments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on ride_along_availability"
  ON ride_along_availability FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on ride_along_templates"
  ON ride_along_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS ride_along_shifts_updated_at ON ride_along_shifts;
CREATE TRIGGER ride_along_shifts_updated_at
  BEFORE UPDATE ON ride_along_shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS ride_along_availability_updated_at ON ride_along_availability;
CREATE TRIGGER ride_along_availability_updated_at
  BEFORE UPDATE ON ride_along_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
