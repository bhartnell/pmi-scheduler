-- Tracking/documentation migration for the remaining CRITICAL-item work from
-- the Ben-approved RLS/advisors remediation plan (Task Handoff Queue:
-- [SECURITY - advisors, NEEDS BEN] Supabase advisors flag RLS-disabled
-- tables + anon-executable admin RPCs).
--
-- Companion to 20260901_revoke_anon_execute_orphaned_security_definer_fns.sql
-- (PR #84, merged) which revoked anon/authenticated EXECUTE on 7 orphaned
-- SECURITY DEFINER functions with zero live callers. This file covers the
-- other 6 flagged functions -- the privilege-check helpers used as USING()
-- predicates inside "TO {public}" RLS policies on ~20 access-control /
-- inventory / print-shop / library tables (access_doors, access_devices,
-- access_cards, access_schedules, access_rules, access_logs,
-- access_device_heartbeats, supply_items, supply_categories,
-- supply_transactions, supply_barcodes, supply_notifications,
-- equipment_items, equipment_categories, equipment_maintenance,
-- equipment_assignments, locations, inventory_bins, bin_contents,
-- custody_checkouts, custody_checkout_items, library_items, library_copies,
-- library_checkouts, library_scanning_sessions, skill_templates,
-- skill_template_items, inventory_locations, printers and the
-- printer/filament/print_request tables).
--
-- NOTE ON HOW THIS WAS APPLIED: a concurrent Code session applied the
-- REVOKE statements below directly to production via Supabase MCP
-- (migration history shows critical_revoke_anon_execute_security_definer /
-- critical_revoke_public_execute_security_definer_fix, both already run)
-- ahead of this file landing in the repo. This migration is written to
-- exactly match that already-applied state and is idempotent (a bare
-- REVOKE on a grant that's already gone is a harmless no-op) -- it exists
-- to close the schema-drift gap per the Schema-First Rule: the live DB
-- was already correct, this commit brings the tracked migration history
-- in line with it.
--
-- WHY anon-only (authenticated is intentionally kept) for 5 of the 6:
-- is_superadmin(), has_ops_access(), is_access_admin(), is_inventory_admin(),
-- is_print_operator() are called from RLS policy USING() clauses on the
-- tables listed above. This app never uses Supabase Auth (grep-confirmed:
-- no supabase.auth.* / @supabase/ssr / createBrowserClient usage anywhere
-- in app/, lib/, components/ -- auth is NextAuth/Google OAuth only), so no
-- request from this app is ever able to carry a Postgres `authenticated`
-- JWT role in the first place; revoking `anon` closes the direct
-- unauthenticated-key exposure (auth.jwt()->>'email' is NULL for any bare
-- anon-key caller, so these already fail closed for anon -- this is
-- defense in depth, not a live vuln fix). `authenticated` is deliberately
-- left granted rather than revoked in this pass: revoking it requires
-- first auditing every one of the ~20 tables above for RLS-enabled state
-- and read/write paths (Tier 2 work, not yet done) so a legitimate
-- policy-gated query doesn't start erroring ("permission denied for
-- function") instead of evaluating to false. Flagged for a future pass
-- once Tier 2's table-by-table audit reaches these tables.
--
-- has_pmi_ops_role(text) is the one exception revoked from BOTH anon and
-- authenticated: it is only ever called internally (by is_access_admin(),
-- is_inventory_admin(), is_print_operator() -- as SECURITY DEFINER, so the
-- internal call runs under the function owner's rights regardless of the
-- caller's grants) and is not referenced directly in any RLS policy's
-- USING()/WITH CHECK() clause (verified via pg_policies) or anywhere in
-- app code -- so there is no legitimate direct-call path for either role.

REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_ops_access() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_access_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_inventory_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_print_operator() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_pmi_ops_role(text) FROM anon, authenticated;

-- ROLLBACK:
-- GRANT EXECUTE ON FUNCTION public.is_superadmin() TO anon;
-- GRANT EXECUTE ON FUNCTION public.has_ops_access() TO anon;
-- GRANT EXECUTE ON FUNCTION public.is_access_admin() TO anon;
-- GRANT EXECUTE ON FUNCTION public.is_inventory_admin() TO anon;
-- GRANT EXECUTE ON FUNCTION public.is_print_operator() TO anon;
-- GRANT EXECUTE ON FUNCTION public.has_pmi_ops_role(text) TO anon, authenticated;
