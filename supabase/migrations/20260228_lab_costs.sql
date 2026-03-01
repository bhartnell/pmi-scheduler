-- 4. Lab Day Costs
CREATE TABLE IF NOT EXISTS lab_day_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('equipment', 'consumables', 'instructor_pay', 'external', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_day_costs_lab_day ON lab_day_costs(lab_day_id);
NOTIFY pgrst, 'reload schema';
