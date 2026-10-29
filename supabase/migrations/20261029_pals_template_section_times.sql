-- 20261029_pals_template_section_times.sql
--
-- [Task Handoff Queue: PALS DRY RUN 4/5/6] AHA course setup generated PALS
-- sections with NULL start/end times and the generic 30 min x 4 rotation,
-- because lab_day_templates carried no time or rotation fields. Adds nullable
-- columns for them so every template (any cohort, any course) is the single
-- editable source, and seeds ONLY the five PALS section templates from the
-- sheet values on the parent card (plus Ben's 2026-10-29 1:00 PM Day 1 end
-- decision: Section B = 4 x 20 min, 12 sim + 8 debrief, ends 17:25).
--
--   A  14:45-16:05  20 min x4, no debrief (learning stations)
--   B  16:05-17:25  20 min x4, debrief 8
--   C  08:40-10:20  25 min x4, debrief 10
--   D  10:30-12:10  25 min x4, debrief 10
--   E  13:10-14:25  25 min x3, debrief 10
--
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS; seed only where the
-- column is still NULL, so a later edit is never overwritten. No existing
-- column or row value is changed.

ALTER TABLE lab_day_templates
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS rotation_minutes integer,
  ADD COLUMN IF NOT EXISTS num_rotations integer,
  ADD COLUMN IF NOT EXISTS debrief_minutes integer;

UPDATE lab_day_templates t SET
  start_time      = COALESCE(t.start_time, v.st::time),
  end_time        = COALESCE(t.end_time, v.et::time),
  rotation_minutes = COALESCE(t.rotation_minutes, v.rm),
  num_rotations   = COALESCE(t.num_rotations, v.nr),
  debrief_minutes = COALESCE(t.debrief_minutes, v.dm)
FROM (VALUES
  ('5dc0fa9b-f978-4b42-b83f-6f5d0089e45b'::uuid, '14:45', '16:05', 20, 4, NULL::int),
  ('7ff1edd7-8024-425d-a8ff-c37835be19d4'::uuid, '16:05', '17:25', 20, 4, 8),
  ('7254c536-f69b-4bb5-95ff-816edf0b0cd7'::uuid, '08:40', '10:20', 25, 4, 10),
  ('cf11a5e1-392f-455b-960d-27a8c3146a75'::uuid, '10:30', '12:10', 25, 4, 10),
  ('6678503b-5c52-48ba-8a80-99292b73da99'::uuid, '13:10', '14:25', 25, 3, 10)
) AS v(id, st, et, rm, nr, dm)
WHERE t.id = v.id AND t.cert_course = 'pals';

-- ROLLBACK:
-- ALTER TABLE lab_day_templates DROP COLUMN IF EXISTS start_time, DROP COLUMN IF EXISTS end_time,
--   DROP COLUMN IF EXISTS rotation_minutes, DROP COLUMN IF EXISTS num_rotations, DROP COLUMN IF EXISTS debrief_minutes;
-- (columns are new; dropping them loses only the seeded values above)
