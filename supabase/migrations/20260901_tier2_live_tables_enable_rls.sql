-- Tier 2 of the Ben-approved RLS remediation plan (Task Handoff Queue:
-- [SECURITY - advisors, NEEDS BEN] Supabase advisors flag RLS-disabled
-- tables + anon-executable admin RPCs -- CONFIRM reachability, do NOT
-- auto-remediate). Ben authorized the tiered plan 2026-08-27; Tier 0
-- (backup tables) and Tier 1 (policy_exists_rls_disabled: equipment,
-- feedback_reports, onboarding_assignments) already shipped.
--
-- This is Tier 2: enables RLS on the 49 LIVE (non-backup) tables the
-- advisors flag as rls_disabled_in_public, confirmed still disabled via
-- direct pg_class.relrowsecurity query against production immediately
-- before writing this migration (not from a possibly-stale advisor
-- cache). Several of these tables hold student PII / grade-adjacent
-- data (assessment_rubrics, rubric_criteria, peer_evaluations,
-- skill_signoffs, student_communications, student_program_enrollments,
-- grade_access_log, medications) and were confirmed via direct grant
-- check to have full anon SELECT/INSERT/UPDATE/DELETE at the table
-- level -- i.e. anyone holding the public anon/publishable key (visible
-- in the client bundle) could read or mutate these rows directly via
-- the Supabase PostgREST endpoint, completely bypassing NextAuth and
-- every server-side authorization check in this app.
--
-- Reachability confirmed safe to close with a blanket RLS-enable (no
-- policies yet, same mechanism as Tier 0/1): grepped app/**/*.tsx for
-- every file that constructs a client-side (anon-key) Supabase client
-- (lib/supabase.ts's getSupabase()/supabase, or any direct
-- createClient(...NEXT_PUBLIC_SUPABASE_ANON_KEY) call) -- only 11 files
-- do this, and all of them use realtime postgres_changes subscriptions
-- scoped to four unrelated tables (lab_day_messages, lab_timer_state,
-- lvfr_schedule_items, lvfr_day_schedule), none of which are in this
-- list. No client component imports getSupabaseAdmin. Every app code
-- path that reads/writes the 49 tables below goes through
-- app/api/**/route.ts handlers using getSupabaseAdmin() (service_role,
-- BYPASSRLS=true in pg_roles per Postgres), so enabling RLS with no
-- policies yet (default-deny for anon/authenticated, no-op for
-- service_role) closes the direct PostgREST/anon-key exposure with zero
-- app-behavior change. Per-role policies (Tier 3) can layer in later
-- for any legitimate authenticated-role direct-client need; none was
-- found to exist today.

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
