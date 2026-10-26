-- STUDENT VIEW 5c: instructor-only notes on a scenario grade, never returned to students.
-- Existing overall_comments stays as the student-visible "Notes to the student"; no stored notes move.
ALTER TABLE scenario_assessments ADD COLUMN IF NOT EXISTS instructor_notes text;

-- ROLLBACK:
-- ALTER TABLE scenario_assessments DROP COLUMN IF EXISTS instructor_notes;  -- drops instructor-written notes; snapshot first (--backup=scenario_assessments)
