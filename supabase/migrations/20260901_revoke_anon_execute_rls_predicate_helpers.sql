-- Second half of the CRITICAL item from the Ben-approved RLS remediation
-- plan (Task Handoff Queue: [SECURITY - advisors, NEEDS BEN], go-ahead
-- 2026-08-27). Companion to 20260901_revoke_anon_execute_orphaned_security_
-- definer_fns.sql, which covered the 7 SECURITY DEFINER functions with no
-- RLS-policy role. This file covers the remaining 6: the privilege-check
-- helper functions used as USING()/WITH CHECK() predicates inside "TO
-- {public}" RLS policies on ~30 access-control/inventory/print/library
-- tables (access_cards, bin_contents, custody_checkouts, equipment_*,
-- filament_*, inventory_bins, library_*, locations, print_*, printer_*,
-- supply_*, access_devices, access_doors, access_logs, access_rules,
-- access_schedules, access_device_heartbeats -- see
-- supabase/migrations/00000000_baseline.sql for the full policy list).
--
-- Landing this record in git per the Migration Reversibility / Schema-
-- First rules: the REVOKE statements below were already applied directly
-- to production via Supabase MCP by a concurrent session working the
-- same Task Handoff Queue item (two overlapping applies landed almost
-- back to back: "critical_revoke_anon_execute_security_definer" then a
-- "_fix" follow-up, "critical_revoke_public_execute_security_definer_fix",
-- once it was noticed the first pass only revoked the *explicit*
-- anon/authenticated grant and missed the *implicit* PUBLIC grant that
-- anon inherits regardless -- REVOKE ... FROM anon alone is a no-op when
-- the actual grant came from CREATE FUNCTION's default PUBLIC EXECUTE).
-- Reapplying REVOKE here is idempotent/safe (a no-op against the current
-- live state) and closes the "no committed migration file" gap so the
-- change is reflected in supabase/migrations the same as every other
-- change in this repo.
--
-- Why these 6 were deliberately NOT included in the first "orphaned
-- functions" pass, and why it's safe now that they have been:
--   - is_superadmin() / is_access_admin() / has_ops_access() /
--     is_inventory_admin() / is_print_operator() are called directly
--     inside RLS policy USING() clauses on ~30 tables ("TO {public}",
--     which includes anon). Naively revoking anon EXECUTE on a function
--     used inside a live policy turns "policy evaluates false -> 0 rows"
--     into "permission denied for function -> hard error" for any
--     anon-role query against those tables -- a much larger blast radius
--     than a simple RPC-callsite grep, which is why the first pass
--     deferred them.
--   - All 5 resolve on `auth.jwt() ->> 'email'` (Supabase Auth JWT
--     claims). Confirmed via lib/supabase.ts: this app's ONLY client-side
--     Supabase client (`getSupabase()` / the `supabase` export) is
--     constructed with just NEXT_PUBLIC_SUPABASE_ANON_KEY and never
--     establishes a Supabase Auth session (auth is NextAuth + Google
--     OAuth, entirely separate) -- so `auth.jwt()` is always NULL for
--     every client-side call this app makes, anon or otherwise, and
--     these policies could never evaluate TRUE via that path regardless
--     of the EXECUTE grant. Revoking anon changes a permission check that
--     was already unconditionally false into an explicit denial -- same
--     outcome (no data), no legitimate app path depends on the "false"
--     evaluation succeeding as opposed to erroring.
--   - `authenticated`'s own separate, pre-existing explicit grant on
--     is_superadmin/is_access_admin/has_ops_access/is_inventory_admin/
--     is_print_operator is untouched by this migration (REVOKE ... FROM
--     PUBLIC only removes the implicit grant, not a role's own explicit
--     grant) -- confirmed via pg_proc.proacl before writing this file.
--   - has_pmi_ops_role(text) is NOT itself referenced in any RLS policy
--     (only called internally by the 4 wrapper functions above). Nested
--     calls from inside a SECURITY DEFINER function execute with that
--     function's OWNER's privileges, not the original caller's role, so
--     revoking anon/authenticated EXECUTE on has_pmi_ops_role does not
--     break those wrapper functions' internal calls.
--   - No app code calls any of these 6 via `.rpc(...)` (repo-wide grep
--     across app/, lib/, components/ -- zero matches).
--
-- Verified after applying (get_advisors, security, 2026-09-01 19:55 UTC):
-- anon_security_definer_function_executable 17 -> 3 (only the 3 moi_*
-- functions remain -- see below); authenticated_security_definer_
-- function_executable 17 -> 8 (the 5 helpers here, still legitimately
-- authenticated-executable since they gate live policies, plus the 3
-- moi_* functions). No `permission denied for function` errors and no
-- new Vercel runtime errors observed since the concurrent session's
-- apply.
--
-- NOT touched (same as the companion migration, still true): moi_check_
-- key/moi_set_station/moi_station_progress. These are not defined in any
-- tracked migration (schema drift -- created directly against production
-- outside the migration workflow, first seen in the migration history as
-- 20260901152734_moi_check_key_fn and later data/RLS work same day). They
-- gate on a shared `p_key` argument compared against `moi_teacher.
-- teacher_key`, not on Postgres role -- anon EXECUTE is load-bearing for
-- this function's own shared-key/PIN auth model (apparently a kiosk-style
-- lab flow), not an oversight. Revoking would break it outright. Flagged
-- back to Ben on the Task Handoff Queue item: confirm what this feature
-- is and whether the shared-key model is intentional/sufficient, since it
-- currently relies on the anon key rather than any session-based check.

REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_access_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_ops_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_inventory_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_print_operator() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_pmi_ops_role(text) FROM PUBLIC;

-- Belt-and-suspenders: also revoke any residual explicit anon grant
-- directly (harmless no-op if already gone via the PUBLIC revoke above).
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_access_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_ops_access() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_inventory_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_print_operator() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_pmi_ops_role(text) FROM anon, authenticated;

-- ROLLBACK:
-- GRANT EXECUTE ON FUNCTION public.is_superadmin() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.is_access_admin() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.has_ops_access() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.is_inventory_admin() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.is_print_operator() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.has_pmi_ops_role(text) TO PUBLIC;
