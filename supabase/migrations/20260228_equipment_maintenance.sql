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

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_status ON equipment_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_due ON equipment_maintenance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_scheduled ON equipment_maintenance(scheduled_date);

-- Row Level Security
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;

-- Allow service role (API routes) full access
CREATE POLICY IF NOT EXISTS "Service role has full access to equipment_maintenance"
  ON equipment_maintenance FOR ALL
  USING (true)
  WITH CHECK (true);

-- Also add an `out_of_service_at` column to the equipment table for OOS tracking
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS out_of_service_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS out_of_service_reason TEXT DEFAULT NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_interval_days INTEGER DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
