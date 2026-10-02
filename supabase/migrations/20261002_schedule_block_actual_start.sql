-- ACLS UI 4/6: actual start time per schedule block (planned stays in start_time).
-- Additive + idempotent. Nullable: null = not yet entered.
ALTER TABLE pmi_schedule_blocks ADD COLUMN IF NOT EXISTS actual_start_time time;

-- ROLLBACK:
-- ALTER TABLE pmi_schedule_blocks DROP COLUMN IF EXISTS actual_start_time;
