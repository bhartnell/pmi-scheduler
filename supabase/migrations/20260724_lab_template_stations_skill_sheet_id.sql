-- Add skill_sheet_id to lab_template_stations so a template's "skills"
-- entries can carry a REAL FK to skill_sheets, and the apply/generate
-- pipeline (app/api/admin/lab-templates/apply/route.ts) can copy it onto
-- the generated lab_stations row.
--
-- Root cause fixed here: lab_day_templates -> lab_template_stations already
-- had a `skills` jsonb array (skill names + signoff metadata) per station,
-- but there was no column to hold a resolved skill_sheets FK, and the apply
-- route never set `lab_stations.skill_sheet_id` on generation — so every
-- template-generated station came out "grading ready" in name only (no
-- functional link to a skill_sheet). Surfaced by the NREMT-going-live task
-- (Task Handoff Queue, 2026-07-21/24): the EMT "Capstone — Patient
-- Assessment Medical and Trauma, Team Leader, Deferred Sign-offs" template
-- (id 3ba1d33a-6585-450e-9378-b26e7a5f2675), which doubles as the cohort's
-- flagged NREMT (is_nremt_testing) lab day, generated 4 generic stations
-- with no skill_sheet_id for the current EMT 5.0 cohort's 2026-08-05 lab
-- day. Additive/idempotent, backward-compatible (nullable, defaults to no
-- behavior change for every other template that doesn't set it).

ALTER TABLE lab_template_stations
  ADD COLUMN IF NOT EXISTS skill_sheet_id UUID REFERENCES skill_sheets(id);

COMMENT ON COLUMN lab_template_stations.skill_sheet_id IS
  'Optional FK to skill_sheets. When set, the apply/generate pipeline (app/api/admin/lab-templates/apply/route.ts) copies it onto the generated lab_stations.skill_sheet_id so the station is grading-ready immediately, without an instructor manually linking a skill sheet after generation.';

CREATE INDEX IF NOT EXISTS idx_lab_template_stations_skill_sheet
  ON lab_template_stations (skill_sheet_id) WHERE skill_sheet_id IS NOT NULL;

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_lab_template_stations_skill_sheet;
-- ALTER TABLE lab_template_stations DROP COLUMN IF EXISTS skill_sheet_id;
