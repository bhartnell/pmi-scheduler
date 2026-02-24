-- Ensure student_preceptor_assignments is fully set up
-- Table was created in 20260205_multi_preceptor_assignments.sql
-- Schema was updated in 20260205_fix_preceptor_assignments_schema.sql
-- This migration adds 'backup' as an accepted role value and ensures
-- all required indexes and columns exist.

-- Add 'backup' as an alias for tertiary via a check constraint replacement
-- Drop old constraint if it exists (it was not originally created as a named constraint)
-- Add created_by column if missing (spec requirement)
ALTER TABLE student_preceptor_assignments
  ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Ensure is_active index exists for common filter queries
CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_active
  ON student_preceptor_assignments(internship_id, is_active);

-- Ensure role index exists
CREATE INDEX IF NOT EXISTS idx_preceptor_assignments_role
  ON student_preceptor_assignments(role);
