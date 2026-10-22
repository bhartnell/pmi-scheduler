-- OSCE CAL 5: record a failed automatic calendar create/update/cancel on the block.
-- Additive, nullable; read by the admin calendar panel. Cleared on the next success.
ALTER TABLE osce_time_blocks ADD COLUMN IF NOT EXISTS calendar_error text;

-- ROLLBACK:
-- ALTER TABLE osce_time_blocks DROP COLUMN IF EXISTS calendar_error;
