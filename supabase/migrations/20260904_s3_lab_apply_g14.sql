-- 20260904_s3_lab_apply_g14.sql
--
-- [Task Handoff Queue: "S3 lab model" — LABS - S3 model / support irregular
-- internship-prep labs] Generates G14's Semester-3 lab_days from the S3
-- lab_day_templates set (program='paramedic', semester=3, 15 rows, weeks
-- 1-15) that Ben already authored 2026-03-02 and links each generated
-- lab_day to its matching, already-published pmi_schedule_blocks row
-- (the 15 recurring Friday 11:30-13:00 S3 Lab blocks on program_schedule
-- 86992083-6715-4c82-b5ff-c3500a214c12, re-parented to G14 earlier today).
--
-- Those 15 blocks existed with title=NULL, instructor_id=NULL,
-- linked_lab_day_id=NULL — schedule slots with no lab day, no content,
-- no staffing behind them. This migration is additive-only: it creates
-- new lab_days/lab_stations rows and fills previously-NULL columns on
-- the 15 blocks. It does not touch instructor_id (not derivable from the
-- template — left for Ben per the task's own instruction) and does not
-- create or modify any pmi_schedule_blocks row beyond the 15 that were
-- already there.
--
-- lab_mode: the task description frames S3 as needing short (~5 min)
-- individual/drop-in stations, and lab_days.lab_mode already has a
-- general-purpose 'individual_testing' value (used today for ACLS/PALS
-- one-at-a-time testing days) that fits that shape. But the *actual*
-- authored S3 templates are structured 90-minute cohort lab days
-- (warmup -> briefing -> main content -> debrief), not bare drop-in
-- stations — most weeks' "main content" is a skill_drill/scenario block
-- run within an otherwise-synchronized group day. Only Week 14 ("OSCE
-- Review Board" — a single complex scenario + structured oral board, one
-- student at a time) squarely matches the individual_testing shape, so
-- only that template is flipped to lab_mode='individual_testing' here.
-- The other 14 keep lab_mode=NULL (defaults to 'group_rotations'),
-- matching their real day structure. Flagged for Ben in the task log:
-- whether any other specific week should also use individual_testing is
-- a per-week content judgment, not assumed here.
--
-- skill_drill stations: drill_ids are linked from the already-seeded
-- skill_drills table (program='paramedic', semester=3, 7 rows) by
-- matching each station's metadata.station_id (or, for the pooled
-- "drill-card-rotation" stations, each entry in metadata.available_stations)
-- against skill_drills.station_id. Two pool entries referenced by the
-- Week 3/5 drill-card templates ('dynamic-cardiology', 'static-cardiology')
-- have no skill_drills row yet and are correctly left unlinked rather than
-- fabricated — this mirrors the live DB state, not a data gap introduced
-- here.
--
-- Backup: _backup_pmi_schedule_blocks_s3lab_20260904 snapshots the 15
-- target blocks' pre-migration state (all NULL title/instructor_id/
-- linked_lab_day_id) before the UPDATE below.

BEGIN;

CREATE TEMP TABLE _s3_week_map (week_number int, block_date date) ON COMMIT DROP;
INSERT INTO _s3_week_map (week_number, block_date) VALUES
  (1, '2026-09-04'), (2, '2026-09-11'), (3, '2026-09-18'), (4, '2026-09-25'),
  (5, '2026-10-02'), (6, '2026-10-09'), (7, '2026-10-16'), (8, '2026-10-23'),
  (9, '2026-10-30'), (10, '2026-11-06'), (11, '2026-11-13'), (12, '2026-11-20'),
  (13, '2026-11-27'), (14, '2026-12-04'), (15, '2026-12-11');

UPDATE lab_day_templates
SET lab_mode = 'individual_testing',
    updated_by = 'claude-code-task-handoff-queue:s3-lab-model',
    updated_at = now()
WHERE program = 'paramedic' AND semester = 3 AND week_number = 14;

CREATE TABLE IF NOT EXISTS _backup_pmi_schedule_blocks_s3lab_20260904 AS
SELECT b.* FROM pmi_schedule_blocks b
WHERE b.program_schedule_id = '86992083-6715-4c82-b5ff-c3500a214c12'
  AND b.block_type = 'lab';

