-- User Endorsements table
-- Adds authority tags (director, mentor, preceptor) layered on top of roles
-- Role = what you CAN do (superadmin, admin, instructor)
-- Endorsement = special authority (director, mentor, preceptor)
CREATE TABLE IF NOT EXISTS user_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  endorsement_type TEXT NOT NULL,
  title TEXT,
  department_id UUID REFERENCES departments(id),
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, endorsement_type, department_id)
);

CREATE INDEX IF NOT EXISTS idx_endorsements_user ON user_endorsements(user_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_type ON user_endorsements(endorsement_type);

ALTER TABLE user_endorsements ENABLE ROW LEVEL SECURITY;

-- Everyone can see endorsements (needed for UI badges)
CREATE POLICY "Users see endorsements" ON user_endorsements
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage endorsements
CREATE POLICY "Admins manage endorsements" ON user_endorsements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lab_users
      WHERE email = auth.jwt() ->> 'email'
      AND role IN ('superadmin', 'admin')
    )
  );

-- Add requires_director flag to onboarding tasks
ALTER TABLE onboarding_tasks
ADD COLUMN IF NOT EXISTS requires_director BOOLEAN DEFAULT false;

-- Seed current directors
INSERT INTO user_endorsements (user_id, endorsement_type, title, department_id, granted_by)
SELECT lu.id, 'director', 'Program Director',
  (SELECT id FROM departments WHERE abbreviation = 'PM'),
  'system'
FROM lab_users lu WHERE lu.email = 'ryyoung@pmi.edu'
ON CONFLICT (user_id, endorsement_type, department_id) DO NOTHING;

INSERT INTO user_endorsements (user_id, endorsement_type, title, department_id, granted_by)
SELECT lu.id, 'director', 'Clinical Director',
  (SELECT id FROM departments WHERE abbreviation = 'PM'),
  'system'
FROM lab_users lu WHERE lu.email = 'rniedfeldt@pmi.edu'
ON CONFLICT (user_id, endorsement_type, department_id) DO NOTHING;

INSERT INTO user_endorsements (user_id, endorsement_type, title, department_id, granted_by)
SELECT lu.id, 'director', 'Clinical Director',
  (SELECT id FROM departments WHERE abbreviation = 'PM'),
  'system'
FROM lab_users lu WHERE lu.email = 'bhartnell@pmi.edu'
ON CONFLICT (user_id, endorsement_type, department_id) DO NOTHING;

-- Update onboarding tasks that need director sign-off
UPDATE onboarding_tasks
SET requires_director = true
WHERE title ILIKE '%30-day%'
   OR title ILIKE '%final sign%'
   OR title ILIKE '%program director%';
