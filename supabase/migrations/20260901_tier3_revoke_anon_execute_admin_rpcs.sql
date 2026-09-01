-- Tier 3 of the Ben-approved RLS remediation plan (Task Handoff Queue:
-- [SECURITY - advisors, NEEDS BEN] Supabase advisors flag RLS-disabled
-- tables + anon-executable admin RPCs -- CONFIRM reachability, do NOT
-- auto-remediate).
--
-- Reachability confirmed before applying (Data Safety standing order:
-- fix on sight once verified safe). Advisors flag 17 SECURITY DEFINER
-- functions as anon+authenticated executable via PostgREST
-- (/rest/v1/rpc/<fn>). Split into two groups:
--
--   (A) RLS-policy predicate functions (is_superadmin, has_ops_access,
--       has_pmi_ops_role, is_access_admin, is_inventory_admin,
--       is_print_operator) -- grep-confirmed these gate `TO {public}`
--       USING/WITH CHECK clauses on dozens of live tables (access_*,
--       equipment_*, print_*, filament_*, etc). Revoking EXECUTE would
--       break RLS evaluation for every anon/authenticated query against
--       those tables. NOT touched here -- left for Ben/a follow-up that
--       audits policy-by-policy.
--   (A2) moi_check_key / moi_set_station / moi_station_progress -- not
--       defined in any tracked migration (schema drift: created
--       directly against the live DB, outside version control). Zero
--       visibility into intended behavior from the codebase. NOT
--       touched here -- flagged to Ben separately as an untracked-schema
--       finding, not remediated blind.
--   (B) Action/mutation + trigger functions -- grep-confirmed NOT
--       referenced in any RLS policy, and every app call site
--       (app/api/students/[id]/{re-enroll,transfer}/route.ts,
--       app/api/lab-management/stations/[id]/route.ts) uses
--       lib/supabase.ts's getSupabaseAdmin() (service_role, which
--       bypasses grants). No client-side/anon-key call site exists
--       anywhere in the repo for these 7. This migration revokes
--       EXECUTE from anon/authenticated on group (B) only, closing the
--       direct-PostgREST unauthenticated-write exposure (e.g.
--       get_all_users() dumping user data, or promote_student_to_program()
--       / delete_station_admin() mutating enrollment/station rows with
--       zero auth) with no effect on app behavior.

REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_student_to_program(uuid, uuid, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_station_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_library_item_status(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(text, text, text, text, text, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(text, text, text, text, text, text, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pmi_link_block_on_lab_day_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pmi_link_lab_day_on_block_publish() FROM anon, authenticated;

-- ROLLBACK:
-- GRANT EXECUTE ON FUNCTION public.get_all_users() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.promote_student_to_program(uuid, uuid, text, text, text, text) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.delete_station_admin(uuid) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.update_library_item_status(uuid, text) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.create_notification(text, text, text, text, text, text, uuid) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.create_notification(text, text, text, text, text, text, uuid, text) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.pmi_link_block_on_lab_day_insert() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.pmi_link_lab_day_on_block_publish() TO anon, authenticated;
