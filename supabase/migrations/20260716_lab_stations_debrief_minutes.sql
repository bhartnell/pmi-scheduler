-- Station debrief timer preset (Task Handoff Queue, 2026-07-16).
--
-- Ben wants to preset the debrief phase (e.g. 10 min for PALS 20-min
-- rotations) instead of relying on the LabTimer Settings panel's
-- hardcoded 300s (5 min) default, which is runtime-only and resets on
-- every new timer for a lab day.
--
-- lab_stations already carries per-station rotation_minutes/num_rotations
-- overrides (editable in EditStationModal) — this follows the same
-- pattern for the debrief window. Nullable + additive: when unset, the
-- timer falls back to today's 300s default, so existing labs are
-- unaffected until an operator explicitly sets a preset.

ALTER TABLE "lab_stations"
  ADD COLUMN IF NOT EXISTS "debrief_minutes" integer NULL;

-- ROLLBACK:
-- ALTER TABLE lab_stations DROP COLUMN IF EXISTS debrief_minutes;
