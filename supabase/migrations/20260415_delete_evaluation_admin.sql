-- Purpose-built RPC for deleting a single student_skill_evaluations row
-- while bypassing the prevent_critical_delete trigger installed by
-- 20260315_fk_cascade_audit_and_delete_protection.sql.
--
-- Background: the DELETE trigger on student_skill_evaluations blocks any
-- direct .delete() from the Supabase client (even via the service role)
-- with P0001 "DELETE on student_skill_evaluations is blocked." That broke
-- the "retest this skill" flow mid-lab on NREMT day (2026-04-15) because
-- instructors could not remove a practice attempt before re-grading.
--
-- A generic admin_delete(target_table, id) function already exists, but
-- having a dedicated RPC for this specific table makes the call site in
-- the DELETE route cleaner and avoids handing a free-form table-name
-- parameter to the API layer.
--
-- SECURITY DEFINER + SET LOCAL ensures the critical-delete override only
-- applies inside this function call and cannot be triggered by a
-- regular client query.

CREATE OR REPLACE FUNCTION delete_evaluation_admin(p_evaluation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Override only applies to this transaction / statement
  PERFORM set_config('app.allow_critical_delete', 'true', true);
  DELETE FROM student_skill_evaluations WHERE id = p_evaluation_id;
END;
$$;

-- Only the service role (used by getSupabaseAdmin) should be able to call this.
REVOKE ALL ON FUNCTION delete_evaluation_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_evaluation_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION delete_evaluation_admin(uuid) FROM authenticated;

NOTIFY pgrst, 'reload schema';
