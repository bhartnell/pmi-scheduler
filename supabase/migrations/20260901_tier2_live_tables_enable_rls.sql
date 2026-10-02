-- Tier 2 of the Ben-approved RLS remediation plan (Task Handoff Queue:
-- [SECURITY - advisors, NEEDS BEN] Supabase advisors flag RLS-disabled
-- tables + anon-executable admin RPCs). Enables RLS on the 49 live tables
-- flagged by rls_disabled_in_public (the set left after Tier 0/0b covered
-- the 57 archival _backup_* tables and Tier 1 covered the 3
-- policy_exists_rls_disabled tables).
--
-- Verified before applying (repo-wide grep + pg_policies, 2026-09-01):
--   1. None of these 49 tables has any existing policy defined
--      (pg_policies returned zero rows for all 49) -- unlike Tier 1, there
--      is nothing to "turn on", so no policy needs to be added to restore
--      existing intended behavior.
--   2. This application never uses Supabase Auth (zero
--      `supabase.auth.*` / `@supabase/ssr` / `createBrowserClient` usage
--      anywhere in app/, lib/, components/ -- auth is NextAuth/Google
--      OAuth only, and NEXT_PUBLIC_SUPABASE_ANON_KEY is referenced ONLY
--      inside lib/supabase.ts). Concretely: no request this app ever
--      issues can carry a Postgres `authenticated` role JWT -- every
--      non-service-role Supabase call this app makes resolves to `anon`
--      at the database layer, whether it originates in a browser or a
--      Next.js server component.
--   3. Every one of the 49 tables was grepped for `.from('<table>')`
--      across app/, lib/, components/. Where matches exist, every call
--      site was checked and uses `getSupabaseAdmin()` (service_role,
--      which has BYPASSRLS=true and its own separate, unaffected grant)
--      -- either as a locally-scoped `const supabase = getSupabaseAdmin()`
--      or chained directly (`getSupabaseAdmin().from(...)`). Zero call
--      sites use the anon-key singleton (`supabase`/`getSupabase()` from
--      lib/supabase.ts).
--   4. The only client-side (anon-key) `lib/supabase.ts` usage in the
--      whole app is in ~14 files (poll pages, case-session
--      instructor/tv/student views, lvfr-aemt day view, my-certifications,
--      timer-display, lab-day chat, timer banners) -- grepped individually
--      for `.from(...)` and Realtime `postgres_changes` table filters;
--      none reference any of these 49 tables (their only table touch is
--      `polls`, and their only Realtime-subscribed table is
--      `lab_timer_state` -- both outside this list).
--   5. Several of these tables were never referenced by app code at all
--      (`departments` only as a `department:departments!department_id(...)`
--      embedded select from a service-role client; `email_templates`,
--      `grade_access_log`, `lab_day_template_audit`,
--      `lab_equipment_tracking`, `shift_trades`, `user_departments` have
--      zero references anywhere in app/lib/components).
--
-- Given (1)-(5), there is no legitimate anon or authenticated read/write
-- path to preserve on any of these 49 tables -- the correct policy is the
-- same "RLS on, no policy" pattern as Tier 0: this closes the direct
-- unauthenticated-PostgREST exposure the advisor flagged while leaving
-- every real (service-role) read/write path completely unaffected, since
-- service_role bypasses RLS regardless of policies. Extra care items per
-- the task brief (assessment_rubrics, rubric_criteria, peer_evaluations,
-- skill_signoffs, student_communications, student_program_enrollments,
-- grade_access_log) were individually verified against this same
-- service-role-only/zero-usage pattern before inclusion -- see commit
-- message / CHANGELOG entry for the specific files checked per table.
--
-- If a future feature needs real client-side (anon/authenticated) access
-- to any of these tables, add an explicit policy for it at that time --
-- do not remove the blanket RLS-on state added here.

ALTER TABLE public.app_deep_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookable_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_operations_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_semester_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_layout_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_day_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_day_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_day_template_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_equipment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_group_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lvfr_platoon_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osce_student_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osce_student_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmi_academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_scenario_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_signoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smc_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitute_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- ROLLBACK:
-- ALTER TABLE public.app_deep_links DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.assessment_rubrics DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.attendance_appeals DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.bookable_resources DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.broadcast_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.bulk_operations_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.cohort_semester_overrides DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.dashboard_layout_defaults DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.dashboard_layouts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.email_templates DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.equipment_checkouts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.error_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.grade_access_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_day_costs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_day_signups DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_day_template_audit DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_equipment_tracking DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lab_group_assignment_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.learning_plan_notes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.learning_plans DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.link_clicks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.lvfr_platoon_schedule DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.medications DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.mentorship_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.mentorship_pairs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.osce_student_agencies DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.osce_student_schedule DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.peer_evaluations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.pmi_academic_years DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.program_outcomes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.program_requirements DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.resource_bookings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.rubric_criteria DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.rubric_scenario_assignments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.scenario_ratings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.scenario_tags DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.scenario_versions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.shared_calendar_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.shift_trades DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.skill_signoffs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.smc_requirements DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.student_communications DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.student_program_enrollments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.substitute_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_departments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.webhook_deliveries DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.webhooks DISABLE ROW LEVEL SECURITY;
