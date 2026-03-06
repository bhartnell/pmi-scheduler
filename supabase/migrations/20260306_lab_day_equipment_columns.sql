-- Migration: Create lab_day_equipment table
-- Fixes 500 error: "Could not find the 'checked_out_by' column of 'lab_day_equipment' in the schema cache"
--
-- The API route app/api/lab-management/lab-days/[id]/equipment/route.ts references
-- table 'lab_day_equipment', but only 'lab_equipment_items' existed (from 20260224).
-- This creates the correct table matching what the code expects.

CREATE TABLE IF NOT EXISTS lab_day_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'checked_out' CHECK (status IN ('checked_out', 'returned', 'damaged', 'missing')),
  station_id UUID REFERENCES lab_stations(id),
  notes TEXT,
  checked_out_by TEXT,
  checked_out_at TIMESTAMPTZ DEFAULT NOW(),
  returned_by TEXT,
  returned_at TIMESTAMPTZ,
  condition_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists but is missing columns, add them
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_by TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS returned_by TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS condition_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_lab_day_equipment_lab_day ON lab_day_equipment(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_equipment_status ON lab_day_equipment(status);

ALTER TABLE lab_day_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to lab_day_equipment" ON lab_day_equipment;
CREATE POLICY "Service role has full access to lab_day_equipment"
  ON lab_day_equipment FOR ALL
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
