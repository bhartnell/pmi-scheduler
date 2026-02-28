-- Lab Day Cost Tracking
-- Stores itemized cost line items for each lab day

CREATE TABLE IF NOT EXISTS lab_day_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  unit_cost NUMERIC(10,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_lab_costs_day ON lab_day_costs(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_costs_category ON lab_day_costs(category);

-- Enable Row Level Security
ALTER TABLE lab_day_costs ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read cost data
CREATE POLICY "Authenticated users can read lab costs"
  ON lab_day_costs FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS: service role can do everything (used by API routes)
CREATE POLICY "Service role has full access to lab costs"
  ON lab_day_costs FOR ALL
  USING (auth.role() = 'service_role');

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
