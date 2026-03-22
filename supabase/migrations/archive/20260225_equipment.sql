-- 1. Equipment Inventory
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  quantity INTEGER DEFAULT 1,
  available_quantity INTEGER DEFAULT 1,
  condition TEXT DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor', 'out_of_service')),
  location TEXT,
  last_maintenance DATE,
  next_maintenance DATE,
  low_stock_threshold INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS equipment_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  checked_out_by TEXT,
  checked_out_at TIMESTAMPTZ DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  checked_in_by TEXT,
  condition_on_return TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_equipment ON equipment_checkouts(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_lab_day ON equipment_checkouts(lab_day_id);
