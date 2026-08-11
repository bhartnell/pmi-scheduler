-- Complio Flu shot R/D status (Rae feedback batch, 2026-08-11, item 2.d).
-- Additive.
--
-- The Complio "Flu shot" column becomes a single-letter status: R = received,
-- D = declined (the separate flu_declination = the VHS Influenza Declination
-- FORM, which is required regardless of vaccination status, stays its own
-- column). This adds the status field; it starts EMPTY (Rae fills it — per the
-- batch's "new columns start empty, do NOT backfill" rule). The legacy boolean
-- flu_shot_complete is PRESERVED in the table (not dropped, not read for the
-- grid anymore) so historical values are recoverable and can be converted to
-- 'received' later on request.

ALTER TABLE student_compliance_docs
  ADD COLUMN IF NOT EXISTS flu_shot_status text;

-- Keep the DB permissive-but-guarded: only the two intended values or NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'student_compliance_docs'
      AND constraint_name = 'student_compliance_docs_flu_shot_status_chk'
  ) THEN
    ALTER TABLE student_compliance_docs
      ADD CONSTRAINT student_compliance_docs_flu_shot_status_chk
      CHECK (flu_shot_status IS NULL OR flu_shot_status IN ('received', 'declined'));
  END IF;
END $$;

COMMENT ON COLUMN student_compliance_docs.flu_shot_status IS 'Flu shot status: received (R) / declined (D) / null. Rae 2026-08-11. Starts empty; supersedes flu_shot_complete for the grid display. flu_shot_complete is preserved for history. The separate flu_declination column (VHS declination FORM) is required regardless.';

-- ROLLBACK:
--   ALTER TABLE student_compliance_docs DROP CONSTRAINT IF EXISTS student_compliance_docs_flu_shot_status_chk;
--   ALTER TABLE student_compliance_docs DROP COLUMN IF EXISTS flu_shot_status;
