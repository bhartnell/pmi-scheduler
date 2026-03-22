-- OSCE Observer Scheduling System
-- Observer registrations (public insert, no auth required)
CREATE TABLE IF NOT EXISTS osce_observers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT,
  agency_preference BOOLEAN DEFAULT FALSE,
  agency_preference_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin-defined time blocks
CREATE TABLE IF NOT EXISTS osce_time_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER NOT NULL CHECK (day_number IN (1, 2)),
  label TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_observers INTEGER DEFAULT 4,
  sort_order INTEGER DEFAULT 0,
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Seed the 4 default time blocks
INSERT INTO osce_time_blocks (day_number, label, date, start_time, end_time, sort_order) VALUES
  (1, 'Morning',          '2026-03-30', '09:00', '12:30', 1),
  (1, 'Early Afternoon',  '2026-03-30', '13:30', '15:00', 2),
  (1, 'Late Afternoon',   '2026-03-30', '15:00', '17:00', 3),
  (2, 'Afternoon',        '2026-03-31', '13:00', '17:00', 4)
ON CONFLICT DO NOTHING;

-- Observer-block selections (join table)
CREATE TABLE IF NOT EXISTS osce_observer_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  observer_id UUID NOT NULL REFERENCES osce_observers(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES osce_time_blocks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_observer_block UNIQUE (observer_id, block_id)
);

-- Student-agency mapping for admin coordination view
CREATE TABLE IF NOT EXISTS osce_student_agencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  agency TEXT NOT NULL,
  relationship TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_osce_observer_blocks_observer ON osce_observer_blocks(observer_id);
CREATE INDEX IF NOT EXISTS idx_osce_observer_blocks_block ON osce_observer_blocks(block_id);
CREATE INDEX IF NOT EXISTS idx_osce_observers_email ON osce_observers(email);
