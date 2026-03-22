-- Schema Alignment Audit Migration
-- Generated: 2026-02-06
-- Purpose: Align database schema with API code expectations
--
-- REVIEW BEFORE RUNNING: This migration makes structural changes.
-- Test in a staging environment first.

-- ============================================================================
-- PART 1: feedback_reports table fixes
-- ============================================================================
-- The API code (app/api/feedback/route.ts) uses these columns/values that
-- don't exist in the current schema:
--   - read_at: timestamp when admin first viewed the report
--   - read_by: email of admin who viewed it
--   - archived_at: timestamp when report was archived
--   - updated_at: for tracking last modification (used by auto-archive logic)
--   - status values: 'read', 'archived' (in addition to existing values)

-- Add missing columns to feedback_reports
ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS read_by TEXT;
ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comments for documentation
COMMENT ON COLUMN feedback_reports.read_at IS 'Timestamp when an admin first viewed this report';
COMMENT ON COLUMN feedback_reports.read_by IS 'Email of the admin who first viewed this report';
COMMENT ON COLUMN feedback_reports.archived_at IS 'Timestamp when this report was archived';
COMMENT ON COLUMN feedback_reports.updated_at IS 'Last modification timestamp (used for auto-archive logic)';

-- Add index on updated_at for auto-archive query performance
CREATE INDEX IF NOT EXISTS idx_feedback_reports_updated_at ON feedback_reports(updated_at);

-- Note: The status column uses TEXT type without a CHECK constraint, so any
-- status value can be stored. The API uses: 'new', 'in_progress', 'resolved',
-- 'wont_fix', 'read', 'archived', 'needs_investigation'
-- If you want to enforce valid values, uncomment the constraint below:
--
-- ALTER TABLE feedback_reports DROP CONSTRAINT IF EXISTS feedback_reports_status_check;
-- ALTER TABLE feedback_reports ADD CONSTRAINT feedback_reports_status_check
--   CHECK (status IN ('new', 'in_progress', 'resolved', 'wont_fix', 'read', 'archived', 'needs_investigation'));

-- ============================================================================
-- PART 2: student_compliance_docs schema decision
-- ============================================================================
-- IMPORTANT: There is a schema mismatch between code and database.
--
-- The wide-table migration (20260206_compliance_docs_wide_table.sql) converts
-- the table to have boolean columns like mmr_complete, vzv_complete, etc.
--
-- However, TWO API routes still expect the NORMALIZED format with doc_type/completed:
--
--   1. app/api/lab-management/students/[id]/clinical-tasks/route.ts (lines 32-36)
--      - Queries: SELECT doc_type, completed WHERE completed = true
--
--   2. app/api/clinical/overview/route.ts (lines 96, 123, 128)
--      - Uses: d.completed, d.doc_type
--
-- DECISION REQUIRED - Choose ONE of these options:
--
-- OPTION A: Keep wide-table format, update the API code
--   - Don't run any SQL changes for compliance_docs
--   - Instead, update the two API routes to read wide-table columns
--   - More work but matches the page UI expectations
--
-- OPTION B: Revert to normalized format (row per document)
--   - Uncomment the SQL below to add back doc_type/completed columns
--   - The wide-table columns will remain but be unused
--   - Less disruptive to existing API code

-- OPTION B SQL (uncomment if reverting to normalized format):
-- ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS doc_type TEXT;
-- ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ;
-- ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMPTZ;
-- ALTER TABLE student_compliance_docs ADD COLUMN IF NOT EXISTS notes TEXT;
--
-- -- Drop the unique constraint on student_id (allow multiple rows per student)
-- ALTER TABLE student_compliance_docs DROP CONSTRAINT IF EXISTS student_compliance_docs_student_id_key;
--
-- -- Add unique constraint on (student_id, doc_type) for normalized format
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint WHERE conname = 'student_compliance_docs_student_id_doc_type_key'
--   ) THEN
--     ALTER TABLE student_compliance_docs ADD CONSTRAINT student_compliance_docs_student_id_doc_type_key
--       UNIQUE (student_id, doc_type);
--   END IF;
-- END $$;
--
-- CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON student_compliance_docs(doc_type);

-- ============================================================================
-- PART 3: user_notifications - No changes needed
-- ============================================================================
-- The current schema matches API expectations:
--   - type column accepts: 'info', 'warning', 'success', 'error', 'feedback'
--   - All required columns exist

-- ============================================================================
-- PART 4: emt_student_tracking / aemt_student_tracking - No changes needed
-- ============================================================================
-- Both tables have correct schema with boolean columns for each skill/competency.
-- API routes use wide-table format and match the schema.

-- ============================================================================
-- PART 5: onboarding_* tables - No changes needed
-- ============================================================================
-- All onboarding tables (onboarding_students, onboarding_tasks, onboarding_progress)
-- have correct schema matching API expectations.

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This migration:
-- 1. Adds read_at, read_by, archived_at, updated_at to feedback_reports ✓
-- 2. Documents compliance_docs schema mismatch (requires decision)
-- 3. Confirms other tables are correctly aligned
--
-- After running, verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'feedback_reports' ORDER BY ordinal_position;
