-- 2. Scenario Library
CREATE TABLE IF NOT EXISTS scenario_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scenario_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scenario_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_scenario_tags_scenario ON scenario_tags(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_ratings_scenario ON scenario_ratings(scenario_id);
NOTIFY pgrst, 'reload schema';
