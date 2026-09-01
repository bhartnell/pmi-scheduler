-- mCE Modules redesign — new columns (Rae feedback batch, 2026-08-11, item 3).
-- Additive.
--
-- Rae's updated mCE layout (brief §3.a.ii) adds columns and splits the old
-- combined orientation/conduct module setup into 4 distinct module columns.
-- New columns (all start EMPTY / false — Rae fills them; no backfill per brief):
--   cs_attestation   — CommonSpirit Attestation of Student Orientation [CS Att] (Documents)
--   cs_orientation   — CS clinical student orientation [CS ORI] (Modules)
--   wpvp_curriculum  — Workplace Violence Prevention training CURRICULUM [WPVP TR] (Modules)
--                      NB: distinct from the existing `wpvp` = WPVP training ATTESTATION [WPVP ATT] (Documents)
--   orientation_exam — Orientation exam [EXAM] (standalone, far right)
--
-- The existing `orientation` column is now surfaced as "Dignity Health (DH)
-- orientation" [DH ORI]; `conduct` = Standards of conduct [CONDUCT]. The `nsp`
-- column is removed from the VIEW (older layout, not in Rae's list) but the
-- column is kept in the table so any stored values are recoverable.

ALTER TABLE student_mce_modules
  ADD COLUMN IF NOT EXISTS cs_attestation   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cs_orientation   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wpvp_curriculum  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orientation_exam boolean DEFAULT false;

COMMENT ON COLUMN student_mce_modules.cs_attestation   IS 'CommonSpirit Attestation of Student Orientation [CS Att] (Documents). Rae 2026-08-11. Starts empty.';
COMMENT ON COLUMN student_mce_modules.cs_orientation   IS 'CS clinical student orientation module [CS ORI] (Modules). Rae 2026-08-11. Starts empty.';
COMMENT ON COLUMN student_mce_modules.wpvp_curriculum  IS 'WPVP training CURRICULUM module [WPVP TR] (Modules). Distinct from wpvp = WPVP training ATTESTATION [WPVP ATT]. Rae 2026-08-11. Starts empty.';
COMMENT ON COLUMN student_mce_modules.orientation_exam IS 'Orientation exam [EXAM] (standalone). Rae 2026-08-11. Starts empty.';

-- ROLLBACK:
--   ALTER TABLE student_mce_modules
--     DROP COLUMN IF EXISTS cs_attestation,
--     DROP COLUMN IF EXISTS cs_orientation,
--     DROP COLUMN IF EXISTS wpvp_curriculum,
--     DROP COLUMN IF EXISTS orientation_exam;
