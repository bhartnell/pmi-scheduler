-- TRIM 6/7a-8c: "Remove me" on a lab day. A row records that a user opted out
-- of a specific lab day (schedule conflict, PTO, ...) so the per-program
-- default roster (program_default_instructors) and the general-lab calendar
-- default do not re-add them. Additive; no existing rows are touched.
CREATE TABLE IF NOT EXISTS lab_day_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id uuid NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_day_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_lab_day_optouts_lab_day ON lab_day_optouts (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_optouts_user ON lab_day_optouts (user_id);
ALTER TABLE lab_day_optouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_day_optouts_service_role ON lab_day_optouts;
CREATE POLICY lab_day_optouts_service_role ON lab_day_optouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ROLLBACK:
-- DROP TABLE IF EXISTS lab_day_optouts;
