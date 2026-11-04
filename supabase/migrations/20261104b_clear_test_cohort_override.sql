-- TEST COHORT CLEANUP follow-up (2026-11-04): clear_test_cohort now sets the transaction-local
-- app.allow_critical_delete override (after the is_test / non-test-student guards) so the
-- prevent_critical_delete() triggers on students, cohorts, lab_groups etc. allow the archived purge.
-- CREATE OR REPLACE only; no data change. Dry run on PM Group 1 expected: cohorts 1, lab_days 5,
-- students 3, lab_stations 19, student_program_enrollments 3.

CREATE OR REPLACE FUNCTION clear_test_cohort(p_cohort_id uuid, p_by text, p_dry boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v_is_test boolean; v_real int; v_batch uuid := gen_random_uuid(); v_counts jsonb;
BEGIN
  SELECT is_test INTO v_is_test FROM cohorts WHERE id = p_cohort_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cohort not found'; END IF;
  IF v_is_test IS DISTINCT FROM true THEN RAISE EXCEPTION 'only is_test cohorts can be cleared'; END IF;
  SELECT count(*) INTO v_real FROM students WHERE cohort_id = p_cohort_id AND is_test IS DISTINCT FROM true;
  IF v_real > 0 THEN RAISE EXCEPTION 'cohort has % non-test students; refusing', v_real; END IF;

  -- students/cohorts/lab_groups etc. carry prevent_critical_delete(); override is transaction-local
  -- (is_local = true) and only exists inside this admin-only, is_test-guarded function.
  PERFORM set_config('app.allow_critical_delete', 'true', true);

  CREATE TEMP TABLE IF NOT EXISTS _purge_counts(tbl text, n int) ON COMMIT DROP;
  TRUNCATE _purge_counts;
  BEGIN
    PERFORM _purge_rows('students'::regclass, 'cohort_id', ARRAY[p_cohort_id::text], v_batch, p_by, 'clear_test_cohort', 0);
    PERFORM _purge_rows('cohorts'::regclass, 'id', ARRAY[p_cohort_id::text], v_batch, p_by, 'clear_test_cohort', 0);
    SELECT coalesce(jsonb_object_agg(tbl, s), '{}'::jsonb) INTO v_counts
      FROM (SELECT tbl, sum(n)::int AS s FROM _purge_counts GROUP BY tbl) x;
    IF p_dry THEN RAISE EXCEPTION 'DRY_RUN' USING ERRCODE = 'XDRY1'; END IF;
  EXCEPTION WHEN SQLSTATE 'XDRY1' THEN
    NULL;
  END;
  RETURN jsonb_build_object('dry_run', p_dry, 'batch_id', v_batch, 'counts', v_counts);
END $fn$;

REVOKE ALL ON FUNCTION clear_test_cohort(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- ROLLBACK: re-apply the CREATE OR REPLACE FUNCTION clear_test_cohort body from 20261104_clear_test_cohort.sql (without the set_config line).
