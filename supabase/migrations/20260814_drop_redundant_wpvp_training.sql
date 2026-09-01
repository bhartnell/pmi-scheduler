-- Drop the redundant, empty wpvp_training column from student_mce_modules
-- (Ben, 2026-08-14).
--
-- Context: the real "WPVP curriculum [WPVP TR]" data lives in the EXISTING
-- wpvp_curriculum column (15 true rows). wpvp_training was a duplicate that was
-- never populated (verified 0 true rows) and is never bound by the clinical
-- tracker UI (the mCE config binds WPVP Tr -> wpvp_curriculum). Removing it to
-- avoid future mis-binding. Note the distinct wpvp column (WPVP training
-- ATTESTATION [WPVP ATT], 5 true) and wpvp_curriculum (15 true) are both kept.
--
-- Reversible: the column holds no data, so re-adding it restores the prior
-- (empty) state. A full-table restore point is still taken via --backup before
-- applying, per the destructive-op safety rule.

ALTER TABLE student_mce_modules DROP COLUMN IF EXISTS wpvp_training;

-- ROLLBACK:
--   ALTER TABLE student_mce_modules ADD COLUMN IF NOT EXISTS wpvp_training boolean DEFAULT false;
