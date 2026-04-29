-- One-off data fix: assign Gannon as primary instructor on every
-- EMS 121 schedule block tied to a PM14 program schedule.
--
-- Surfaces his class-teaching hours in the coordinator calendar
-- once the new pmi_schedule_blocks.instructor_id column exists.
-- Idempotent — only updates rows where instructor_id is currently
-- NULL, so re-running the migration is a no-op and won't clobber a
-- subsequent manual override (e.g. if Trevor takes a week from him).

DO $$
DECLARE
  gannon_id uuid;
  pm14_cohort_id uuid;
  updated_count integer := 0;
BEGIN
  SELECT id INTO gannon_id
  FROM lab_users
  WHERE email = 'mgannon@pmi.edu'
  LIMIT 1;

  IF gannon_id IS NULL THEN
    RAISE NOTICE 'Gannon (mgannon@pmi.edu) not found in lab_users — skipping backfill.';
    RETURN;
  END IF;

  -- Find PM14 (Group 14, Paramedic). cohort_number stores as numeric,
  -- so 14 matches whether the row is "14" or "14.0".
  SELECT c.id INTO pm14_cohort_id
  FROM cohorts c
  JOIN programs p ON p.id = c.program_id
  WHERE c.cohort_number = 14
  AND p.abbreviation = 'PM'
  LIMIT 1;

  IF pm14_cohort_id IS NULL THEN
    RAISE NOTICE 'PM14 cohort not found — skipping backfill.';
    RETURN;
  END IF;

  -- Update every EMS 121 block scheduled under any program_schedule
  -- that points to PM14. Match on course_name OR title (different
  -- import scripts populate one or the other). Only fill where
  -- instructor_id is currently NULL so a manual override survives.
  UPDATE pmi_schedule_blocks psb
  SET instructor_id = gannon_id,
      updated_at    = now()
  FROM pmi_program_schedules pps
  WHERE psb.program_schedule_id = pps.id
    AND pps.cohort_id = pm14_cohort_id
    AND psb.instructor_id IS NULL
    AND (
      psb.course_name ILIKE '%121%'
      OR psb.title ILIKE '%121%'
      OR psb.course_name ILIKE '%pharmacology%'
      OR psb.title ILIKE '%pharmacology%'
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Assigned Gannon (%) as instructor on % EMS 121 block(s) in PM14.',
    gannon_id, updated_count;
END $$;
