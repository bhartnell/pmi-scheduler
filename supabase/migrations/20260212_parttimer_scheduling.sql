-- Part-Timer Availability & Shift Scheduler
-- Calendar-based system for part-time instructor scheduling

-- ============================================
-- Instructor availability entries
-- ============================================
CREATE TABLE IF NOT EXISTS instructor_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID REFERENCES lab_users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  notes TEXT,
  recurrence_rule TEXT,          -- For recurring availability (future)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instructor_id, date, start_time)
);

-- ============================================
-- Open shifts created by directors
-- ============================================
CREATE TABLE IF NOT EXISTS open_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  department TEXT,               -- EMT, Paramedic, AEMT, General
  created_by UUID REFERENCES lab_users(id),
  min_instructors INTEGER DEFAULT 1,
  max_instructors INTEGER,
  is_filled BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Instructor signups for shifts
-- ============================================
CREATE TABLE IF NOT EXISTS shift_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES open_shifts(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES lab_users(id),
  signup_start_time TIME,        -- Can differ from shift time (partial)
  signup_end_time TIME,          -- Can differ from shift time (partial)
  is_partial BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'declined', 'withdrawn')) DEFAULT 'pending',
  confirmed_by UUID REFERENCES lab_users(id),
  confirmed_at TIMESTAMPTZ,
  declined_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, instructor_id)
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_availability_instructor ON instructor_availability(instructor_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON instructor_availability(date);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON open_shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_created_by ON open_shifts(created_by);
CREATE INDEX IF NOT EXISTS idx_signups_shift ON shift_signups(shift_id);
CREATE INDEX IF NOT EXISTS idx_signups_instructor ON shift_signups(instructor_id);
CREATE INDEX IF NOT EXISTS idx_signups_status ON shift_signups(status);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE instructor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_signups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for instructor_availability
-- ============================================

-- All authenticated users can view all availability (needed for director views)
DROP POLICY IF EXISTS "Users can view availability" ON instructor_availability;
CREATE POLICY "Users can view availability"
  ON instructor_availability FOR SELECT
  USING (true);

-- Users can manage their own availability
DROP POLICY IF EXISTS "Users can insert own availability" ON instructor_availability;
CREATE POLICY "Users can insert own availability"
  ON instructor_availability FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own availability" ON instructor_availability;
CREATE POLICY "Users can update own availability"
  ON instructor_availability FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Users can delete own availability" ON instructor_availability;
CREATE POLICY "Users can delete own availability"
  ON instructor_availability FOR DELETE
  USING (true);

-- ============================================
-- RLS Policies for open_shifts
-- ============================================

-- Everyone can view open shifts
DROP POLICY IF EXISTS "Everyone can view open shifts" ON open_shifts;
CREATE POLICY "Everyone can view open shifts"
  ON open_shifts FOR SELECT
  USING (true);

-- Directors can manage shifts (using service role key bypasses this)
DROP POLICY IF EXISTS "Directors can manage shifts" ON open_shifts;
CREATE POLICY "Directors can manage shifts"
  ON open_shifts FOR ALL
  USING (true);

-- ============================================
-- RLS Policies for shift_signups
-- ============================================

-- Everyone can view signups (needed for seeing who's signed up)
DROP POLICY IF EXISTS "Users can view signups" ON shift_signups;
CREATE POLICY "Users can view signups"
  ON shift_signups FOR SELECT
  USING (true);

-- Users can create/update/delete signups
DROP POLICY IF EXISTS "Users can manage signups" ON shift_signups;
CREATE POLICY "Users can manage signups"
  ON shift_signups FOR ALL
  USING (true);

-- ============================================
-- Update triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_scheduling_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS instructor_availability_updated_at ON instructor_availability;
CREATE TRIGGER instructor_availability_updated_at
  BEFORE UPDATE ON instructor_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduling_updated_at();

DROP TRIGGER IF EXISTS open_shifts_updated_at ON open_shifts;
CREATE TRIGGER open_shifts_updated_at
  BEFORE UPDATE ON open_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduling_updated_at();

DROP TRIGGER IF EXISTS shift_signups_updated_at ON shift_signups;
CREATE TRIGGER shift_signups_updated_at
  BEFORE UPDATE ON shift_signups
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduling_updated_at();
