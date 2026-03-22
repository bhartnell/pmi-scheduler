-- Migration: Add track_clinical_hours flag to cohorts
-- This allows per-cohort control of which cohorts trigger clinical-related
-- cron notifications (clinical hours reminders, compliance expiry, internship milestones).
--
-- Rules:
--   - PM/PMD Semester 3+ (Clinicals & Internship) => track clinical hours
--   - AEMT (all semesters) => track clinical hours
--   - EMT => never (no clinical hour requirements)
--   - PM/PMD S1-S2 => not yet (clinical hours aren't tracked until S3)

-- 1. Add the column
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS track_clinical_hours BOOLEAN DEFAULT false;

-- 2. Index for cron queries that filter on this flag
CREATE INDEX IF NOT EXISTS idx_cohorts_track_clinical_hours
  ON cohorts(track_clinical_hours) WHERE track_clinical_hours = true;

-- 3. Backfill: set true for active PM S3+, PM S4, and AEMT cohorts
UPDATE cohorts
SET track_clinical_hours = true
WHERE is_active = true
  AND is_archived = false
  AND id IN (
    SELECT c.id
    FROM cohorts c
    JOIN programs p ON c.program_id = p.id
    WHERE
      -- Paramedic cohorts in Semester 3 (Clinicals) or Semester 4 (Internship)
      (UPPER(p.abbreviation) IN ('PM', 'PMD') AND c.current_semester >= 3)
      -- AEMT cohorts — all semesters
      OR UPPER(p.abbreviation) = 'AEMT'
  );

-- 4. RLS: no additional policies needed — cohorts already has RLS via existing policies
