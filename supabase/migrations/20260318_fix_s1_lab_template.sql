-- Fix S1 Lab template: rename from "Lab" to "S1 Lab" and ensure duration_type is 'full'
-- This ensures it generates blocks for all 15 weeks, not just week 1

UPDATE pmi_course_templates
SET course_name = 'S1 Lab',
    duration_type = 'full'
WHERE program_type = 'paramedic'
  AND semester_number = 1
  AND block_type = 'lab'
  AND day_index = 2;

-- Also update course_code from 'EMS 121' to 'EMS 121' (keep same) but fix name
-- The title in generated blocks will now be "EMS 121 S1 Lab" instead of "EMS 121 Lab"
