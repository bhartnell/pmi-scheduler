-- 20261026_pals_group_moves.sql
--
-- [Task Handoff Queue: PALS P3c/4] Temporary regroup on PALS days. The
-- coordinator board already renders a move ("from Gx", this round / rest of
-- today / rest of the course) but held it in browser state, so a refresh or
-- a second instructor lost it. This table is the write path.
--
-- Cohort-scoped (Repeatability Rule): works for every PALS cohort. Lab group
-- membership (lab_group_members) is NOT touched -- a move is an overlay, so
-- ending it restores the home group with nothing to repair. Nothing is ever
-- deleted: ending a move sets ended_at (archive-don't-delete).
--
-- Additive & idempotent (IF NOT EXISTS). RLS on, service role only (the
-- routes use the admin client), same posture as other pals_ tables.

CREATE TABLE IF NOT EXISTS pals_group_moves (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id     uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_group_id uuid NOT NULL REFERENCES lab_groups(id) ON DELETE CASCADE,
  to_group_id   uuid NOT NULL REFERENCES lab_groups(id) ON DELETE CASCADE,
  duration      text NOT NULL CHECK (duration IN ('round', 'today', 'course')),
  move_date     date NOT NULL DEFAULT CURRENT_DATE,
  created_by    uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  CHECK (from_group_id <> to_group_id)
);
CREATE INDEX IF NOT EXISTS idx_pals_group_moves_cohort_active
  ON pals_group_moves (cohort_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pals_group_moves_student
  ON pals_group_moves (student_id);

ALTER TABLE pals_group_moves ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pals_group_moves IS 'Temporary student regroup overlay on PALS days (PALS P3c/4). lab_group_members is never changed; active = ended_at IS NULL and (duration <> ''today'' OR move_date = today). Ending a move sets ended_at.';

-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_pals_group_moves_student;
--   DROP INDEX IF EXISTS idx_pals_group_moves_cohort_active;
--   DROP TABLE IF EXISTS pals_group_moves;  -- new table, only holds overlay rows
