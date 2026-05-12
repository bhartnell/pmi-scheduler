-- Preceptor assignments: convert the full unique constraint on
-- (internship_id, preceptor_id, role) into a partial unique index
-- that only fires on active rows.
--
-- Without this, ending an old assignment and re-adding the same
-- preceptor in the same role hit a 23505 unique_violation — even
-- though no active duplicate existed. The API surfaced that as
--   "This preceptor is already assigned to the internship in the
--    same role"
-- which the user saw as a false-positive. The historical (inactive)
-- row from the ended assignment was blocking the new INSERT.
--
-- A partial unique index `WHERE is_active = true` keeps the real
-- invariant (no two ACTIVE assignments with the same role) while
-- letting history coexist freely. Safe to re-run.

DO $$
BEGIN
  -- Drop the table constraint first (it owns the same backing index).
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_preceptor_assignments_internship_id_preceptor_id_ro_key'
  ) THEN
    ALTER TABLE student_preceptor_assignments
      DROP CONSTRAINT student_preceptor_assignments_internship_id_preceptor_id_ro_key;
  END IF;

  -- Defensive: drop the standalone unique index if it still exists.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'student_preceptor_assignments_internship_id_preceptor_id_ro_key'
  ) THEN
    DROP INDEX public.student_preceptor_assignments_internship_id_preceptor_id_ro_key;
  END IF;
END $$;

-- Partial unique index — only active rows participate.
CREATE UNIQUE INDEX IF NOT EXISTS
  uq_student_preceptor_assignments_active_internship_preceptor_role
  ON student_preceptor_assignments (internship_id, preceptor_id, role)
  WHERE is_active = true;

COMMENT ON INDEX uq_student_preceptor_assignments_active_internship_preceptor_role IS
  'Prevents two ACTIVE assignments of the same preceptor in the same role on the same internship. Inactive (historical) rows are allowed to coexist so re-adding a preceptor after a prior assignment was ended works.';
