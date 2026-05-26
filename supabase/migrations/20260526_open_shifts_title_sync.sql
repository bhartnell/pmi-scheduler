-- Keep open_shifts.title in sync with the linked lab_day's title.
--
-- Problem: shifts are created with a title like
--   "Lab Coverage — EMT G5 · Week 3 — Content Pending"
-- When the linked lab_day's title is later updated (e.g. via the
-- per-day Refresh from Template button or the Update from Template
-- bulk flow), the shift title goes stale and confuses coordinators
-- looking at the shifts calendar.
--
-- Fix: AFTER UPDATE trigger on lab_days that swaps the part of the
-- shift title AFTER the last " · " with the new lab_day title, for
-- every open_shifts row that's linked via lab_day_id.
--
-- Why the regex_replace approach (instead of fully reconstructing
-- the title from a cohort + lab_day join): we don't have the
-- cohort name handy in this scope, and "Lab Coverage — <cohort> · "
-- is the consistent prefix. Just swap the suffix; preserve any
-- operator-customized prefix that may have been edited.
--
-- The trigger is a no-op if:
--   - lab_day.title didn't actually change
--   - no open_shifts rows are linked to this lab_day
--   - the shift's title doesn't follow the " · "-delimited format
--     (operator customized the title in a non-standard way → leave alone)

CREATE OR REPLACE FUNCTION sync_open_shifts_title_on_lab_day_update() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    UPDATE open_shifts
    SET title = regexp_replace(title, ' · .*$', ' · ' || NEW.title),
        updated_at = NOW()
    WHERE lab_day_id = NEW.id
      AND title LIKE '% · %';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_open_shifts_title_trg ON lab_days;
CREATE TRIGGER sync_open_shifts_title_trg
  AFTER UPDATE OF title ON lab_days
  FOR EACH ROW
  EXECUTE FUNCTION sync_open_shifts_title_on_lab_day_update();

COMMENT ON FUNCTION sync_open_shifts_title_on_lab_day_update() IS
  'Mirrors lab_days.title changes into open_shifts.title for linked rows. Swaps the suffix after the last " · ". See 20260526_open_shifts_title_sync.sql.';

-- One-time backfill: for any open_shifts row whose title contains
-- "Content Pending" but whose linked lab_day no longer does, fix the
-- title now. This catches the May 27 EMT G5 row + any other stale
-- shifts created before this trigger existed.
UPDATE open_shifts os
SET title = regexp_replace(os.title, ' · .*$', ' · ' || ld.title),
    updated_at = NOW()
FROM lab_days ld
WHERE os.lab_day_id = ld.id
  AND os.title LIKE '% · %'
  AND os.title ILIKE '%Content Pending%'
  AND ld.title NOT ILIKE '%Content Pending%';
