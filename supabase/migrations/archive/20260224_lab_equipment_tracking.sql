-- Migration: Lab Equipment Tracking
-- Creates a table for tracking equipment and supplies used for each lab day

CREATE TABLE IF NOT EXISTS lab_equipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'checked_out' CHECK (status IN ('checked_out', 'returned', 'damaged', 'missing')),
  station_id UUID REFERENCES lab_stations(id),
  notes TEXT,
  checked_out_by UUID REFERENCES lab_users(id),
  returned_by UUID REFERENCES lab_users(id),
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_lab_day ON lab_equipment_items(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON lab_equipment_items(status);

ALTER TABLE lab_equipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage equipment" ON lab_equipment_items FOR ALL USING (true);
