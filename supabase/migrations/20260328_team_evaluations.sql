-- Team evaluation support: allow grouping evaluations by team
-- team_role: 'leader', 'assistant', or 'solo' (default null = solo/individual)
-- team_evaluation_id: references the leader's evaluation for team members

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS team_role TEXT CHECK (team_role IN ('leader', 'assistant', 'solo')),
  ADD COLUMN IF NOT EXISTS team_evaluation_id UUID REFERENCES student_skill_evaluations(id);

-- Index for quickly finding team members of a given evaluation
CREATE INDEX IF NOT EXISTS idx_sse_team_evaluation_id ON student_skill_evaluations(team_evaluation_id)
  WHERE team_evaluation_id IS NOT NULL;
