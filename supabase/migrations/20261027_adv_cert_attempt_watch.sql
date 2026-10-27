-- MEGACODE GRADER: pass-but-watch on ACLS/PALS-engine megacode attempts
-- (Ben 2026-10-06; card 3f15cd1c). Mirrors pals_test_attempts (20261022).
-- Additive, nullable, no existing row touched, no backfill. overall_result stays
-- pass | fail (AHA-clean); watch is a separate program-only flag.
ALTER TABLE adv_cert_test_attempts ADD COLUMN IF NOT EXISTS watch boolean;
ALTER TABLE adv_cert_test_attempts ADD COLUMN IF NOT EXISTS watch_note text;

COMMENT ON COLUMN adv_cert_test_attempts.watch IS 'Pass-but-watch flag; NULL = not assessed, true = watch, false = no concern. Only kept on a pass.';
COMMENT ON COLUMN adv_cert_test_attempts.watch_note IS 'Typed instructor note explaining the watch flag';

-- ROLLBACK:
-- ALTER TABLE adv_cert_test_attempts DROP COLUMN IF EXISTS watch_note;
-- ALTER TABLE adv_cert_test_attempts DROP COLUMN IF EXISTS watch;
