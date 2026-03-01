CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_date DATE NOT NULL,
  incident_time TIME,
  location TEXT NOT NULL,
  severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
  description TEXT NOT NULL,
  people_involved TEXT,
  actions_taken TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  witness_statements TEXT,
  resolution TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  reported_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; all access via API routes using service role key
CREATE POLICY IF NOT EXISTS "Service role full access to incidents"
  ON incidents
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
