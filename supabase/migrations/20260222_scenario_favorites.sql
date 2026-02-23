-- Scenario Favorites
CREATE TABLE IF NOT EXISTS scenario_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  scenario_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, scenario_id)
);

CREATE INDEX IF NOT EXISTS idx_scenario_favorites_user ON scenario_favorites(user_email);
CREATE INDEX IF NOT EXISTS idx_scenario_favorites_scenario ON scenario_favorites(scenario_id);

-- RLS
ALTER TABLE scenario_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites" ON scenario_favorites
  FOR ALL USING (true);
