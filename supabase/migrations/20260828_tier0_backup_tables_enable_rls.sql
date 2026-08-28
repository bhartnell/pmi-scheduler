-- Tier 0 of the Ben-approved RLS remediation plan (Task Handoff Queue:
-- [SECURITY - advisors, NEEDS BEN] Supabase advisors flag RLS-disabled
-- tables + anon-executable admin RPCs). Enables RLS on the 46 archival
-- _backup_* tables flagged by rls_disabled_in_public. These are dated
-- one-off snapshots with zero references in app/, lib/, components/, or
-- scripts/ (confirmed by repo-wide grep before this migration) -- only
-- supabase/migrations/00000000_baseline.sql and
-- supabase/migrations/20260324_audit_table_comments.sql reference a
-- handful of the names, and only as CREATE TABLE / COMMENT ON statements,
-- not runtime queries. No policies are added: these tables are never
-- read by the anon/authenticated client, so enabling RLS with no policy
-- makes them service-role-only (service role bypasses RLS), closing the
-- advisor finding without touching any live read/write path.
--
-- Tiers 1-3 (policy_exists_rls_disabled, the ~49 live tables needing new
-- policies, and hardening) are tracked separately in the same Task
-- Handoff Queue item and require live-app verification per table.

ALTER TABLE public."_backup_adv_cert_attempt_students_g14_20260718" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_adv_cert_segment_results_g14_20260718" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_adv_cert_test_attempts_g14_20260718" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_checkouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_cohort_6796e139_20260708" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_cohort_6796e139_dates_20260708" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_cohorts_20260701214922" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_compliance_document_types_20260701050645" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_emtg5_withdrawals_20260805" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_google_calendar_events_20260706165641" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_google_calendar_events_lvfr_20260714" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_instructor_availability_20260823" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_inventory_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_inventory_barcodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_inventory_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_inventory_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_josh_availability_20260721" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_lab_days_g14pals_20260715exec" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_lab_stations_g14pals_20260715exec" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_labusers_volrole_20260807" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_library_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_lvfr_assign_20260709" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_lvfr_coursedays_20260709" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_lvfr_coursedays_20260711" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_lvfr_instructor_assignments_20260708" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_lvfr_schedule_items_20260702_quizreq" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_medical_critfail_edits_20260805" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_moore_medical_20260805" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_nremt_aug5_all_results_20260805" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_nremt_aug5_removed_stations_20260727" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_nremt_station8_replace_20260805" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pals_attempt_students_g14_20260718" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pals_attempts_g14_recovery_20260717" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pals_criterion_results_g14_20260718" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pals_test_attempts_g14_20260718" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pals_testing_retag_20260717" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pmi_schedule_blocks_20260706_jul13_14" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_pmi_schedule_blocks_g14pals_20260715" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_recurring_availability_templates_20260823" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_scenarios_20260712195515" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_scenarios_pals_20260714" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_station8_medical_to_trauma_20260805" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_student_compliance_records_20260701050645" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_student_mce_modules_20260814163640" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_backup_team_lead_log_g14_20260718" ENABLE ROW LEVEL SECURITY;

-- ROLLBACK:
-- ALTER TABLE public."_backup_adv_cert_attempt_students_g14_20260718" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_adv_cert_segment_results_g14_20260718" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_adv_cert_test_attempts_g14_20260718" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_checkouts" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_cohort_6796e139_20260708" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_cohort_6796e139_dates_20260708" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_cohorts_20260701214922" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_compliance_document_types_20260701050645" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_emtg5_withdrawals_20260805" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_google_calendar_events_20260706165641" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_google_calendar_events_lvfr_20260714" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_instructor_availability_20260823" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_inventory_adjustments" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_inventory_barcodes" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_inventory_categories" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_inventory_items" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_inventory_notifications" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_josh_availability_20260721" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_lab_days_g14pals_20260715exec" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_lab_stations_g14pals_20260715exec" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_labusers_volrole_20260807" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_library_items" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_lvfr_assign_20260709" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_lvfr_coursedays_20260709" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_lvfr_coursedays_20260711" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_lvfr_instructor_assignments_20260708" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_lvfr_schedule_items_20260702_quizreq" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_medical_critfail_edits_20260805" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_moore_medical_20260805" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_nremt_aug5_all_results_20260805" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_nremt_aug5_removed_stations_20260727" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_nremt_station8_replace_20260805" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pals_attempt_students_g14_20260718" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pals_attempts_g14_recovery_20260717" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pals_criterion_results_g14_20260718" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pals_test_attempts_g14_20260718" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pals_testing_retag_20260717" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pmi_schedule_blocks_20260706_jul13_14" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_pmi_schedule_blocks_g14pals_20260715" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_recurring_availability_templates_20260823" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_scenarios_20260712195515" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_scenarios_pals_20260714" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_station8_medical_to_trauma_20260805" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_student_compliance_records_20260701050645" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_student_mce_modules_20260814163640" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."_backup_team_lead_log_g14_20260718" DISABLE ROW LEVEL SECURITY;
