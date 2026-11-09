-- OSCE per-student slot invites (card: OSCE STUDENT INVITES, 2026-11-09).
-- Additive only. NOT applied by Code: hand to Claude AI/Ben per the DB CHANGE RULE.
-- first_slot_offset_min is deliberately nullable with NO default: Ben has not chosen
-- 0 or 15 yet and the send button stays disabled while it is null.

BEGIN;

ALTER TABLE osce_events ADD COLUMN IF NOT EXISTS first_slot_offset_min integer;
ALTER TABLE osce_events ALTER COLUMN minutes_per_student SET DEFAULT 30;

ALTER TABLE osce_student_schedule ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE osce_student_schedule ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz;
ALTER TABLE osce_student_schedule ADD COLUMN IF NOT EXISTS invite_error text;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE osce_student_schedule DROP COLUMN IF EXISTS invite_error;
-- ALTER TABLE osce_student_schedule DROP COLUMN IF EXISTS invite_sent_at;
-- ALTER TABLE osce_student_schedule DROP COLUMN IF EXISTS google_event_id;
-- ALTER TABLE osce_events ALTER COLUMN minutes_per_student SET DEFAULT 32;
-- ALTER TABLE osce_events DROP COLUMN IF EXISTS first_slot_offset_min;
-- COMMIT;
