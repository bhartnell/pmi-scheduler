-- Tier 1 of the Ben-approved RLS remediation plan (Task Handoff Queue:
-- [SECURITY - advisors, NEEDS BEN] Supabase advisors flag RLS-disabled
-- tables + anon-executable admin RPCs). Enables RLS on the 3 tables
-- flagged by policy_exists_rls_disabled -- these already have policies
-- defined, they just weren't switched on, so the anon/authenticated
-- PostgREST endpoint could bypass them entirely.
--
-- Verified before applying: all app code that reads/writes these 3
-- tables goes through app/api/**/route.ts handlers using
-- lib/supabase.ts's getSupabaseAdmin() (service_role, which has
-- BYPASSRLS=true in pg_roles) -- confirmed no client component queries
-- them directly with the anon key. Enabling RLS only closes the direct
-- PostgREST/anon-key exposure; server-side app behavior is unaffected.

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_assignments ENABLE ROW LEVEL SECURITY;

-- ROLLBACK:
-- ALTER TABLE public.equipment DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.feedback_reports DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.onboarding_assignments DISABLE ROW LEVEL SECURITY;
