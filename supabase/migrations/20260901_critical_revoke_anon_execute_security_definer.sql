-- CRITICAL item from the Ben-approved RLS remediation plan (Task Handoff
-- Queue: [SECURITY - advisors, NEEDS BEN] Supabase advisors flag
-- RLS-disabled tables + anon-executable admin RPCs). Ben (2026-08-27)
-- flagged this as "the one genuinely exploitable exposure": SECURITY
-- DEFINER functions executable by the unauthenticated `anon` role via
-- the public anon key shipped in the browser bundle.
--
-- NOTE -- concurrent-session split: a parallel Claude Code session
-- worked this same Task Handoff Queue item at the same time and merged
-- PR #84 (`20260901_tier3_revoke_anon_execute_admin_rpcs.sql`), covering
-- get_all_users, promote_student_to_program, delete_station_admin,
-- update_library_item_status, create_notification (both overloads), and
-- the two pmi_link_* trigger functions. This migration is the
-- complementary remainder that session's own PR comment (correctly for
-- most, incorrectly for one) grouped as "RLS-policy predicate functions,
-- not touched here":
--
--   - is_superadmin, is_access_admin, has_ops_access, is_inventory_admin,
--     is_print_operator: genuinely referenced inside RLS policy
--     USING/WITH CHECK clauses (pg_policies) across ~35 tables
--     (supply_*, print_*, equipment_*, library_*, access_*,
--     skill_templates, inventory_locations, etc). RLS policy evaluation
--     runs as the querying role, so EXECUTE must stay granted to
--     `authenticated` for those policies to keep working -- only `anon`
--     access is revoked for this group.
--   - has_pmi_ops_role: PR #84's own comment lumped this in with the
--     policy-predicate group, but a direct `pg_policies` query
--     (`qual`/`with_check` ILIKE '%has_pmi_ops_role%') returns zero
--     rows -- it is not referenced by any current RLS policy, and (like
--     the group PR #84 did revoke) is never called from any app code
--     path. Revoked from PUBLIC entirely here, same as that group.
--
-- IMPORTANT gotcha discovered while applying: all of these functions
-- carry Postgres's default `GRANT EXECUTE ... TO PUBLIC` from creation
-- time (visible as the `=X` entry in pg_proc.proacl). `REVOKE ... FROM
-- anon` alone is a no-op against that -- anon (and every other role)
-- still inherits EXECUTE via PUBLIC membership. The fix is `REVOKE ...
-- FROM PUBLIC`, which drops the inherited grant while leaving each
-- function's own explicit grants (authenticated, service_role, postgres)
-- untouched. Verified post-apply via has_function_privilege() for
-- anon/authenticated/service_role on all 6 functions below, and Vercel
-- get_runtime_errors (1h) showed zero errors after applying.

-- Not referenced by any RLS policy or app code path -- revoke fully.
REVOKE EXECUTE ON FUNCTION public.has_pmi_ops_role(text) FROM PUBLIC;

-- Referenced inside authenticated-role RLS policies -- revoke anon
-- access only (PUBLIC grant removed; authenticated's own explicit
-- grant is untouched by this).
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_access_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_ops_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_inventory_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_print_operator() FROM PUBLIC;

-- ROLLBACK:
-- GRANT EXECUTE ON FUNCTION public.has_pmi_ops_role(text) TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.is_superadmin() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.is_access_admin() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.has_ops_access() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.is_inventory_admin() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.is_print_operator() TO PUBLIC;
