-- ACLS learning-station tracker (Task Handoff Queue: [ACLS MON 5/5], Ben 2026-10-02).
-- UNOFFICIAL, UNSCORED, day-scoped mark per student per learning station:
-- 'pass' (followed the algorithm) or 'watch' (keep an eye on them), plus an
-- optional note. Deliberately its own table, NOT a certification table: it does
-- not feed pass/fail, never prints on an AHA form, and nothing reads it past
-- the lab day. Additive and idempotent.

CREATE TABLE IF NOT EXISTS acls_learning_marks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id  uuid        NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  station_id  uuid        NOT NULL REFERENCES lab_stations(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mark        text        NOT NULL CHECK (mark IN ('pass', 'watch')),
  note        text,
  marked_by   uuid        REFERENCES lab_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_acls_learning_marks_lab_day ON acls_learning_marks(lab_day_id);

-- Server-only access (API routes use the service role), matching the
-- advisor-hardening posture: RLS on, no anon/authenticated policies.
ALTER TABLE acls_learning_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role acls learning marks" ON acls_learning_marks;
CREATE POLICY "service role acls learning marks"
  ON acls_learning_marks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ROLLBACK:
-- DROP TABLE IF EXISTS acls_learning_marks;  -- unofficial day-scoped marks only; no certification data
