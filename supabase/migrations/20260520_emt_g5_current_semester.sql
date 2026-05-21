-- EMT G5 was created without a current_semester value, which broke
-- /api/admin/lab-templates/update-existing's auto-resolve (the only
-- fallback was cohort.semester, also null). EMT only has S1 templates
-- so set current_semester = 1 explicitly.
--
-- Idempotent: WHERE id = ... AND current_semester IS NULL means a
-- second run is a no-op.

UPDATE cohorts
   SET current_semester = 1
 WHERE id = '67080313-0c52-411b-8e88-2ae6e99eb6c6'
   AND current_semester IS NULL;
