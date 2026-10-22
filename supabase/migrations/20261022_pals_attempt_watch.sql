-- PALS P2a: pass-but-watch on PALS attempts (Ben 2026-10-19: practice cases and
-- finals can be PASS with a WATCH flag; "watch exists in two other tables but
-- not this one"). Additive, nullable, no existing row touched. result stays
-- PASS | NR (live data: 47 rows, all 'PASS'); watch is a separate flag.
ALTER TABLE pals_test_attempts ADD COLUMN IF NOT EXISTS watch boolean;
ALTER TABLE pals_test_attempts ADD COLUMN IF NOT EXISTS watch_note text;

COMMENT ON COLUMN pals_test_attempts.watch IS 'Pass-but-watch flag; NULL = not assessed, true = watch, false = no concern';
COMMENT ON COLUMN pals_test_attempts.watch_note IS 'Typed instructor note explaining the watch flag';

-- ROLLBACK:
-- ALTER TABLE pals_test_attempts DROP COLUMN IF EXISTS watch_note;
-- ALTER TABLE pals_test_attempts DROP COLUMN IF EXISTS watch;
