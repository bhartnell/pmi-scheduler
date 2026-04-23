-- Part-timer hours tracking — Part 1 of the April 23 feedback batch.
--
-- Two changes:
--
-- 1. manual_hour_logs — a place to record hours worked OUTSIDE the
--    shift_signups flow. Gannon and Matt teach class + prep time that
--    doesn't fit the per-shift model (e.g., "Tuesdays 2:30-5pm for the
--    Semester 1 block"). Until now there was no way to count that
--    against their monthly/semester totals. Admin-managed by default;
--    any instructor+ can read their own rows.
--
-- 2. lab_users.monthly_hours_target — optional per-user monthly hours
--    goal so the part-timer-status page can render a progress bar
--    (3h / 20h target, etc.) with color bands.

-- ---------------------------------------------------------------------------
-- manual_hour_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_hour_logs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES lab_users(id)   ON DELETE CASCADE,
  logged_by          uuid                 REFERENCES lab_users(id)   ON DELETE SET NULL,
  date               date        NOT NULL,
  duration_minutes   integer     NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 24 * 60),
  entry_type         text        NOT NULL DEFAULT 'class'
                                 CHECK (entry_type IN ('class','lab','prep','online','other')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_hour_logs_user_date
  ON manual_hour_logs (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_manual_hour_logs_date
  ON manual_hour_logs (date DESC);

ALTER TABLE manual_hour_logs ENABLE ROW LEVEL SECURITY;

-- Read: any instructor+ can see rows (manager visibility) or their own.
DROP POLICY IF EXISTS "read manual hour logs" ON manual_hour_logs;
CREATE POLICY "read manual hour logs"
  ON manual_hour_logs FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

-- Write: admin/superadmin/lead_instructor only. Instructors can't log
-- hours for themselves through the app — all manual hours are
-- reviewer-entered to preserve the audit trail.
DROP POLICY IF EXISTS "write manual hour logs" ON manual_hour_logs;
CREATE POLICY "write manual hour logs"
  ON manual_hour_logs FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  );

COMMENT ON TABLE manual_hour_logs IS
  'Hours worked outside the shift_signups flow (Gannon class block, Matt online, ad-hoc teaching). Reviewer-entered only.';

-- ---------------------------------------------------------------------------
-- monthly_hours_target on lab_users
-- ---------------------------------------------------------------------------
ALTER TABLE lab_users
  ADD COLUMN IF NOT EXISTS monthly_hours_target integer;

COMMENT ON COLUMN lab_users.monthly_hours_target IS
  'Optional monthly hours goal. Drives the progress bar on the part-timer status page. NULL = no target set.';
