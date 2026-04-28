-- Student lifecycle Phase 2 — atomic transitions + cert_level autostamp.
--
-- Rides on Phase 1 (20260427_student_lifecycle_phase1.sql).  Adds the
-- runtime machinery the API endpoints in this same commit need:
--
--   1. RENAME student_cohort_history.reason → notes  (deferred from Phase 1
--      because the writers were still using `reason`; this commit updates
--      both at once so there's no broken-window between deploy steps).
--   2. promote_student_to_program(...) — atomic RPC the /transfer,
--      /re-enroll, and /graduate endpoints all dispatch through.
--   3. stamp_cert_level_on_insert() trigger on student_skill_evaluations
--      and lab_day_attendance — so any new row gets cert_level
--      auto-derived from the student's current cohort program if the
--      caller didn't pass one. No API code changes needed for that;
--      the trigger respects explicit values (only fills NULL).
--
-- Backfilled cert_level values from Phase 1 are not affected.

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1. RENAME student_cohort_history.reason → notes
-- ──────────────────────────────────────────────────────────────────
-- Idempotent: only renames if `reason` exists AND `notes` doesn't.
-- Both writers (/transfer and /graduate) are updated in the same
-- commit, so there's no window where one half of the system still
-- references the old name.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_cohort_history'
      AND column_name = 'reason'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_cohort_history'
      AND column_name = 'notes'
  ) THEN
    ALTER TABLE student_cohort_history RENAME COLUMN reason TO notes;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- 2. promote_student_to_program RPC
