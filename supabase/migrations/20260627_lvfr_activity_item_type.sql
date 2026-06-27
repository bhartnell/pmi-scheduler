-- 20260627_lvfr_activity_item_type.sql
--
-- Tier-2 LVFR: add 'activity' as a valid item_type for lvfr_schedule_items.
-- 'activity' items map to requirement='optional' (trackable checkbox, not
-- counted in the required-coverage progress meter). This is purely additive —
-- existing rows are unaffected, and the requirement enum already has 'optional'.

ALTER TABLE lvfr_schedule_items
  DROP CONSTRAINT IF EXISTS lvfr_schedule_items_item_type_check;

ALTER TABLE lvfr_schedule_items
  ADD CONSTRAINT lvfr_schedule_items_item_type_check
    CHECK (item_type IS NULL OR item_type = ANY (ARRAY[
      'chapter', 'quiz', 'skills', 'break', 'lab', 'exam', 'other', 'activity'
    ]));

-- ROLLBACK:
-- Safe only if no rows have item_type = 'activity'.
--   ALTER TABLE lvfr_schedule_items DROP CONSTRAINT IF EXISTS lvfr_schedule_items_item_type_check;
--   ALTER TABLE lvfr_schedule_items ADD CONSTRAINT lvfr_schedule_items_item_type_check
--     CHECK (item_type IS NULL OR item_type = ANY (ARRAY[
--       'chapter', 'quiz', 'skills', 'break', 'lab', 'exam', 'other'
--     ]));
