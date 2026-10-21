-- Feedback 'Scenario' report type (card: FEEDBACK - scenario type + expected-actions by level)
-- report_type is plain text with no CHECK constraint, so 'scenario' needs no constraint change.
-- Additive: where the scenario on screen is recorded for a 'scenario' report.
ALTER TABLE public.feedback_reports ADD COLUMN IF NOT EXISTS scenario_id text;
ALTER TABLE public.feedback_reports ADD COLUMN IF NOT EXISTS scenario_title text;

-- ROLLBACK:
-- ALTER TABLE public.feedback_reports DROP COLUMN IF EXISTS scenario_title;
-- ALTER TABLE public.feedback_reports DROP COLUMN IF EXISTS scenario_id;