CREATE TEMP TABLE _s3_created_days (template_id uuid, lab_day_id uuid) ON COMMIT DROP;
WITH ins AS (
  INSERT INTO lab_days (
    cohort_id, date, title, semester, week_number, day_number,
    notes, source_template_id, lab_mode, start_time, end_time
  )
  SELECT
    '8577fdc3-eff6-4000-9302-1ee6e3043eeb', m.block_date, t.name, 3, t.week_number, 1,
    t.description, t.id, t.lab_mode, '11:30'::time, '13:00'::time
  FROM lab_day_templates t
  JOIN _s3_week_map m ON m.week_number = t.week_number
  WHERE t.program = 'paramedic' AND t.semester = 3
  RETURNING id, source_template_id
)
INSERT INTO _s3_created_days (template_id, lab_day_id)
SELECT source_template_id, id FROM ins;

INSERT INTO lab_stations (
  lab_day_id, station_number, station_type, custom_title, station_notes, metadata
)
SELECT c.lab_day_id, s.sort_order, s.station_type, s.station_name, s.notes, COALESCE(s.metadata, '{}'::jsonb)
FROM lab_template_stations s
JOIN _s3_created_days c ON c.template_id = s.template_id;

-- Single-drill skill_drill stations. (drill_ids is uuid[] — DATABASE_SCHEMA.md
-- said text[]; corrected in the same commit as this migration per the
-- Schema-First Rule, live DB is the source of truth.)
UPDATE lab_stations ls
SET drill_ids = ARRAY[sd.id]
FROM _s3_created_days c, skill_drills sd
WHERE ls.lab_day_id = c.lab_day_id
  AND ls.station_type = 'skill_drill'
  AND ls.metadata ? 'station_id'
  AND ls.metadata ->> 'station_id' = sd.station_id
  AND NOT (ls.metadata ? 'available_stations');

-- Pooled "drill-card-rotation" skill_drill stations.
UPDATE lab_stations ls
SET drill_ids = (
  SELECT array_agg(sd.id ORDER BY sd.station_id)
  FROM jsonb_array_elements(ls.metadata -> 'available_stations') AS elem
  JOIN skill_drills sd ON sd.station_id = elem ->> 'station_id'
)
FROM _s3_created_days c
WHERE ls.lab_day_id = c.lab_day_id
  AND ls.station_type = 'skill_drill'
  AND ls.metadata ? 'available_stations'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(ls.metadata -> 'available_stations') AS elem2
    JOIN skill_drills sd2 ON sd2.station_id = elem2 ->> 'station_id'
  );

-- Link + title the 15 blocks from the lab_days just created. Title is
-- derived from the template content (the task explicitly allows this);
-- instructor_id is intentionally left untouched.
UPDATE pmi_schedule_blocks b
SET linked_lab_day_id = ld.id, title = ld.title, updated_at = now()
FROM lab_days ld
WHERE ld.cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb'
  AND ld.semester = 3
  AND ld.date = b.date
  AND b.program_schedule_id = '86992083-6715-4c82-b5ff-c3500a214c12'
  AND b.block_type = 'lab';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- UPDATE pmi_schedule_blocks b
--   SET linked_lab_day_id = NULL, title = NULL, updated_at = now()
--   FROM lab_days ld
--   WHERE ld.cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb' AND ld.semester = 3
--     AND ld.date = b.date AND b.program_schedule_id = '86992083-6715-4c82-b5ff-c3500a214c12'
--     AND b.block_type = 'lab' AND b.linked_lab_day_id = ld.id;
-- DELETE FROM lab_stations WHERE lab_day_id IN (
--   SELECT id FROM lab_days WHERE cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb' AND semester = 3
-- );
-- DELETE FROM lab_days WHERE cohort_id = '8577fdc3-eff6-4000-9302-1ee6e3043eeb' AND semester = 3;
-- UPDATE lab_day_templates SET lab_mode = NULL, updated_by = NULL
--   WHERE program = 'paramedic' AND semester = 3 AND week_number = 14;
-- DROP TABLE IF EXISTS _backup_pmi_schedule_blocks_s3lab_20260904;
-- COMMIT;
