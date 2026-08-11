-- mCE tab redesign (Task Handoff Queue: Rae feedback batch, stage 4 of 4).
-- Rae's mCE module list changed: the old combined "Orient"/"Conduct" pair
-- is being split into 4 distinct module columns (CS orientation, DH
-- orientation, Standards of conduct, WPVP curriculum), a new Documents-
-- section attestation is being added, and there's now a dedicated
-- Orientation exam column (previously tracked only via a free-text note).
--
-- Existing `orientation` -> relabeled "DH orientation" (Dignity Health),
-- existing `conduct` -> relabeled "Standards of conduct". Both keep their
-- column name and stored values unchanged; this migration only ADDS the
-- columns that don't have an existing equivalent to reuse:
--   cs_attestation    - CommonSpirit (CS) Attestation of Student Orientation
--                       (Documents section)
--   cs_orientation    - CS clinical student orientation module
--                       (Modules section)
--   wpvp_training     - Workplace Violence Prevention training CURRICULUM
--                       (Modules section) — distinct from the existing
--                       `wpvp` column, which is the WPVP training
--                       ATTESTATION (Documents section) and is unchanged.
--   orientation_exam  - Orientation exam completion (its own section);
--                       Rae previously tracked this only via a note.
--
-- All new columns are nullable booleans defaulting to false and start
-- EMPTY for every existing row (per the Data Integrity Operating Rules —
-- never backfill/infer/pattern-guess a value nobody has confirmed; Rae
-- fills these in going forward).

ALTER TABLE student_mce_modules
  ADD COLUMN IF NOT EXISTS cs_attestation   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cs_orientation   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wpvp_training    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orientation_exam boolean DEFAULT false;

COMMENT ON COLUMN student_mce_modules.cs_attestation IS 'CommonSpirit (CS) Attestation of Student Orientation — mCE Documents section (Rae feedback, Task Handoff Queue 2026-08-11). New column, starts empty.';
COMMENT ON COLUMN student_mce_modules.cs_orientation IS 'CS clinical student orientation module — mCE Modules section (Rae feedback 2026-08-11). New column, starts empty.';
COMMENT ON COLUMN student_mce_modules.wpvp_training IS 'Workplace Violence Prevention training curriculum — mCE Modules section (Rae feedback 2026-08-11). Distinct from `wpvp` (WPVP training attestation, Documents section, unchanged). New column, starts empty.';
COMMENT ON COLUMN student_mce_modules.orientation_exam IS 'Orientation exam completion — its own mCE section (Rae feedback 2026-08-11); previously tracked only via the free-text `notes` field. New column, starts empty.';

-- ROLLBACK:
-- ALTER TABLE student_mce_modules
--   DROP COLUMN IF EXISTS cs_attestation,
--   DROP COLUMN IF EXISTS cs_orientation,
--   DROP COLUMN IF EXISTS wpvp_training,
--   DROP COLUMN IF EXISTS orientation_exam;
-- Safe/lossless: all four columns are new and every row starts empty
-- (default false), so dropping them cannot discard any data Rae entered
-- before this migration — only data entered AFTER it ships would be lost,
-- same as any other new-column rollback.
