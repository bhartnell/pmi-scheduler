-- NREMT tracker (Task: duplicate-station rollup + occupancy + scenario capture).
-- Increment 1 of the additive build: capture WHERE (physical station) and WHAT
-- SCENARIO each assessment attempt happened.
--
-- WHY (per the verified rollup finding): completion already rolls up by
-- skill_sheet_id and stays that way — these columns are ADDITIVE and change
-- nothing about completion counting. They enable:
--   * lab_station_id  → the OCCUPANCY view can show Medical 1 vs Medical 2
--                       distinctly (which physical station each attempt was at),
--                       and the retest rule (a retest must use a DIFFERENT
--                       proctor/station than the failed attempt) can be enforced.
--   * scenario_id / scenario_run → track WHICH scenario each attempt used, so a
--                       retest gets a different scenario. scenario_run is the
--                       paper-friendly free-text floor ("Chest Pain 1") when no
--                       digital scenario is assigned.
--
-- Plain uuid columns (NOT FK-constrained) on purpose: we want to preserve the
-- record of what happened even if the station/scenario is later edited/removed,
-- and it avoids adding new PostgREST embed paths on this heavily-joined table.
-- All nullable; existing rows unaffected (no backfill).

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS lab_station_id uuid,
  ADD COLUMN IF NOT EXISTS scenario_id    uuid,
  ADD COLUMN IF NOT EXISTS scenario_run   text;

COMMENT ON COLUMN student_skill_evaluations.lab_station_id IS 'Physical lab_station where this attempt happened (e.g. Medical 1 vs Medical 2). Additive — completion still rolls up by skill_sheet_id; this is for the occupancy view + retest different-proctor tracking. Nullable, unconstrained (record-of-what-happened).';
COMMENT ON COLUMN student_skill_evaluations.scenario_id IS 'Selected scenario (scenarios.id) run for this assessment attempt, when a digital scenario is assigned. Nullable.';
COMMENT ON COLUMN student_skill_evaluations.scenario_run IS 'Free-text record of the scenario run (paper-friendly, e.g. "Chest Pain 1"), so retests can use a different scenario even when run from paper. Nullable.';

CREATE INDEX IF NOT EXISTS idx_sse_lab_station ON student_skill_evaluations (lab_station_id);

-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_sse_lab_station;
--   ALTER TABLE student_skill_evaluations
--     DROP COLUMN IF EXISTS lab_station_id,
--     DROP COLUMN IF EXISTS scenario_id,
--     DROP COLUMN IF EXISTS scenario_run;
