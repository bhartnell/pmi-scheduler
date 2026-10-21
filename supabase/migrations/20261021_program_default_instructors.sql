-- TRIM 6/7a-8b: per-program default instructor roster (admin-editable).
-- Additive and idempotent. Task Handoff Queue card 4005cd1c...cf9704c257.
-- Replaces the hardcoded lab_users.primary_program + paramedic_lab_default reading
-- as the roster source for default lab assignment (wiring is a separate step).

CREATE TABLE IF NOT EXISTS program_default_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  added_by text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_program_default_instructors_program ON program_default_instructors (program_id);
CREATE INDEX IF NOT EXISTS idx_program_default_instructors_user ON program_default_instructors (user_id);
ALTER TABLE program_default_instructors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS program_default_instructors_service_role ON program_default_instructors;
CREATE POLICY program_default_instructors_service_role ON program_default_instructors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed ONLY from Ben's named lists (2026-10-21), resolved to active @pmi.edu lab_users by email
-- after a live name check (each name matched exactly one active account):
--   Paramedic: Ben, Josh, Schafer, Rae, Ryan   EMT: Stacie, Josh, Schafer
-- Idempotent: UNIQUE (program_id, user_id) + ON CONFLICT DO NOTHING.
INSERT INTO program_default_instructors (program_id, user_id, added_by, source)
SELECT p.id, u.id, 'migration', 'seed:trim-6-7a-8b-2026-10-21'
FROM (VALUES
  ('PM', 'bhartnell@pmi.edu'), ('PM', 'jlomonaco@pmi.edu'), ('PM', 'mschafer@pmi.edu'),
  ('PM', 'rniedfeldt@pmi.edu'), ('PM', 'ryyoung@pmi.edu'),
  ('EMT', 'stpeterson@pmi.edu'), ('EMT', 'jlomonaco@pmi.edu'), ('EMT', 'mschafer@pmi.edu')
) AS v(abbr, email)
JOIN programs p ON p.abbreviation = v.abbr
JOIN lab_users u ON lower(u.email) = v.email AND u.is_active
ON CONFLICT (program_id, user_id) DO NOTHING;

-- ROLLBACK:
-- DROP TABLE IF EXISTS program_default_instructors;
