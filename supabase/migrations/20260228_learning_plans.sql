-- Learning Plans / IEP Tracking
-- Stores individual student learning plans with goals, accommodations, and status

CREATE TABLE IF NOT EXISTS learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  goals JSONB DEFAULT '[]',
  accommodations JSONB DEFAULT '[]',
  custom_accommodations TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  review_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_plans_student ON learning_plans(student_id);

-- Progress notes for learning plans (append-only audit trail)
CREATE TABLE IF NOT EXISTS learning_plan_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_plan_notes_plan ON learning_plan_notes(plan_id);

-- Enable RLS
ALTER TABLE learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_plan_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: service role bypasses RLS, so API routes using service key have full access
-- These policies cover direct client access if ever used
CREATE POLICY IF NOT EXISTS "Service role can manage learning_plans"
  ON learning_plans FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can manage learning_plan_notes"
  ON learning_plan_notes FOR ALL
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
