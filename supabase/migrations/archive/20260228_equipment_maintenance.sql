-- Equipment Maintenance Scheduler
-- Tracks scheduled, completed, and overdue maintenance for lab equipment.

CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_item_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE,
  completed_date DATE,
  completed_by TEXT,
  next_due_date DATE,
  cost DECIMAL(10,2),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'overdue', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS equipment_item_id UUID REFERENCES equipment(id) ON DELETE CASCADE;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS maintenance_type TEXT;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS completed_by TEXT;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS next_due_date DATE;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2);
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_status ON equipment_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due ON equipment_maintenance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_scheduled ON equipment_maintenance(scheduled_date);

-- Row Level Security
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;

-- Allow service role (API routes) full access
DROP POLICY IF EXISTS "Service role has full access to equipment_maintenance" ON equipment_maintenance;
CREATE POLICY "Service role has full access to equipment_maintenance"
  ON equipment_maintenance FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also add an `out_of_service_at` column to the equipment table for OOS tracking
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS out_of_service_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS out_of_service_reason TEXT DEFAULT NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_interval_days INTEGER DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
