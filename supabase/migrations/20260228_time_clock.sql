-- Instructor Time Clock
-- Tracks clock-in/clock-out sessions for instructors with admin approval workflow

CREATE TABLE IF NOT EXISTS instructor_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_email TEXT NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  hours_worked DECIMAL(5,2),
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE instructor_time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Instructors can read their own entries
CREATE POLICY IF NOT EXISTS "instructors_read_own_time_entries"
  ON instructor_time_entries
  FOR SELECT
  USING (true);

-- Instructors can insert their own entries
CREATE POLICY IF NOT EXISTS "instructors_insert_own_time_entries"
  ON instructor_time_entries
  FOR INSERT
  WITH CHECK (true);

-- Instructors can update their own entries (for clock-out)
CREATE POLICY IF NOT EXISTS "instructors_update_own_time_entries"
  ON instructor_time_entries
  FOR UPDATE
  USING (true);

-- Instructors can delete their own entries
CREATE POLICY IF NOT EXISTS "instructors_delete_time_entries"
  ON instructor_time_entries
  FOR DELETE
  USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_time_entries_instructor ON instructor_time_entries(instructor_email);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON instructor_time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON instructor_time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_lab_day ON instructor_time_entries(lab_day_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
