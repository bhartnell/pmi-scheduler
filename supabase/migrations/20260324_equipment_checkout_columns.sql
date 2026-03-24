-- Migration: Ensure lab_day_equipment has checkout tracking columns
-- Fixes: "Could not find the 'checked_out_by' column of 'lab_day_equipment' in the schema cache"
--
-- The table may or may not exist. If it doesn't, create it.
-- If it does, add missing columns. Columns are UUID (no FK) for user IDs.

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS lab_day_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'checked_out' CHECK (status IN ('checked_out', 'returned', 'damaged', 'missing')),
  station_id UUID,
  notes TEXT,
  checked_out_by UUID,
  checked_out_at TIMESTAMPTZ DEFAULT NOW(),
  returned_by UUID,
  returned_at TIMESTAMPTZ,
  condition_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists but is missing columns, add them
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_by UUID;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS returned_by UUID;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS condition_notes TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lab_day_equipment_lab_day ON lab_day_equipment(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_equipment_status ON lab_day_equipment(status);

-- RLS
ALTER TABLE lab_day_equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to lab_day_equipment" ON lab_day_equipment;
CREATE POLICY "Service role has full access to lab_day_equipment"
  ON lab_day_equipment FOR ALL
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST schema cache so the new columns are visible immediately
NOTIFY pgrst, 'reload schema';
