CREATE TABLE IF NOT EXISTS scenario_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content JSONB,
  changed_by TEXT NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_versions_scenario ON scenario_versions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_versions_number ON scenario_versions(scenario_id, version_number DESC);

-- RLS
ALTER TABLE scenario_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage scenario versions" ON scenario_versions
  FOR ALL USING (true);
