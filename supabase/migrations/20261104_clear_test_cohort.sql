-- TEST COHORT CLEANUP (2026-11-04): additive. A generic archive table for rows removed by an admin
-- "Clear test data" / "Delete attempt" action, plus a transactional purge function used ONLY for
-- is_test cohorts. Every deleted row is first copied (as jsonb) into deleted_records_archive, so the
-- removal is restorable. RLS on, no policies: reachable only through the service role.

CREATE TABLE IF NOT EXISTS deleted_records_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  table_name text NOT NULL,
  row_data jsonb NOT NULL,
  reason text,
  deleted_by text,
  source text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dra_batch ON deleted_records_archive(batch_id);
CREATE INDEX IF NOT EXISTS idx_dra_table ON deleted_records_archive(table_name);
ALTER TABLE deleted_records_archive ENABLE ROW LEVEL SECURITY;

-- Recursive downward purge: children (via single-column FKs with NO ACTION / RESTRICT / CASCADE) first,
-- then the rows themselves. Never walks upward, never touches parents.
CREATE OR REPLACE FUNCTION _purge_rows(
  p_table regclass, p_col text, p_vals text[], p_batch uuid, p_by text, p_source text, p_depth int
) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE f record; vals2 text[]; n int;
BEGIN
  IF p_depth > 8 THEN RAISE EXCEPTION 'purge depth exceeded at %', p_table; END IF;
  IF p_vals IS NULL OR coalesce(array_length(p_vals, 1), 0) = 0 THEN RETURN; END IF;
  EXECUTE format('SELECT count(*) FROM %s WHERE %I::text = ANY($1)', p_table, p_col) INTO n USING p_vals;
  IF n = 0 THEN RETURN; END IF;
  FOR f IN
    SELECT c.conrelid::regclass AS child, ca.attname AS child_col, pa.attname AS parent_col
    FROM pg_constraint c
    JOIN pg_attribute ca ON ca.attrelid = c.conrelid AND ca.attnum = c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.confrelid = p_table AND c.confdeltype IN ('a', 'r', 'c')
      AND array_length(c.conkey, 1) = 1 AND c.conrelid <> p_table
      AND c.conrelid <> 'deleted_records_archive'::regclass
  LOOP
    EXECUTE format('SELECT coalesce(array_agg(%I::text), ''{}'') FROM %s WHERE %I::text = ANY($1)', f.parent_col, p_table, p_col)
      INTO vals2 USING p_vals;
    PERFORM _purge_rows(f.child, f.child_col, vals2, p_batch, p_by, p_source, p_depth + 1);
  END LOOP;
  EXECUTE format('SELECT count(*) FROM %s WHERE %I::text = ANY($1)', p_table, p_col) INTO n USING p_vals;
  IF n > 0 THEN
    EXECUTE format(
      'INSERT INTO deleted_records_archive(batch_id, table_name, row_data, deleted_by, source) SELECT $2, $3, to_jsonb(t), $4, $5 FROM %s t WHERE t.%I::text = ANY($1)',
      p_table, p_col) USING p_vals, p_batch, p_table::text, p_by, p_source;
    EXECUTE format('DELETE FROM %s WHERE %I::text = ANY($1)', p_table, p_col) USING p_vals;
    INSERT INTO _purge_counts(tbl, n) VALUES (p_table::text, n);
  END IF;
END $fn$;

-- p_dry = true runs the whole purge inside a sub-transaction that is rolled back, so the returned counts
-- are exact without changing anything.
CREATE OR REPLACE FUNCTION clear_test_cohort(p_cohort_id uuid, p_by text, p_dry boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE v_is_test boolean; v_real int; v_batch uuid := gen_random_uuid(); v_counts jsonb;
BEGIN
  SELECT is_test INTO v_is_test FROM cohorts WHERE id = p_cohort_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'cohort not found'; END IF;
  IF v_is_test IS DISTINCT FROM true THEN RAISE EXCEPTION 'only is_test cohorts can be cleared'; END IF;
  SELECT count(*) INTO v_real FROM students WHERE cohort_id = p_cohort_id AND is_test IS DISTINCT FROM true;
  IF v_real > 0 THEN RAISE EXCEPTION 'cohort has % non-test students; refusing', v_real; END IF;

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

REVOKE ALL ON FUNCTION _purge_rows(regclass, text, text[], uuid, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION clear_test_cohort(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- ROLLBACK: DROP FUNCTION IF EXISTS clear_test_cohort(uuid, text, boolean); DROP FUNCTION IF EXISTS _purge_rows(regclass, text, text[], uuid, text, text, int); DROP TABLE IF EXISTS deleted_records_archive; (restoring purged rows: INSERT ... SELECT jsonb_populate_record(NULL::<table>, row_data) FROM deleted_records_archive WHERE batch_id = '<id>' AND table_name = '<table>', parents before children)
