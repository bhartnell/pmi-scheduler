-- Calendar architecture fix — link pmi_schedule_blocks to lab_days
-- and backfill times so the calendar pulls one source of truth per
-- event with the right start/end clock-time.
--
-- Background: pmi_schedule_blocks owns WHEN/DISPLAY (block_type='lab'
-- on the planner has the correct cohort start/end times). lab_days
-- owns WHAT/OPERATIONS (stations, evaluations, etc.). They've been
-- floating un-linked, which let the unified calendar emit duplicate
-- events with conflicting clock-times — and the ICS export blew up
-- on the lab_day side because lab_days legacy rows have null
-- start_time / end_time. This migration links them and copies the
-- times across so consumers (calendar grid, ICS export, Google
-- shared-calendar push) have one canonical row per event.
--
-- Idempotent on every step:
--   - ADD COLUMN IF NOT EXISTS  → no-op when columns exist (they do
--     in baseline; included so re-runs against fresh DBs match prod).
--   - linked_lab_day_id update  → AND linked_lab_day_id IS NULL
--     guard so manual links survive re-runs.
--   - lab_day times update      → AND ld.start_time IS NULL guard
--     so any times entered by hand on the lab day stay put.

-- ── Step 1: ensure the time columns exist on lab_days ─────────────
-- (Already present in baseline; keeping the ADD here so migration
-- order works against any schema state.)
ALTER TABLE lab_days
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- ── Step 2a: link schedule blocks to lab_days ─────────────────────
-- Match keys: same cohort (via program_schedule.cohort_id) + same
-- date + block_type='lab'. Only fills NULL slots so manual links
-- aren't clobbered. Logs the count to NOTICE so the migration
-- runner output captures it.
DO $$
DECLARE
  linked_count integer;
BEGIN
  -- Postgres UPDATE...FROM doesn't allow JOIN syntax — list the
  -- additional tables comma-separated and join them in WHERE.
  UPDATE pmi_schedule_blocks psb
  SET linked_lab_day_id = ld.id,
      updated_at = now()
  FROM lab_days ld, pmi_program_schedules pps
  WHERE pps.id = psb.program_schedule_id
    AND pps.cohort_id = ld.cohort_id
    AND psb.date = ld.date
    AND psb.block_type = 'lab'
    AND psb.linked_lab_day_id IS NULL;
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RAISE NOTICE 'Linked % pmi_schedule_blocks to lab_days', linked_count;
END $$;

-- ── Step 2b: backfill lab_day times from the linked schedule block.
-- Uses the just-set linked_lab_day_id when available; falls back to
-- the same (cohort_id, date, block_type='lab') match for any rows
-- where the link is older than this run.
DO $$
DECLARE
  filled_count integer;
BEGIN
  UPDATE lab_days ld
  SET start_time = psb.start_time,
      end_time   = psb.end_time
  FROM pmi_schedule_blocks psb, pmi_program_schedules pps
  WHERE pps.id = psb.program_schedule_id
    AND pps.cohort_id = ld.cohort_id
    AND psb.date = ld.date
    AND psb.block_type = 'lab'
    AND psb.start_time IS NOT NULL
    AND ld.start_time IS NULL;
  GET DIAGNOSTICS filled_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled times on % lab_days', filled_count;
END $$;
