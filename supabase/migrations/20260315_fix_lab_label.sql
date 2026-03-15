-- Fix: Rename "Lab" to "S1 Lab" for Paramedic S1 Day 2 lab template
UPDATE pmi_course_templates
SET course_name = 'S1 Lab'
WHERE program_type = 'paramedic'
  AND semester_number = 1
  AND course_code = 'EMS 121'
  AND course_name = 'Lab'
  AND block_type = 'lab';
