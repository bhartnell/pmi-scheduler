-- Migration: Equipment Inventory Management
-- Creates tables for tracking the equipment inventory and checkout/check-in flow

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  available_quantity INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  serial_number TEXT,
  location TEXT,
  condition TEXT CHECK (condition IN ('new', 'good', 'fair', 'needs_repair', 'retired')),
  last_serviced DATE,
  next_service_due DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage equipment" ON equipment FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS equipment_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  checked_out_by TEXT NOT NULL,
  checked_out_at TIMESTAMPTZ DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  checked_in_by TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_equipment ON equipment_checkouts(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_lab_day ON equipment_checkouts(lab_day_id);

ALTER TABLE equipment_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage equipment checkouts" ON equipment_checkouts FOR ALL USING (true);
