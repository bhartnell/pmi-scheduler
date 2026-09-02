-- Task Handoff Queue: [DATA FIX - approved] Correct the 12 legacy LVFR
-- quiz-review rows storing 'optional' -> mandatory (Ben approved 2026-07-06).
--
-- The display layer already treats item_type='quiz' rows as mandatory
-- regardless of the stored requirement value (app/lvfr-aemt/day/[date]/page.tsx
-- lines 593-597 and 693-696, feedback ca8caf18) and new quiz rows always get
-- requirement='required' by default (defaultRequirement() in
-- app/api/lvfr-aemt/runsheet/items/route.ts). This migration corrects the 12
-- legacy lvfr_schedule_items rows that still store the old 'optional' value
-- so the DB matches the already-corrected display, instead of relying on the
-- display-layer workaround indefinitely.
--
-- Scope verified live (2026-09-02): exactly 12 rows match
-- item_type='quiz' AND requirement='optional', all titled "Quiz Review".
--
-- DESTRUCTIVE (UPDATE on business data) — restore point taken first per
-- Migration Reversibility HARD REQUIREMENT.

-- 1. Snapshot the affected rows before mutating them.
CREATE TABLE public."_backup_lvfr_schedule_items_quiz_optional_20260902" AS
SELECT * FROM lvfr_schedule_items
WHERE item_type = 'quiz' AND requirement = 'optional';

ALTER TABLE public."_backup_lvfr_schedule_items_quiz_optional_20260902" ENABLE ROW LEVEL SECURITY;

-- 2. Scoped correction — only the 12 legacy quiz rows, nothing else.
UPDATE lvfr_schedule_items
SET requirement = 'required'
WHERE item_type = 'quiz' AND requirement = 'optional';

-- ROLLBACK:
--   UPDATE lvfr_schedule_items li
--   SET requirement = 'optional'
--   FROM public."_backup_lvfr_schedule_items_quiz_optional_20260902" b
--   WHERE li.id = b.id;
--   DROP TABLE public."_backup_lvfr_schedule_items_quiz_optional_20260902";
