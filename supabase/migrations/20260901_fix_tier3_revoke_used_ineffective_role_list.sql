-- Corrects a real defect in `20260901_tier3_revoke_anon_execute_admin_rpcs.sql`
-- (PR #84, commit a96411b): that migration's `REVOKE EXECUTE ... FROM anon,
-- authenticated` statements are a NO-OP as written. Every one of these 8
-- functions only ever had EXECUTE via Postgres's implicit `GRANT ... TO
-- PUBLIC` default (confirmed via `pg_proc.proacl` -- no explicit `anon=X`
-- or `authenticated=X` ACL entry ever existed). `REVOKE ... FROM anon`
-- only removes an explicit grant to that role; it does not touch a
-- role's inherited access via PUBLIC membership. So as committed, that
-- migration would NOT actually close the exposure if replayed from
-- scratch (e.g. restoring to a fresh database), even though it reads as
-- having shipped the fix.
--
-- Production itself is NOT currently vulnerable: a concurrent session in
-- this same run applied the correct `REVOKE ... FROM PUBLIC` form
-- directly via Supabase MCP before this commit landed (verified via
-- `pg_proc.proacl` and a `get_advisors` re-scan showing the anon-exposure
-- count actually drop). This migration exists purely so the TRACKED
-- migration history matches what's actually required to reproduce that
-- secure state -- see the Migration Reversibility rule (every migration
-- must be truthful/replayable, not just present). Safe to apply again on
-- production: revoking a privilege that's already revoked is a no-op,
-- not an error.

REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_notification(
  p_user_email text, p_title text, p_message text, p_type text,
  p_link_url text, p_reference_type text, p_reference_id uuid
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_notification(
  p_user_email text, p_title text, p_message text, p_type text,
  p_link_url text, p_reference_type text, p_reference_id uuid, p_category text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_library_item_status(
  p_item_id uuid, p_status text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.delete_station_admin(
  p_station_id uuid
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.promote_student_to_program(
  p_student_id uuid, p_target_cohort_id uuid, p_event_type text,
  p_transferred_by text, p_notes text, p_new_status text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.pmi_link_block_on_lab_day_insert() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.pmi_link_lab_day_on_block_publish() FROM PUBLIC;

-- ROLLBACK:
-- GRANT EXECUTE ON FUNCTION public.get_all_users() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.create_notification(
--   p_user_email text, p_title text, p_message text, p_type text,
--   p_link_url text, p_reference_type text, p_reference_id uuid
-- ) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.create_notification(
--   p_user_email text, p_title text, p_message text, p_type text,
--   p_link_url text, p_reference_type text, p_reference_id uuid, p_category text
-- ) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.update_library_item_status(
--   p_item_id uuid, p_status text
-- ) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.delete_station_admin(
--   p_station_id uuid
-- ) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.promote_student_to_program(
--   p_student_id uuid, p_target_cohort_id uuid, p_event_type text,
--   p_transferred_by text, p_notes text, p_new_status text
-- ) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.pmi_link_block_on_lab_day_insert() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.pmi_link_lab_day_on_block_publish() TO PUBLIC;
