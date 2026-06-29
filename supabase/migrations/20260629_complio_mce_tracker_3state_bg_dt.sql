-- Add 3-state BG/DT status columns and Complio-specific fields
-- to student_compliance_docs and student_mce_modules.
--
-- SAFE: additive only (IF NOT EXISTS). Data migration is update-only
-- (no rows deleted or dropped). 17 rows have background_check_complete=TRUE
-- and 17 have drug_test_complete=TRUE; those get migrated to 'complete'.
--
-- student_compliance_docs additions:
--   background_check_status TEXT  (3-state: ordered | in_progress | complete)
--   drug_test_status TEXT         (3-state: ordered | in_progress | complete)
--   chh_receipt_complete BOOLEAN
--   chh_approval_complete BOOLEAN
--   complio_notes TEXT            (separate from legacy notes column)
--
-- student_mce_modules additions:
--   bg_check_status TEXT          (3-state, parallel to existing bg_check boolean)
--   drug_test_status TEXT         (3-state, parallel to existing drug_test boolean)
--   mce_notes TEXT                (per-student notes for mCE tab)
--   nsp BOOLEAN                   (NSP module)

-- ── student_compliance_docs ──────────────────────────────────────────────────

ALTER TABLE student_compliance_docs
  ADD COLUMN IF NOT EXISTS background_check_status TEXT,
  ADD COLUMN IF NOT EXISTS drug_test_status TEXT,
  ADD COLUMN IF NOT EXISTS chh_receipt_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chh_approval_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS complio_notes TEXT;

-- Add check constraints (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_compliance_docs_bg_status_check'
  ) THEN
    ALTER TABLE student_compliance_docs
      ADD CONSTRAINT student_compliance_docs_bg_status_check
      CHECK (background_check_status IS NULL OR background_check_status = ANY(
        ARRAY['ordered','in_progress','complete']
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_compliance_docs_dt_status_check'
  ) THEN
    ALTER TABLE student_compliance_docs
      ADD CONSTRAINT student_compliance_docs_dt_status_check
      CHECK (drug_test_status IS NULL OR drug_test_status = ANY(
        ARRAY['ordered','in_progress','complete']
      ));
  END IF;
END $$;

-- Migrate existing boolean TRUE rows to 'complete'
UPDATE student_compliance_docs
  SET background_check_status = 'complete'
  WHERE background_check_complete = TRUE
    AND background_check_status IS NULL;

UPDATE student_compliance_docs
  SET drug_test_status = 'complete'
  WHERE drug_test_complete = TRUE
    AND drug_test_status IS NULL;

-- ── student_mce_modules ──────────────────────────────────────────────────────

ALTER TABLE student_mce_modules
  ADD COLUMN IF NOT EXISTS bg_check_status TEXT,
  ADD COLUMN IF NOT EXISTS drug_test_status TEXT,
  ADD COLUMN IF NOT EXISTS mce_notes TEXT,
  ADD COLUMN IF NOT EXISTS nsp BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_mce_modules_bg_status_check'
  ) THEN
    ALTER TABLE student_mce_modules
      ADD CONSTRAINT student_mce_modules_bg_status_check
      CHECK (bg_check_status IS NULL OR bg_check_status = ANY(
        ARRAY['ordered','in_progress','complete']
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_mce_modules_dt_status_check'
  ) THEN
    ALTER TABLE student_mce_modules
      ADD CONSTRAINT student_mce_modules_dt_status_check
      CHECK (drug_test_status IS NULL OR drug_test_status = ANY(
        ARRAY['ordered','in_progress','complete']
      ));
  END IF;
END $$;

-- Migrate existing boolean TRUE rows to 'complete'
UPDATE student_mce_modules
  SET bg_check_status = 'complete'
  WHERE bg_check = TRUE
    AND bg_check_status IS NULL;

UPDATE student_mce_modules
  SET drug_test_status = 'complete'
  WHERE drug_test = TRUE
    AND drug_test_status IS NULL;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
-- To revert this migration:
--
-- ALTER TABLE student_compliance_docs
--   DROP COLUMN IF EXISTS background_check_status,
--   DROP COLUMN IF EXISTS drug_test_status,
--   DROP COLUMN IF EXISTS chh_receipt_complete,
--   DROP COLUMN IF EXISTS chh_approval_complete,
--   DROP COLUMN IF EXISTS complio_notes;
--
-- ALTER TABLE student_mce_modules
--   DROP COLUMN IF EXISTS bg_check_status,
--   DROP COLUMN IF EXISTS drug_test_status,
--   DROP COLUMN IF EXISTS mce_notes,
--   DROP COLUMN IF EXISTS nsp;
--
-- Note: data migrated to *_status columns is lost on rollback.
-- Boolean columns (background_check_complete, drug_test_complete) are untouched.
