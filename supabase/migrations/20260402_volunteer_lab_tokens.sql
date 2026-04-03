-- Volunteer lab access tokens
CREATE TABLE IF NOT EXISTS volunteer_lab_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  registration_id UUID REFERENCES volunteer_registrations(id) ON DELETE CASCADE,
  volunteer_name TEXT NOT NULL,
  volunteer_email TEXT,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE,
  event_id UUID REFERENCES volunteer_events(id),
  role TEXT DEFAULT 'volunteer_grader' CHECK (role IN ('volunteer_grader', 'volunteer_observer', 'instructor1_evaluee')),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_lab_tokens_token ON volunteer_lab_tokens(token);
CREATE INDEX IF NOT EXISTS idx_volunteer_lab_tokens_lab_day ON volunteer_lab_tokens(lab_day_id);

-- Add evaluator_type to student_skill_evaluations
ALTER TABLE student_skill_evaluations
ADD COLUMN IF NOT EXISTS evaluator_type TEXT DEFAULT 'instructor'
  CHECK (evaluator_type IN ('instructor', 'volunteer', 'guest', 'md'));

-- RLS
ALTER TABLE volunteer_lab_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON volunteer_lab_tokens FOR ALL USING (true);
