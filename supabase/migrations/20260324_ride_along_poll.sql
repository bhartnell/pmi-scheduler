-- Ride-Along Poll Tables
-- Enables public token-based availability polls for EMT ride-alongs

-- Add poll fields to ride_along_availability if not present
ALTER TABLE ride_along_availability
  ADD COLUMN IF NOT EXISTS poll_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS poll_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poll_status TEXT DEFAULT 'draft' CHECK (poll_status IN ('draft', 'active', 'closed'));

-- Create a ride-along poll record table
CREATE TABLE IF NOT EXISTS ride_along_polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_id UUID,
  semester_id UUID,
  token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL DEFAULT 'EMT Ride-Along Availability',
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_along_polls_token ON ride_along_polls(token);
CREATE INDEX IF NOT EXISTS idx_ride_along_polls_status ON ride_along_polls(status);

-- RLS policies
ALTER TABLE ride_along_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ride_along_polls"
  ON ride_along_polls FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
