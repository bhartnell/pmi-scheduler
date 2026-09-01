-- Tier 0 continuation of the Ben-approved RLS remediation plan
-- (Task Handoff Queue: [SECURITY - advisors, NEEDS BEN] Supabase
-- advisors flag RLS-disabled tables + anon-executable admin RPCs).
--
-- A fresh `get_advisors` pull on 2026-09-01 (routine daily hygiene
-- check) showed rls_disabled_in_public regressed from 50 -> 60 tables
-- since the 2026-08-29 stamp. All 10 new hits are _backup_* snapshot
-- tables created by --backup-guarded scripts during recent sessions
-- (G15 semester/lab-day fixes, the Fall 2026 special-date blocks
-- migration, etc.) -- the same category Tier 0
-- (20260828_tier0_backup_tables_enable_rls.sql) already remediated,
-- just tables created after that migration ran. Confirmed via
-- repo-wide grep (app/, lib/, components/, scripts/) that none of
-- these names are referenced anywhere at runtime -- only mentioned in
-- docs/CHANGELOG.md. No policies are added: these tables are never
-- read by the anon/authenticated client, so enabling RLS with no
-- policy makes them service-role-only (service role bypasses RLS),
-- closing the advisor finding without touching any live read/write
-- path.
--
-- Tier 2 (the ~49 live-table RLS policies) and Tier 3 hardening
-- remain out of scope here -- those need per-table verification
-- against real read paths and stay tracked in the same Task Handoff
-- Queue item.

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
