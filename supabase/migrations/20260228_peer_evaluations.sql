-- 5. Peer Evaluations
CREATE TABLE IF NOT EXISTS peer_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  evaluated_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 5),
  teamwork_score INTEGER CHECK (teamwork_score BETWEEN 1 AND 5),
  leadership_score INTEGER CHECK (leadership_score BETWEEN 1 AND 5),
  is_self_eval BOOLEAN DEFAULT false,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lab_day_id, evaluator_id, evaluated_id)
);
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_lab_day ON peer_evaluations(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_evaluated ON peer_evaluations(evaluated_id);
NOTIFY pgrst, 'reload schema';
