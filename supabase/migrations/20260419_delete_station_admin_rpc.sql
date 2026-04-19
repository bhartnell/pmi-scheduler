-- Mid-exam station delete RPC.
--
-- Paramedic NREMT days occasionally spawn accidental overflow stations
-- (e.g. double-click on "Open Additional Station" or wrong source picked).
-- Before this RPC, instructors had no way to remove them mid-exam — a
-- straight DELETE on lab_stations is blocked by the critical-delete
-- guardrail protecting live labs. This mirrors the delete_evaluation_admin
-- pattern: SECURITY DEFINER function that flips the per-transaction
-- allow_critical_delete flag, then deletes and returns the deleted row.
--
-- Safety constraints enforced inside the function:
--   • Station must belong to a lab_day flagged is_nremt_testing = true
--     (mid-exam surgery only)
--   • Station must be an overflow (added_during_exam=true) OR explicitly
--     flagged is_retake_station=true. Original template stations are NOT
--     deletable via this RPC — the coordinator cannot accidentally kill a
--     template-seeded station.
--   • Evaluations referencing the station are preserved (lab_stations
--     ON DELETE CASCADE for station-scoped joins, but
--     student_skill_evaluations.lab_day_id is independent — evals stay).

CREATE OR REPLACE FUNCTION delete_station_admin(p_station_id uuid)
RETURNS TABLE (
  deleted_station_id uuid,
  deleted_station_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_station RECORD;
  v_is_nremt boolean;
  v_added_during_exam boolean;
BEGIN
  -- Look up station + its lab day's NREMT flag
  SELECT s.id, s.custom_title, s.lab_day_id, s.is_retake_station,
         COALESCE((s.metadata->>'added_during_exam')::boolean, false) AS added_during_exam
  INTO v_station
  FROM lab_stations s
  WHERE s.id = p_station_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station % not found', p_station_id
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COALESCE(ld.is_nremt_testing, false) INTO v_is_nremt
  FROM lab_days ld
  WHERE ld.id = v_station.lab_day_id;

  IF NOT v_is_nremt THEN
    RAISE EXCEPTION 'Mid-exam station delete only allowed on NREMT testing days'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_added_during_exam := v_station.added_during_exam;

  IF NOT (v_added_during_exam OR v_station.is_retake_station) THEN
    RAISE EXCEPTION 'Station % is a template station and cannot be deleted mid-exam (only added_during_exam or is_retake_station stations)', p_station_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Flip the per-transaction critical-delete allowance. Scoped to this
  -- transaction only via SET LOCAL.
  PERFORM set_config('app.allow_critical_delete', 'true', true);

  DELETE FROM lab_stations WHERE id = p_station_id;

  RETURN QUERY SELECT v_station.id, v_station.custom_title::text;
END;
$$;

-- Grant to anon/auth — the API route layer enforces the coordinator/
-- admin role check before calling. The RPC's own checks enforce the
-- NREMT-testing and added-during-exam constraints.
GRANT EXECUTE ON FUNCTION delete_station_admin(uuid) TO anon, authenticated;
