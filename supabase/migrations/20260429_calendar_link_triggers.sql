-- Calendar architecture P3 — auto-link triggers.
--
-- Two trigger points keep pmi_schedule_blocks.linked_lab_day_id and
-- lab_days.start_time/end_time in sync going forward, so future
-- schedules don't need another manual backfill:
--
--   1. AFTER INSERT on lab_days
--      A new lab_day appears for a (cohort, date) that already has
--      a published lab-type schedule block. Set the block's
--      linked_lab_day_id, copy the block's times onto the lab_day.
--
--   2. AFTER UPDATE on pmi_schedule_blocks WHEN status flips
--      draft → published
--      Per the spec: linking + time-copy happen on PUBLISH only.
--      Draft blocks are planning-only and shouldn't affect lab_day
--      records until confirmed. When a lab block transitions to
--      published, link it to any existing matching lab_day and
--      copy times across.
--
-- Both triggers are guarded with `IS NULL` filters so manual values
-- (someone hand-set a lab_day's start_time, or hand-set the FK)
-- always win. Re-firing the triggers is a no-op once the row is
-- in the desired state.
--
-- Recursion: the publish-update trigger does an UPDATE on
-- pmi_schedule_blocks (to set linked_lab_day_id). That fires the
-- trigger again, but the second invocation doesn't see a status
-- change (OLD.status === NEW.status === 'published') so the body
-- short-circuits. Same for the lab_days side: no UPDATE trigger
-- exists on lab_days so the time-copy UPDATE doesn't recurse.

-- ── Function 1: link block to lab_day on lab_day INSERT ───────────
CREATE OR REPLACE FUNCTION pmi_link_block_on_lab_day_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Find a published lab-type schedule block for the same
  -- (cohort, date) and stamp the FK if it isn't set yet.
  UPDATE pmi_schedule_blocks psb
  SET linked_lab_day_id = NEW.id,
      updated_at = now()
  FROM pmi_program_schedules pps
  WHERE psb.program_schedule_id = pps.id
    AND pps.cohort_id = NEW.cohort_id
    AND psb.date = NEW.date
    AND psb.block_type = 'lab'
    AND psb.status = 'published'
    AND psb.linked_lab_day_id IS NULL;

  -- Copy times from the (any matching) published lab block onto
  -- the new lab_day if it doesn't already have times. UPDATE here
  -- (instead of NEW assignment) because we're an AFTER trigger.
  UPDATE lab_days ld
  SET start_time = psb.start_time,
      end_time   = psb.end_time
  FROM pmi_schedule_blocks psb, pmi_program_schedules pps
  WHERE ld.id = NEW.id
    AND ld.start_time IS NULL
    AND psb.program_schedule_id = pps.id
    AND pps.cohort_id = NEW.cohort_id
    AND psb.date = NEW.date
    AND psb.block_type = 'lab'
    AND psb.status = 'published'
    AND psb.start_time IS NOT NULL;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'lab_day_link_block_trigger'
  ) THEN
    CREATE TRIGGER lab_day_link_block_trigger
      AFTER INSERT ON lab_days
      FOR EACH ROW
      EXECUTE FUNCTION pmi_link_block_on_lab_day_insert();
  END IF;
END $$;

-- ── Function 2: link + copy times on schedule-block publish ───────
CREATE OR REPLACE FUNCTION pmi_link_lab_day_on_block_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when this block is a lab block AND status just flipped
  -- to published. Drafts stay isolated from lab_days per spec.
  IF NEW.block_type <> 'lab' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  -- Stamp the FK on the just-published block (idempotent: only
  -- updates when currently null).
  UPDATE pmi_schedule_blocks psb
  SET linked_lab_day_id = ld.id,
      updated_at = now()
  FROM lab_days ld, pmi_program_schedules pps
  WHERE psb.id = NEW.id
    AND psb.program_schedule_id = pps.id
    AND ld.cohort_id = pps.cohort_id
    AND ld.date = NEW.date
    AND psb.linked_lab_day_id IS NULL;

  -- Copy this block's start/end onto the matching lab_day if the
  -- lab_day has no times yet. Same NULL-only guard so a manual
  -- override on the lab day side wins.
  UPDATE lab_days ld
  SET start_time = NEW.start_time,
      end_time   = NEW.end_time
  FROM pmi_program_schedules pps
  WHERE pps.id = NEW.program_schedule_id
    AND ld.cohort_id = pps.cohort_id
    AND ld.date = NEW.date
    AND ld.start_time IS NULL
    AND NEW.start_time IS NOT NULL;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'schedule_block_publish_link_trigger'
  ) THEN
    CREATE TRIGGER schedule_block_publish_link_trigger
      AFTER UPDATE OF status ON pmi_schedule_blocks
      FOR EACH ROW
      EXECUTE FUNCTION pmi_link_lab_day_on_block_publish();
  END IF;
END $$;

COMMENT ON FUNCTION pmi_link_block_on_lab_day_insert() IS
  'P3 calendar-architecture trigger: when a new lab_day appears for a (cohort,date) with a published lab schedule block, link them and copy times. Manual links / times always win via IS NULL guards.';
COMMENT ON FUNCTION pmi_link_lab_day_on_block_publish() IS
  'P3 calendar-architecture trigger: on schedule-block status flip draft→published, link to any existing matching lab_day and copy times. Drafts are isolated until publish per the spec.';
