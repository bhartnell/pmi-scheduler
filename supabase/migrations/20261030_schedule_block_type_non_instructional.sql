-- SCHEDULE A: add 'non_instructional' to pmi_schedule_blocks.block_type
-- (scheduled, occupies the day, not instruction, not tracked: breaks, lunch, end of day).
-- Additive: widens the check constraint only. No existing rows change.

ALTER TABLE pmi_schedule_blocks DROP CONSTRAINT IF EXISTS pmi_schedule_blocks_block_type_check;
ALTER TABLE pmi_schedule_blocks ADD CONSTRAINT pmi_schedule_blocks_block_type_check
  CHECK (block_type = ANY (ARRAY['class','lecture','lab','clinical','exam','study','admin','meeting','other','non_instructional']::text[]));

-- ROLLBACK: ALTER TABLE pmi_schedule_blocks DROP CONSTRAINT IF EXISTS pmi_schedule_blocks_block_type_check;
--   ALTER TABLE pmi_schedule_blocks ADD CONSTRAINT pmi_schedule_blocks_block_type_check CHECK (block_type = ANY (ARRAY['class','lecture','lab','clinical','exam','study','admin','meeting','other']::text[]));
--   (only valid while no row uses 'non_instructional'; re-type any such rows first)
