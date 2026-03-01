-- Scenario Library: tags, ratings, favorites
-- scenario_favorites already exists; skip if so

CREATE TABLE IF NOT EXISTS scenario_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scenario_tags_scenario ON scenario_tags(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_tags_tag ON scenario_tags(tag);
-- Prevent duplicate tags on same scenario
CREATE UNIQUE INDEX IF NOT EXISTS idx_scenario_tags_unique ON scenario_tags(scenario_id, tag);

CREATE TABLE IF NOT EXISTS scenario_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  rated_by TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scenario_id, rated_by)
);
CREATE INDEX IF NOT EXISTS idx_scenario_ratings_scenario ON scenario_ratings(scenario_id);

CREATE TABLE IF NOT EXISTS scenario_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scenario_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_scenario_favorites_user ON scenario_favorites(user_email);
CREATE INDEX IF NOT EXISTS idx_scenario_favorites_scenario ON scenario_favorites(scenario_id);

-- Enable RLS
ALTER TABLE scenario_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_favorites ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses these; belt-and-suspenders for anon)
CREATE POLICY IF NOT EXISTS "Allow authenticated read scenario_tags"
  ON scenario_tags FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Allow authenticated read scenario_ratings"
  ON scenario_ratings FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Allow authenticated read scenario_favorites"
  ON scenario_favorites FOR SELECT USING (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
