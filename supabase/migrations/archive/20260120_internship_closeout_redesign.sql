-- ============================================
-- INTERNSHIP CLOSEOUT REDESIGN
-- Reorganize closeout workflow: Internship Completion → SNHD Requirements → NREMT Clearance → Closeout Meeting
-- Remove S2 pre-requisites from detail view (keep in DB for history)
-- ============================================

-- Add new closeout fields to student_internships table
-- 1. Internship Completion (Phase 2 evaluation + hours complete)
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS internship_completion_date DATE;

-- 2. SNHD Requirements (Southern Nevada Health District submission)
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS snhd_submitted BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS snhd_submitted_date DATE;

-- 3. NREMT Clearance (already has cleared_for_nremt, add date)
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS nremt_clearance_date DATE;

-- Note: closeout_meeting_date and closeout_completed already exist

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_student_internships_snhd_submitted ON student_internships(snhd_submitted) WHERE snhd_submitted = true;
CREATE INDEX IF NOT EXISTS idx_student_internships_closeout_status ON student_internships(closeout_completed, snhd_submitted, cleared_for_nremt);
