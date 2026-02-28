-- Peer Evaluations
-- Students evaluate their peers (and optionally themselves) after a lab day.
-- Instructors can view aggregated results with optional anonymization.

CREATE TABLE IF NOT EXISTS peer_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  evaluator_id UUID REFERENCES students(id) ON DELETE CASCADE,
  evaluated_id UUID REFERENCES students(id) ON DELETE CASCADE,
  is_self_eval BOOLEAN DEFAULT false,
  communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 5),
  teamwork_score INTEGER CHECK (teamwork_score BETWEEN 1 AND 5),
  leadership_score INTEGER CHECK (leadership_score BETWEEN 1 AND 5),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row-level security
ALTER TABLE peer_evaluations ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes)
CREATE POLICY IF NOT EXISTS "service_role_all_peer_evaluations"
  ON peer_evaluations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_peer_evals_lab ON peer_evaluations(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_peer_evals_evaluator ON peer_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_peer_evals_evaluated ON peer_evaluations(evaluated_id);
CREATE INDEX IF NOT EXISTS idx_peer_evals_created ON peer_evaluations(created_at DESC);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
