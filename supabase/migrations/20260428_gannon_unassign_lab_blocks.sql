-- Correction to the EMS 121 backfill (20260428_gannon_ems121_backfill_all_pm.sql).
--
-- The previous backfill matched on title/course_name containing
-- "121" or "pharmacology" without filtering by block_type, so it
-- assigned Gannon to BOTH the lecture sessions AND the combined
-- S1/S2 lab sessions that share the EMS 121 label.
--
-- Gannon teaches the lecture portion only — the labs run separately
-- with different instructors. This migration unassigns him from any
-- lab block. Idempotent: only touches rows that currently point at
-- Gannon, so re-runs are no-ops once the data is correct.

DO $$
DECLARE
  gannon_id  uuid;
  cleared    integer := 0;
BEGIN
  SELECT id INTO gannon_id
  FROM lab_users
  WHERE email = 'mgannon@pmi.edu'
  LIMIT 1;

  IF gannon_id IS NULL THEN
    RAISE NOTICE 'Gannon not found — nothing to unassign.';
    RETURN;
  END IF;

  UPDATE pmi_schedule_blocks
  SET instructor_id = NULL,
      updated_at    = now()
  WHERE instructor_id = gannon_id
    AND block_type = 'lab';

  GET DIAGNOSTICS cleared = ROW_COUNT;
  RAISE NOTICE 'Unassigned Gannon from % lab block(s).', cleared;
END $$;
