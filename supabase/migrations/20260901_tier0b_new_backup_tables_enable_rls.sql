-- Tier 0 follow-up (Task Handoff Queue: [SECURITY - advisors, NEEDS BEN]
-- Supabase advisors flag RLS-disabled tables + anon-executable admin RPCs).
-- 11 new dated _backup_* snapshot tables were created 2026-08-28..09-01 by
-- other work (Fall-2026 scheduling fixes, semester-siloing hand-fixes) and
-- flagged by rls_disabled_in_public since the original Tier 0 pass
-- (20260828_tier0_backup_tables_enable_rls.sql). Same pattern: confirmed
-- via repo-wide grep (app/, lib/, components/) that none of these table
-- names are referenced anywhere in application code -- they are one-off
-- restore-point snapshots only. No policies are added: these tables are
-- never read by the anon/authenticated client, so enabling RLS with no
-- policy makes them service-role-only (service role bypasses RLS),
-- closing the advisor finding without touching any live read/write path.

ALTER TABLE public."_backup_aug31_semester_fix_20260831" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_blocks_summer_mistag_20260831" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_g15_blocklinks_20260901" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_g15_generate_dupes_20260831" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_g15_labdays_20260901" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_g15_labdays_semrelabel_20260831" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_g15_labstations_20260901" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_jbooker_enrollment_20260831" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pmi_schedule_blocks_fall2026_20260828" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pmi_semesters_20260831" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_scenarios_xabcde_20260831" ENABLE ROW LEVEL SECURITY;

-- ROLLBACK:
-- ALTER TABLE public."_backup_aug31_semester_fix_20260831" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_blocks_summer_mistag_20260831" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_g15_blocklinks_20260901" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_g15_generate_dupes_20260831" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_g15_labdays_20260901" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_g15_labdays_semrelabel_20260831" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_g15_labstations_20260901" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_jbooker_enrollment_20260831" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pmi_schedule_blocks_fall2026_20260828" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pmi_semesters_20260831" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_scenarios_xabcde_20260831" DISABLE ROW LEVEL SECURITY;
