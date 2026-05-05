-- Widen lab_day_templates_category_check to accept 'field_trip'.
--
-- Importing paramedic Semester 2 templates failed for week-X day-Y
-- entries flagged as field trips because the existing CHECK
-- constraint allowed only:
--   orientation, skills_lab, scenario_lab, assessment, capstone,
--   certification, mixed, other
--
-- Drop + re-add idempotently so re-runs are safe. New allowlist
-- adds 'field_trip' alongside the existing values.

ALTER TABLE lab_day_templates
  DROP CONSTRAINT IF EXISTS lab_day_templates_category_check;

ALTER TABLE lab_day_templates
  ADD CONSTRAINT lab_day_templates_category_check
  CHECK (category = ANY (ARRAY[
    'orientation'::text,
    'skills_lab'::text,
    'scenario_lab'::text,
    'assessment'::text,
    'capstone'::text,
    'certification'::text,
    'mixed'::text,
    'field_trip'::text,
    'other'::text
  ]));

COMMENT ON CONSTRAINT lab_day_templates_category_check
  ON lab_day_templates IS
  'Whitelist of category labels rendered in the planner cohort hub. Update both this constraint and the import-handler comment when adding new categories.';
