-- Performance indexes identified via route audit (2026-02-26)
-- All indexes verified as missing from prior migrations.
-- Uses IF NOT EXISTS to be idempotent.

-- ============================================================================
-- scenario_assessments(team_lead_id)
-- Queried in:
--   GET /api/student/my-progress  → .eq('team_lead_id', studentId)
--   POST /api/lab-management/cohorts/[id]/archive → .in('team_lead_id', studentIds)
-- No prior index existed on this column.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_team_lead
  ON scenario_assessments(team_lead_id);

-- ============================================================================
-- scenario_assessments(cohort_id)
-- Queried in:
--   GET /api/admin/data-export  → .eq('cohort_id', cohortId)
-- No prior index existed on cohort_id for this table.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_cohort
  ON scenario_assessments(cohort_id);

-- ============================================================================
-- student_clinical_hours(student_id)
-- Queried in:
--   GET /api/student/my-progress  → .eq('student_id', studentId)
--   GET /api/cron/clinical-hours-reminder → .in('student_id', studentIds)
-- Note: idx_clinical_hours_student exists for the 'clinical_hours' table, but
-- student_clinical_hours is a separate wide table with no indexes at all.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_student_clinical_hours_student
  ON student_clinical_hours(student_id);

-- ============================================================================
-- student_clinical_hours(cohort_id)
-- Queried in:
--   GET /api/admin/data-export  → .eq('cohort_id', cohortId)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_student_clinical_hours_cohort
  ON student_clinical_hours(cohort_id);

-- ============================================================================
-- closeout_surveys(submitted_at)
-- Queried in:
--   GET /api/reports/closeout-surveys → .gte('submitted_at', startDate)
--                                      .lte('submitted_at', endDate)
-- Existing indexes only cover internship_id and survey_type; no date index.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_closeout_surveys_submitted_at
  ON closeout_surveys(submitted_at DESC);

-- ============================================================================
-- skill_signoffs(revoked_at) partial index
-- Queried in:
--   GET /api/student/my-progress → .is('revoked_at', null)
-- The active-signoffs query always filters WHERE revoked_at IS NULL.
-- idx_skill_signoffs_student exists but does not include revoked_at.
-- A partial index covering only non-revoked rows is smaller and faster.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_skill_signoffs_student_active
  ON skill_signoffs(student_id)
  WHERE revoked_at IS NULL;

-- ============================================================================
-- user_notifications(reference_type, created_at)
-- Queried in:
--   GET /api/cron/clinical-hours-reminder →
--       .eq('reference_type', 'clinical_hours_reminder').gte('created_at', sevenDaysAgo)
--       .eq('reference_type', 'clinical_hours_instructor_alert').gte('created_at', ...)
-- These dedup queries run per cohort in the cron loop with no index on reference_type.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_notifications_ref_type_created
  ON user_notifications(reference_type, created_at DESC);

-- ============================================================================
-- ANALYZE new tables so the query planner uses updated statistics
-- ============================================================================
ANALYZE scenario_assessments;
ANALYZE student_clinical_hours;
ANALYZE closeout_surveys;
ANALYZE skill_signoffs;
ANALYZE user_notifications;
