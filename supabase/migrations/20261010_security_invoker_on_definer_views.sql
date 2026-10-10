-- Record of a change already applied to the live DB on 2026-10-10 (Security Tier 3, item 2).
-- Flips public views from SECURITY DEFINER behaviour to security_invoker so callers' RLS applies.
-- Data untouched. Idempotent: re-running is a no-op.
-- Live check on 2026-10-10 found 17 views with security_invoker=true; the card recorded 15 flipped
-- in that run, so 2 were already invoker beforehand (which 2 was not recorded).
ALTER VIEW IF EXISTS public.moi_lab_results SET (security_invoker = true);
ALTER VIEW IF EXISTS public.onboarding_assignment_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.onboarding_benchmarks SET (security_invoker = true);
ALTER VIEW IF EXISTS public.onboarding_instructor_analytics SET (security_invoker = true);
ALTER VIEW IF EXISTS public.onboarding_lane_progress SET (security_invoker = true);
ALTER VIEW IF EXISTS public.onboarding_phase_analytics SET (security_invoker = true);
ALTER VIEW IF EXISTS public.onboarding_task_with_dependencies SET (security_invoker = true);
ALTER VIEW IF EXISTS public.pmi_schedule_conflicts SET (security_invoker = true);
ALTER VIEW IF EXISTS public.student_scenario_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.team_lead_counts SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_access_dashboard SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_access_log_details SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_active_library_checkouts SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_bins_with_details SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_equipment_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_locations_with_counts SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_supply_alerts SET (security_invoker = true);

-- ROLLBACK: for each view above, ALTER VIEW public.<view> RESET (security_invoker);
-- (only the ~15 flipped on 2026-10-10 need resetting; app readers are onboarding_assignment_summary,
-- onboarding_lane_progress, pmi_schedule_conflicts, all via the service-role client.)
