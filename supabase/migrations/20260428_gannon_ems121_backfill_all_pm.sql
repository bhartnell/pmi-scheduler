-- Follow-up to 20260428_gannon_ems121_backfill.sql.
--
-- The original migration scoped to PM14 only, but production data shows
-- the active EMS 121 blocks are on PM15 (the cohort currently in
-- Semester 1 — PM14 has rolled into Semester 2 and is studying
-- Cardiology / Trauma / Medical Emergencies). EMS 121 (Pharmacology)
-- is a Semester 1 paramedic course that every PM cohort runs through,
-- and Gannon is the lead instructor for it across cohorts.
--
-- This migration assigns Gannon to EMS 121 blocks on ANY paramedic
-- cohort where instructor_id is currently NULL. Idempotent — re-runs
-- are no-ops once everything is assigned, and it skips rows that have
-- been manually overridden so a future "Trevor takes a week"
-- adjustment isn't clobbered.

DO $$
DECLARE
  gannon_id uuid;
  updated_count integer := 0;
BEGIN
  SELECT id INTO gannon_id
  FROM lab_users
  WHERE email = 'mgannon@pmi.edu'
  LIMIT 1;

  IF gannon_id IS NULL THEN
    RAISE NOTICE 'Gannon not found in lab_users — skipping.';
    RETURN;
  END IF;

  UPDATE pmi_schedule_blocks psb
  SET instructor_id = gannon_id,
      updated_at    = now()
  FROM pmi_program_schedules pps
  JOIN cohorts c ON c.id = pps.cohort_id
  JOIN programs p ON p.id = c.program_id
  WHERE psb.program_schedule_id = pps.id
    AND p.abbreviation = 'PM'
    AND psb.instructor_id IS NULL
    AND (
      psb.course_name ILIKE '%121%'
      OR psb.title ILIKE '%121%'
      OR psb.course_name ILIKE '%pharmacology%'
      OR psb.title ILIKE '%pharmacology%'
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Assigned Gannon (%) to % EMS 121 block(s) across paramedic cohorts.',
    gannon_id, updated_count;
END $$;
