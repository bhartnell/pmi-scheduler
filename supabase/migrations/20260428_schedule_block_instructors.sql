-- Instructor assignment columns on pmi_schedule_blocks.
--
-- Mirrors the lab_stations.instructor_id / additional_instructor_id
-- pattern so class-teaching hours (lecture / lab blocks created in
-- the planner) become assignable to specific instructors. Without
-- these, Gannon's EMS 121 hours, Trevor's lecture coverage, etc. are
-- invisible in the coordinator calendar even though the schedule
-- blocks themselves exist.
--
-- ON DELETE SET NULL because removing an instructor from lab_users
-- shouldn't drop the schedule block itself — it's still on the
-- semester schedule, just unassigned.
--
-- Both columns are nullable + idempotent so re-running the migration
-- is a no-op and the existing 282+ blocks don't need a backfill row
-- (they're simply unassigned until someone fills them in).

ALTER TABLE pmi_schedule_blocks
  ADD COLUMN IF NOT EXISTS instructor_id uuid
    REFERENCES lab_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS additional_instructor_id uuid
    REFERENCES lab_users(id) ON DELETE SET NULL;

-- Indexes — the coordinator calendar query filters by date range and
-- by "block has any instructor assigned" so the index helps when a
-- semester has hundreds of unassigned blocks alongside a few that
-- are. Partial-index where at least one slot is set keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_psb_instructor_id
  ON pmi_schedule_blocks (instructor_id)
  WHERE instructor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_psb_additional_instructor_id
  ON pmi_schedule_blocks (additional_instructor_id)
  WHERE additional_instructor_id IS NOT NULL;

COMMENT ON COLUMN pmi_schedule_blocks.instructor_id IS
  'Primary instructor for this class/lab/exam block. Drives the coordinator-calendar block aggregation alongside lab_day_roles and lab_stations assignments. NULL = unassigned.';

COMMENT ON COLUMN pmi_schedule_blocks.additional_instructor_id IS
  'Secondary co-instructor slot (e.g. when a lecture has a guest or a co-teacher). Mirrors lab_stations.additional_instructor_id semantics.';