-- ──────────────────────────────────────────────────────────────────
-- Single function the three lifecycle endpoints (/transfer, /re-enroll,
-- and the /graduate path's history insert) all call. Wraps the four
-- writes in one transaction so a failure mid-flight rolls back cleanly:
--
--   1. Mutate student_program_enrollments  (in-place / close+open / open-new
--      depending on current vs target program and student status).
--   2. Update students  (cohort_id, status, graduation_date reset on active).
--   3. Insert student_cohort_history  (with event_type + cert levels).
--
-- Decision tree:
--   • student.status='active' AND same program  → in-place transfer
--     (update enrollment cohort_id, no enrollment status change)
--   • student.status='active' AND different program → program upgrade
--     (close current 'active' as 'graduated' with end_date=today, open
--      new 'active' row pointing at the new cohort)
--   • student.status<>'active'  → re-enrollment / re-entry
--     (don't touch existing terminal rows; just open a new 'active' row)
--
-- The caller pre-computes event_type and passes it in. Validation that
-- event_type matches the actual transition is left to the API layer
-- (so 're-enrollment' vs 'program_upgrade' classification stays in
-- code, not SQL).

CREATE OR REPLACE FUNCTION promote_student_to_program(
  p_student_id        uuid,
  p_target_cohort_id  uuid,
  p_event_type        text,
  p_transferred_by    text,
  p_notes             text DEFAULT NULL,
  p_new_status        text DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cohort_id uuid;
  v_current_status    text;
  v_target_program    text;
  v_current_program   text;
  v_target_cohort_exists boolean;
BEGIN
  -- Lookup current state
  SELECT cohort_id, status
    INTO v_current_cohort_id, v_current_status
    FROM students
    WHERE id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found: %', p_student_id;
  END IF;

  -- Lookup target program (lowercase enum form)
  SELECT
    CASE WHEN p.abbreviation IN ('PM','PMD') THEN 'paramedic'
         ELSE LOWER(p.abbreviation) END
    INTO v_target_program
    FROM cohorts c
    JOIN programs p ON p.id = c.program_id
    WHERE c.id = p_target_cohort_id;

  v_target_cohort_exists := FOUND;
  IF NOT v_target_cohort_exists THEN
    RAISE EXCEPTION 'Target cohort not found: %', p_target_cohort_id;
  END IF;

  -- Lookup current program (NULL-safe; student may have no cohort yet)
  IF v_current_cohort_id IS NOT NULL THEN
    SELECT
      CASE WHEN p.abbreviation IN ('PM','PMD') THEN 'paramedic'
           ELSE LOWER(p.abbreviation) END
      INTO v_current_program
      FROM cohorts c
      JOIN programs p ON p.id = c.program_id
      WHERE c.id = v_current_cohort_id;
  END IF;

  -- ── Mutate student_program_enrollments ──────────────────────
  IF v_current_status = 'active' AND v_current_program = v_target_program THEN
    -- Same program in-place transfer: just update the cohort_id on
    -- the existing active row. Doesn't churn the enrollment timeline.
    UPDATE student_program_enrollments
       SET cohort_id  = p_target_cohort_id,
           updated_at = now()
     WHERE student_id = p_student_id
       AND status     = 'active';

  ELSIF v_current_status = 'active' AND v_current_program <> v_target_program THEN
    -- Program upgrade: graduate the current enrollment, open a new
    -- active one for the target program.
    UPDATE student_program_enrollments
       SET status     = 'graduated',
           end_date   = CURRENT_DATE,
           updated_at = now()
     WHERE student_id = p_student_id
       AND status     = 'active';

    INSERT INTO student_program_enrollments
        (student_id, cohort_id, program, status, start_date)
    VALUES
        (p_student_id, p_target_cohort_id, v_target_program, 'active', CURRENT_DATE);

  ELSE
    -- Re-enrollment from withdrawn / graduated / on_hold: don't touch
    -- the terminal row, just open a new active one.
    INSERT INTO student_program_enrollments
        (student_id, cohort_id, program, status, start_date)
    VALUES
        (p_student_id, p_target_cohort_id, v_target_program, 'active', CURRENT_DATE);
  END IF;

  -- ── Update students ───────────────────────────────────────────
  -- Reset graduation_date if we're flipping back to active — the
  -- previous graduation is captured by the enrollment row, not by
  -- a stale top-level column.
  UPDATE students
     SET cohort_id        = p_target_cohort_id,
         status           = p_new_status,
         graduation_date  = CASE WHEN p_new_status = 'active' THEN NULL
                                  ELSE graduation_date END,
         updated_at       = now()
   WHERE id = p_student_id;

  -- ── Insert student_cohort_history audit row ──────────────────
  INSERT INTO student_cohort_history (
    student_id, from_cohort_id, to_cohort_id,
    previous_status, new_status,
    event_type,
    from_cert_level, to_cert_level,
    notes, transferred_by, transferred_at
  )
  VALUES (
    p_student_id, v_current_cohort_id, p_target_cohort_id,
    v_current_status, p_new_status,
    p_event_type,
    -- Only stamp cert levels when they actually differ; same-program
    -- moves leave them NULL so the column doesn't fill with redundant
    -- duplicates.
    CASE WHEN v_current_program IS NULL OR v_current_program = v_target_program
         THEN NULL ELSE v_current_program END,
    CASE WHEN v_current_program IS NULL OR v_current_program = v_target_program
         THEN NULL ELSE v_target_program END,
    p_notes, p_transferred_by, now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_type', p_event_type,
    'from_program', v_current_program,
    'to_program',   v_target_program,
    'from_status',  v_current_status,
    'to_status',    p_new_status
  );
END;
$$;

COMMENT ON FUNCTION promote_student_to_program IS
  'Atomic lifecycle transition for /transfer, /re-enroll, /upgrade flows. Mutates student_program_enrollments + students and writes the student_cohort_history row in a single transaction.';

-- Grant execute to service_role (the API client connects as that role
-- through the supabase admin client).
GRANT EXECUTE ON FUNCTION promote_student_to_program TO service_role;

-- ──────────────────────────────────────────────────────────────────
-- 3. cert_level autostamp triggers
-- ──────────────────────────────────────────────────────────────────
-- BEFORE INSERT trigger that fills cert_level when the caller didn't
-- pass one. Lets API endpoints continue inserting evaluations and
-- attendance rows without remembering to thread cert_level through —
-- the database fills it from the student's current cohort program.
--
-- Bulk imports (e.g., future Platinum migration) can pass an explicit
-- cert_level which the trigger respects via the IS NULL guard.

CREATE OR REPLACE FUNCTION stamp_cert_level_from_student_cohort()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cert_level IS NULL AND NEW.student_id IS NOT NULL THEN
    SELECT
      CASE WHEN p.abbreviation IN ('PM','PMD') THEN 'paramedic'
           ELSE LOWER(p.abbreviation) END
      INTO NEW.cert_level
      FROM students s
      JOIN cohorts  c ON c.id = s.cohort_id
      JOIN programs p ON p.id = c.program_id
      WHERE s.id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_cert_level_skill_evaluations
  ON student_skill_evaluations;
CREATE TRIGGER stamp_cert_level_skill_evaluations
  BEFORE INSERT ON student_skill_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION stamp_cert_level_from_student_cohort();

DROP TRIGGER IF EXISTS stamp_cert_level_lab_day_attendance
  ON lab_day_attendance;
CREATE TRIGGER stamp_cert_level_lab_day_attendance
  BEFORE INSERT ON lab_day_attendance
  FOR EACH ROW
  EXECUTE FUNCTION stamp_cert_level_from_student_cohort();

COMMIT;
