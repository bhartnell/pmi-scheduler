-- Chest compression fraction (CCF) on a megacode attempt.
-- One jsonb record: { compression_seconds, arrest_seconds, percent, source ('calculated'|'entered'|'device'),
-- intervals[], original{}, edited_by, edited_at }. Additive + nullable: attempts saved without the
-- timer are unchanged. Only the percent goes on score sheets; intervals are in-app debrief data.
ALTER TABLE adv_cert_test_attempts ADD COLUMN IF NOT EXISTS ccf jsonb;

-- ROLLBACK:
-- ALTER TABLE adv_cert_test_attempts DROP COLUMN IF EXISTS ccf;
