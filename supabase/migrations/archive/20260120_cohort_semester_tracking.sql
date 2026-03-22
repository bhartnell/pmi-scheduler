-- ============================================
-- COHORT SEMESTER TRACKING
-- Add semester field to cohorts for grouping PM students by semester
-- ============================================

-- Add semester field to cohorts table
-- Format: "Fall 2025", "Spring 2026", etc.
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS semester TEXT;

-- Add start_date for better tracking
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS end_date DATE;

-- Index for semester queries
CREATE INDEX IF NOT EXISTS idx_cohorts_semester ON cohorts(semester);
