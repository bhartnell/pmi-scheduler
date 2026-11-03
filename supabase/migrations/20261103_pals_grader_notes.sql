-- PALS GRADER NOTES (Ben 2026-11-02): a one-line note on any step and an always-available
-- Performance notes box on both PALS graders. Additive, nullable, no existing row touched.
-- Practice attempts land in pals_test_attempts (phase practice), so one column covers both graders.
ALTER TABLE pals_criterion_results ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE pals_test_attempts ADD COLUMN IF NOT EXISTS performance_notes text;

COMMENT ON COLUMN pals_criterion_results.note IS 'Optional one-line instructor note on this step';
COMMENT ON COLUMN pals_test_attempts.performance_notes IS 'Free-text performance notes on the attempt (any result); separate from remediation_notes (required on NR) and watch_note';

-- ROLLBACK:
-- ALTER TABLE pals_test_attempts DROP COLUMN IF EXISTS performance_notes;
-- ALTER TABLE pals_criterion_results DROP COLUMN IF EXISTS note;
-- (columns only; RLS unchanged)
