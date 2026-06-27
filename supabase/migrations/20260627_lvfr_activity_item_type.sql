-- Add 'activity' to the lvfr_schedule_items item_type check constraint.
-- Tier-2 of the 3-tier LVFR runsheet model: instructor-added planned activities
-- that have a trackable checkbox + optional coverage notes.
-- Additive / reversible -- no existing rows affected.

ALTER TABLE lvfr_schedule_items
  DROP CONSTRAINT IF EXISTS lvfr_schedule_items_item_type_check;

ALTER TABLE lvfr_schedule_items
  ADD CONSTRAINT lvfr_schedule_items_item_type_check
  CHECK (
    item_type IS NULL OR
    item_type = ANY (ARRAY[
      'chapter'::text,
      'quiz'::text,
      'skills'::text,
      'break'::text,
      'lab'::text,
      'exam'::text,
      'other'::text,
      'activity'::text
    ])
  );

-- ROLLBACK:
-- ALTER TABLE lvfr_schedule_items
--   DROP CONSTRAINT IF EXISTS lvfr_schedule_items_item_type_check;
-- ALTER TABLE lvfr_schedule_items
--   ADD CONSTRAINT lvfr_schedule_items_item_type_check
--   CHECK (
--     item_type IS NULL OR
--     item_type = ANY (ARRAY[
--       'chapter'::text, 'quiz'::text, 'skills'::text, 'break'::text,
--       'lab'::text, 'exam'::text, 'other'::text
--     ])
--   );
-- NOTE: safe to rollback only if no rows have item_type = 'activity'.
