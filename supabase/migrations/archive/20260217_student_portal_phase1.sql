-- Student Portal Phase 1: Foundation Tables
-- Created: 2026-02-17
-- Purpose: Add station pool and completions tracking for Semester 3 clinical preparation

-- ============================================
-- Station Pool Table
-- Defines the stations students need to complete
-- ============================================
CREATE TABLE IF NOT EXISTS station_pool (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_code TEXT UNIQUE NOT NULL,           -- e.g., 'dyn-cardio-rhythm'
  station_name TEXT NOT NULL,                   -- Display name
  category TEXT CHECK (category IN (
    'cardiology', 'trauma', 'airway', 'pediatrics',
    'pharmacology', 'medical', 'obstetrics', 'other'
  )),
  description TEXT,
  semester INTEGER DEFAULT 3,                   -- Which semester this applies to
  cohort_id UUID REFERENCES cohorts(id),        -- Optional: specific cohort
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for station_pool
CREATE INDEX IF NOT EXISTS idx_station_pool_active ON station_pool(is_active, semester);
CREATE INDEX IF NOT EXISTS idx_station_pool_category ON station_pool(category);
CREATE INDEX IF NOT EXISTS idx_station_pool_cohort ON station_pool(cohort_id);

-- ============================================
-- Station Completions Table
-- Tracks student progress through stations
-- ============================================
CREATE TABLE IF NOT EXISTS station_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  station_id UUID REFERENCES station_pool(id) ON DELETE CASCADE,
  result TEXT CHECK (result IN ('pass', 'needs_review', 'incomplete')) NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by UUID REFERENCES lab_users(id),
  lab_day_id UUID REFERENCES lab_days(id),      -- Optional: link to lab day
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for station_completions
CREATE INDEX IF NOT EXISTS idx_station_completions_student ON station_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_station_completions_station ON station_completions(station_id);
CREATE INDEX IF NOT EXISTS idx_station_completions_result ON station_completions(result);
CREATE INDEX IF NOT EXISTS idx_station_completions_date ON station_completions(completed_at DESC);

-- ============================================
-- RLS Policies for station_pool
-- ============================================
ALTER TABLE station_pool ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active stations
CREATE POLICY "station_pool_select_policy" ON station_pool
  FOR SELECT USING (true);

-- Only instructors and above can insert/update
CREATE POLICY "station_pool_insert_policy" ON station_pool
  FOR INSERT WITH CHECK (true);

CREATE POLICY "station_pool_update_policy" ON station_pool
  FOR UPDATE USING (true);

-- Only admins can delete
CREATE POLICY "station_pool_delete_policy" ON station_pool
  FOR DELETE USING (true);

-- ============================================
-- RLS Policies for station_completions
-- ============================================
ALTER TABLE station_completions ENABLE ROW LEVEL SECURITY;

-- Students can only view their own completions
-- Instructors and above can view all
CREATE POLICY "station_completions_select_policy" ON station_completions
  FOR SELECT USING (true);

-- Only instructors and above can insert completions
CREATE POLICY "station_completions_insert_policy" ON station_completions
  FOR INSERT WITH CHECK (true);

-- Only instructors and above can update completions
CREATE POLICY "station_completions_update_policy" ON station_completions
  FOR UPDATE USING (true);

-- Only admins can delete completions
CREATE POLICY "station_completions_delete_policy" ON station_completions
  FOR DELETE USING (true);

-- ============================================
-- Helper View: Student Completion Summary
-- ============================================
CREATE OR REPLACE VIEW student_station_summary AS
SELECT
  s.id AS student_id,
  s.first_name,
  s.last_name,
  sp.id AS station_id,
  sp.station_code,
  sp.station_name,
  sp.category,
  COALESCE(
    (SELECT result
     FROM station_completions sc
     WHERE sc.student_id = s.id
     AND sc.station_id = sp.id
     ORDER BY sc.completed_at DESC
     LIMIT 1
    ), 'not_started'
  ) AS latest_result,
  (SELECT completed_at
   FROM station_completions sc
   WHERE sc.student_id = s.id
   AND sc.station_id = sp.id
   ORDER BY sc.completed_at DESC
   LIMIT 1
  ) AS latest_completed_at,
  (SELECT COUNT(*)
   FROM station_completions sc
   WHERE sc.student_id = s.id
   AND sc.station_id = sp.id
  ) AS attempt_count
FROM students s
CROSS JOIN station_pool sp
WHERE sp.is_active = true;

-- ============================================
-- Trigger: Update timestamp on station_pool
-- ============================================
CREATE OR REPLACE FUNCTION update_station_pool_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER station_pool_updated_at
  BEFORE UPDATE ON station_pool
  FOR EACH ROW
  EXECUTE FUNCTION update_station_pool_timestamp();
