-- ============================================================================
-- FK CASCADE AUDIT PART 2: Change remaining ON DELETE CASCADE to ON DELETE
-- RESTRICT on all other core parent tables.
--
-- Part 1 (20260315_fk_cascade_audit_and_delete_protection.sql) changed 109
-- CASCADE FKs on: cohorts, students, lab_days, student_groups, lab_groups,
-- student_internships, summative_evaluations.
--
-- Part 2 changes the remaining 90 CASCADE FKs on all other core parent tables,
-- adds mass delete protection triggers, creates data_export_archives table,
-- and verifies the results.
-- ============================================================================

-- ============================================
-- PART 1: FK CASCADE → RESTRICT
-- 90 constraints across remaining core tables
-- ============================================

-- --- programs (1 FK) ---
ALTER TABLE cohorts DROP CONSTRAINT IF EXISTS cohorts_program_id_fkey;
ALTER TABLE cohorts ADD CONSTRAINT cohorts_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE RESTRICT;

-- --- lab_stations (7 FKs) ---
ALTER TABLE custom_skills DROP CONSTRAINT IF EXISTS custom_skills_station_id_fkey;
ALTER TABLE custom_skills ADD CONSTRAINT custom_skills_station_id_fkey FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE RESTRICT;

ALTER TABLE lab_timer_ready_status DROP CONSTRAINT IF EXISTS lab_timer_ready_status_station_id_fkey;
ALTER TABLE lab_timer_ready_status ADD CONSTRAINT lab_timer_ready_status_station_id_fkey FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE RESTRICT;

ALTER TABLE scenario_assessments DROP CONSTRAINT IF EXISTS scenario_assessments_lab_station_id_fkey;
ALTER TABLE scenario_assessments ADD CONSTRAINT scenario_assessments_lab_station_id_fkey FOREIGN KEY (lab_station_id) REFERENCES lab_stations(id) ON DELETE RESTRICT;

ALTER TABLE skill_assessments DROP CONSTRAINT IF EXISTS skill_assessments_lab_station_id_fkey;
ALTER TABLE skill_assessments ADD CONSTRAINT skill_assessments_lab_station_id_fkey FOREIGN KEY (lab_station_id) REFERENCES lab_stations(id) ON DELETE RESTRICT;

ALTER TABLE station_instructors DROP CONSTRAINT IF EXISTS station_instructors_station_id_fkey;
ALTER TABLE station_instructors ADD CONSTRAINT station_instructors_station_id_fkey FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE RESTRICT;

ALTER TABLE station_skills DROP CONSTRAINT IF EXISTS station_skills_station_id_fkey;
ALTER TABLE station_skills ADD CONSTRAINT station_skills_station_id_fkey FOREIGN KEY (station_id) REFERENCES lab_stations(id) ON DELETE RESTRICT;

ALTER TABLE team_lead_log DROP CONSTRAINT IF EXISTS team_lead_log_lab_station_id_fkey;
ALTER TABLE team_lead_log ADD CONSTRAINT team_lead_log_lab_station_id_fkey FOREIGN KEY (lab_station_id) REFERENCES lab_stations(id) ON DELETE RESTRICT;

-- --- station_pool (1 FK) ---
ALTER TABLE station_completions DROP CONSTRAINT IF EXISTS station_completions_station_id_fkey;
ALTER TABLE station_completions ADD CONSTRAINT station_completions_station_id_fkey FOREIGN KEY (station_id) REFERENCES station_pool(id) ON DELETE RESTRICT;

-- --- clinical_sites (2 FKs) ---
ALTER TABLE clinical_site_departments DROP CONSTRAINT IF EXISTS clinical_site_departments_site_id_fkey;
ALTER TABLE clinical_site_departments ADD CONSTRAINT clinical_site_departments_site_id_fkey FOREIGN KEY (site_id) REFERENCES clinical_sites(id) ON DELETE RESTRICT;

ALTER TABLE clinical_site_schedules DROP CONSTRAINT IF EXISTS clinical_site_schedules_clinical_site_id_fkey;
ALTER TABLE clinical_site_schedules ADD CONSTRAINT clinical_site_schedules_clinical_site_id_fkey FOREIGN KEY (clinical_site_id) REFERENCES clinical_sites(id) ON DELETE RESTRICT;

-- --- clinical_site_visits (1 FK) ---
ALTER TABLE clinical_visit_students DROP CONSTRAINT IF EXISTS clinical_visit_students_visit_id_fkey;
ALTER TABLE clinical_visit_students ADD CONSTRAINT clinical_visit_students_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES clinical_site_visits(id) ON DELETE RESTRICT;

-- --- clinical_affiliations (1 FK) ---
ALTER TABLE affiliation_notifications_log DROP CONSTRAINT IF EXISTS affiliation_notifications_log_affiliation_id_fkey;
ALTER TABLE affiliation_notifications_log ADD CONSTRAINT affiliation_notifications_log_affiliation_id_fkey FOREIGN KEY (affiliation_id) REFERENCES clinical_affiliations(id) ON DELETE RESTRICT;

-- --- clinical_task_templates (1 FK) ---
ALTER TABLE clinical_task_definitions DROP CONSTRAINT IF EXISTS clinical_task_definitions_template_id_fkey;
ALTER TABLE clinical_task_definitions ADD CONSTRAINT clinical_task_definitions_template_id_fkey FOREIGN KEY (template_id) REFERENCES clinical_task_templates(id) ON DELETE RESTRICT;

-- --- scenarios (6 FKs) ---
ALTER TABLE cohort_scenario_completions DROP CONSTRAINT IF EXISTS cohort_scenario_completions_scenario_id_fkey;
ALTER TABLE cohort_scenario_completions ADD CONSTRAINT cohort_scenario_completions_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE RESTRICT;

ALTER TABLE rubric_scenario_assignments DROP CONSTRAINT IF EXISTS rubric_scenario_assignments_scenario_id_fkey;
ALTER TABLE rubric_scenario_assignments ADD CONSTRAINT rubric_scenario_assignments_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE RESTRICT;

ALTER TABLE scenario_favorites DROP CONSTRAINT IF EXISTS scenario_favorites_scenario_id_fkey;
ALTER TABLE scenario_favorites ADD CONSTRAINT scenario_favorites_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE RESTRICT;

ALTER TABLE scenario_ratings DROP CONSTRAINT IF EXISTS scenario_ratings_scenario_id_fkey;
ALTER TABLE scenario_ratings ADD CONSTRAINT scenario_ratings_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE RESTRICT;

ALTER TABLE scenario_tags DROP CONSTRAINT IF EXISTS scenario_tags_scenario_id_fkey;
ALTER TABLE scenario_tags ADD CONSTRAINT scenario_tags_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE RESTRICT;

ALTER TABLE scenario_versions DROP CONSTRAINT IF EXISTS scenario_versions_scenario_id_fkey;
ALTER TABLE scenario_versions ADD CONSTRAINT scenario_versions_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE RESTRICT;

-- --- field_trips (1 FK) ---
ALTER TABLE field_trip_attendance DROP CONSTRAINT IF EXISTS field_trip_attendance_field_trip_id_fkey;
ALTER TABLE field_trip_attendance ADD CONSTRAINT field_trip_attendance_field_trip_id_fkey FOREIGN KEY (field_trip_id) REFERENCES field_trips(id) ON DELETE RESTRICT;

-- --- cohort_tasks (1 FK) ---
ALTER TABLE student_task_status DROP CONSTRAINT IF EXISTS student_task_status_cohort_task_id_fkey;
ALTER TABLE student_task_status ADD CONSTRAINT student_task_status_cohort_task_id_fkey FOREIGN KEY (cohort_task_id) REFERENCES cohort_tasks(id) ON DELETE RESTRICT;

-- --- seating_charts (1 FK) ---
ALTER TABLE seat_assignments DROP CONSTRAINT IF EXISTS seat_assignments_seating_chart_id_fkey;
ALTER TABLE seat_assignments ADD CONSTRAINT seat_assignments_seating_chart_id_fkey FOREIGN KEY (seating_chart_id) REFERENCES seating_charts(id) ON DELETE RESTRICT;

-- --- learning_plans (1 FK) ---
ALTER TABLE learning_plan_notes DROP CONSTRAINT IF EXISTS learning_plan_notes_plan_id_fkey;
ALTER TABLE learning_plan_notes ADD CONSTRAINT learning_plan_notes_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE RESTRICT;

-- --- mentorship_pairs (1 FK) ---
ALTER TABLE mentorship_logs DROP CONSTRAINT IF EXISTS mentorship_logs_pair_id_fkey;
ALTER TABLE mentorship_logs ADD CONSTRAINT mentorship_logs_pair_id_fkey FOREIGN KEY (pair_id) REFERENCES mentorship_pairs(id) ON DELETE RESTRICT;

-- --- custody_checkouts (1 FK) ---
ALTER TABLE custody_checkout_items DROP CONSTRAINT IF EXISTS custody_checkout_items_custody_checkout_id_fkey;
ALTER TABLE custody_checkout_items ADD CONSTRAINT custody_checkout_items_custody_checkout_id_fkey FOREIGN KEY (custody_checkout_id) REFERENCES custody_checkouts(id) ON DELETE RESTRICT;

-- --- assessment_rubrics (2 FKs) ---
ALTER TABLE rubric_criteria DROP CONSTRAINT IF EXISTS rubric_criteria_rubric_id_fkey;
ALTER TABLE rubric_criteria ADD CONSTRAINT rubric_criteria_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES assessment_rubrics(id) ON DELETE RESTRICT;

ALTER TABLE rubric_scenario_assignments DROP CONSTRAINT IF EXISTS rubric_scenario_assignments_rubric_id_fkey;
ALTER TABLE rubric_scenario_assignments ADD CONSTRAINT rubric_scenario_assignments_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES assessment_rubrics(id) ON DELETE RESTRICT;

-- --- skill_sheets (2 FKs) ---
ALTER TABLE skill_sheet_assignments DROP CONSTRAINT IF EXISTS skill_sheet_assignments_skill_sheet_id_fkey;
ALTER TABLE skill_sheet_assignments ADD CONSTRAINT skill_sheet_assignments_skill_sheet_id_fkey FOREIGN KEY (skill_sheet_id) REFERENCES skill_sheets(id) ON DELETE RESTRICT;

ALTER TABLE skill_sheet_steps DROP CONSTRAINT IF EXISTS skill_sheet_steps_skill_sheet_id_fkey;
ALTER TABLE skill_sheet_steps ADD CONSTRAINT skill_sheet_steps_skill_sheet_id_fkey FOREIGN KEY (skill_sheet_id) REFERENCES skill_sheets(id) ON DELETE RESTRICT;

-- --- skills (5 FKs) ---
ALTER TABLE cohort_skill_completions DROP CONSTRAINT IF EXISTS cohort_skill_completions_skill_id_fkey;
ALTER TABLE cohort_skill_completions ADD CONSTRAINT cohort_skill_completions_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE RESTRICT;

ALTER TABLE skill_competencies DROP CONSTRAINT IF EXISTS skill_competencies_skill_id_fkey;
ALTER TABLE skill_competencies ADD CONSTRAINT skill_competencies_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE RESTRICT;

ALTER TABLE skill_documents DROP CONSTRAINT IF EXISTS skill_documents_skill_id_fkey;
ALTER TABLE skill_documents ADD CONSTRAINT skill_documents_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE RESTRICT;

ALTER TABLE skill_signoffs DROP CONSTRAINT IF EXISTS skill_signoffs_skill_id_fkey;
ALTER TABLE skill_signoffs ADD CONSTRAINT skill_signoffs_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE RESTRICT;

ALTER TABLE station_skills DROP CONSTRAINT IF EXISTS station_skills_skill_id_fkey;
ALTER TABLE station_skills ADD CONSTRAINT station_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE RESTRICT;

-- --- skill_drills (2 FKs) ---
ALTER TABLE skill_documents DROP CONSTRAINT IF EXISTS skill_documents_drill_id_fkey;
ALTER TABLE skill_documents ADD CONSTRAINT skill_documents_drill_id_fkey FOREIGN KEY (drill_id) REFERENCES skill_drills(id) ON DELETE RESTRICT;

ALTER TABLE skill_drill_cases DROP CONSTRAINT IF EXISTS skill_drill_cases_skill_drill_id_fkey;
ALTER TABLE skill_drill_cases ADD CONSTRAINT skill_drill_cases_skill_drill_id_fkey FOREIGN KEY (skill_drill_id) REFERENCES skill_drills(id) ON DELETE RESTRICT;

-- --- lab_users (12 FKs) ---
ALTER TABLE ce_records DROP CONSTRAINT IF EXISTS ce_records_instructor_id_fkey;
ALTER TABLE ce_records ADD CONSTRAINT ce_records_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE cert_notifications DROP CONSTRAINT IF EXISTS cert_notifications_instructor_id_fkey;
ALTER TABLE cert_notifications ADD CONSTRAINT cert_notifications_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE instructor_availability DROP CONSTRAINT IF EXISTS instructor_availability_instructor_id_fkey;
ALTER TABLE instructor_availability ADD CONSTRAINT instructor_availability_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE instructor_certifications DROP CONSTRAINT IF EXISTS instructor_certifications_instructor_id_fkey;
ALTER TABLE instructor_certifications ADD CONSTRAINT instructor_certifications_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE instructor_daily_notes DROP CONSTRAINT IF EXISTS instructor_daily_notes_instructor_id_fkey;
ALTER TABLE instructor_daily_notes ADD CONSTRAINT instructor_daily_notes_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE pmi_block_instructors DROP CONSTRAINT IF EXISTS pmi_block_instructors_instructor_id_fkey;
ALTER TABLE pmi_block_instructors ADD CONSTRAINT pmi_block_instructors_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE pmi_instructor_workload DROP CONSTRAINT IF EXISTS pmi_instructor_workload_instructor_id_fkey;
ALTER TABLE pmi_instructor_workload ADD CONSTRAINT pmi_instructor_workload_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_assignee_id_fkey;
ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE teaching_log DROP CONSTRAINT IF EXISTS teaching_log_instructor_id_fkey;
ALTER TABLE teaching_log ADD CONSTRAINT teaching_log_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE user_departments DROP CONSTRAINT IF EXISTS user_departments_user_id_fkey;
ALTER TABLE user_departments ADD CONSTRAINT user_departments_user_id_fkey FOREIGN KEY (user_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE user_endorsements DROP CONSTRAINT IF EXISTS user_endorsements_user_id_fkey;
ALTER TABLE user_endorsements ADD CONSTRAINT user_endorsements_user_id_fkey FOREIGN KEY (user_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES lab_users(id) ON DELETE RESTRICT;

-- --- osce_events (4 FKs) ---
ALTER TABLE osce_observers DROP CONSTRAINT IF EXISTS osce_observers_event_id_fkey;
ALTER TABLE osce_observers ADD CONSTRAINT osce_observers_event_id_fkey FOREIGN KEY (event_id) REFERENCES osce_events(id) ON DELETE RESTRICT;

ALTER TABLE osce_student_agencies DROP CONSTRAINT IF EXISTS osce_student_agencies_event_id_fkey;
ALTER TABLE osce_student_agencies ADD CONSTRAINT osce_student_agencies_event_id_fkey FOREIGN KEY (event_id) REFERENCES osce_events(id) ON DELETE RESTRICT;

ALTER TABLE osce_student_schedule DROP CONSTRAINT IF EXISTS osce_student_schedule_event_id_fkey;
ALTER TABLE osce_student_schedule ADD CONSTRAINT osce_student_schedule_event_id_fkey FOREIGN KEY (event_id) REFERENCES osce_events(id) ON DELETE RESTRICT;

ALTER TABLE osce_time_blocks DROP CONSTRAINT IF EXISTS osce_time_blocks_event_id_fkey;
ALTER TABLE osce_time_blocks ADD CONSTRAINT osce_time_blocks_event_id_fkey FOREIGN KEY (event_id) REFERENCES osce_events(id) ON DELETE RESTRICT;

-- --- osce_observers (1 FK) ---
ALTER TABLE osce_observer_blocks DROP CONSTRAINT IF EXISTS osce_observer_blocks_observer_id_fkey;
ALTER TABLE osce_observer_blocks ADD CONSTRAINT osce_observer_blocks_observer_id_fkey FOREIGN KEY (observer_id) REFERENCES osce_observers(id) ON DELETE RESTRICT;

-- --- osce_time_blocks (2 FKs) ---
ALTER TABLE osce_observer_blocks DROP CONSTRAINT IF EXISTS osce_observer_blocks_block_id_fkey;
ALTER TABLE osce_observer_blocks ADD CONSTRAINT osce_observer_blocks_block_id_fkey FOREIGN KEY (block_id) REFERENCES osce_time_blocks(id) ON DELETE RESTRICT;

ALTER TABLE osce_student_schedule DROP CONSTRAINT IF EXISTS osce_student_schedule_time_block_id_fkey;
ALTER TABLE osce_student_schedule ADD CONSTRAINT osce_student_schedule_time_block_id_fkey FOREIGN KEY (time_block_id) REFERENCES osce_time_blocks(id) ON DELETE RESTRICT;

-- --- open_shifts (2 FKs) ---
ALTER TABLE shift_signups DROP CONSTRAINT IF EXISTS shift_signups_shift_id_fkey;
ALTER TABLE shift_signups ADD CONSTRAINT shift_signups_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES open_shifts(id) ON DELETE RESTRICT;

ALTER TABLE shift_trades DROP CONSTRAINT IF EXISTS shift_trades_original_shift_id_fkey;
ALTER TABLE shift_trades ADD CONSTRAINT shift_trades_original_shift_id_fkey FOREIGN KEY (original_shift_id) REFERENCES open_shifts(id) ON DELETE RESTRICT;

-- --- instructor_certifications (2 FKs) ---
ALTER TABLE ce_records DROP CONSTRAINT IF EXISTS ce_records_certification_id_fkey;
ALTER TABLE ce_records ADD CONSTRAINT ce_records_certification_id_fkey FOREIGN KEY (certification_id) REFERENCES instructor_certifications(id) ON DELETE RESTRICT;

ALTER TABLE cert_notifications DROP CONSTRAINT IF EXISTS cert_notifications_certification_id_fkey;
ALTER TABLE cert_notifications ADD CONSTRAINT cert_notifications_certification_id_fkey FOREIGN KEY (certification_id) REFERENCES instructor_certifications(id) ON DELETE RESTRICT;

-- --- instructor_tasks (2 FKs) ---
ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_task_id_fkey;
ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES instructor_tasks(id) ON DELETE RESTRICT;

ALTER TABLE task_comments DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey;
ALTER TABLE task_comments ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES instructor_tasks(id) ON DELETE RESTRICT;

-- --- case_studies (7 FKs) ---
ALTER TABLE case_analytics DROP CONSTRAINT IF EXISTS case_analytics_case_id_fkey;
ALTER TABLE case_analytics ADD CONSTRAINT case_analytics_case_id_fkey FOREIGN KEY (case_id) REFERENCES case_studies(id) ON DELETE RESTRICT;

ALTER TABLE case_assignments DROP CONSTRAINT IF EXISTS case_assignments_case_id_fkey;
ALTER TABLE case_assignments ADD CONSTRAINT case_assignments_case_id_fkey FOREIGN KEY (case_id) REFERENCES case_studies(id) ON DELETE RESTRICT;

ALTER TABLE case_flags DROP CONSTRAINT IF EXISTS case_flags_case_id_fkey;
ALTER TABLE case_flags ADD CONSTRAINT case_flags_case_id_fkey FOREIGN KEY (case_id) REFERENCES case_studies(id) ON DELETE RESTRICT;

ALTER TABLE case_practice_progress DROP CONSTRAINT IF EXISTS case_practice_progress_case_id_fkey;
ALTER TABLE case_practice_progress ADD CONSTRAINT case_practice_progress_case_id_fkey FOREIGN KEY (case_id) REFERENCES case_studies(id) ON DELETE RESTRICT;

ALTER TABLE case_responses DROP CONSTRAINT IF EXISTS case_responses_case_id_fkey;
ALTER TABLE case_responses ADD CONSTRAINT case_responses_case_id_fkey FOREIGN KEY (case_id) REFERENCES case_studies(id) ON DELETE RESTRICT;

ALTER TABLE case_reviews DROP CONSTRAINT IF EXISTS case_reviews_case_id_fkey;
ALTER TABLE case_reviews ADD CONSTRAINT case_reviews_case_id_fkey FOREIGN KEY (case_id) REFERENCES case_studies(id) ON DELETE RESTRICT;

ALTER TABLE case_sessions DROP CONSTRAINT IF EXISTS case_sessions_case_id_fkey;
ALTER TABLE case_sessions ADD CONSTRAINT case_sessions_case_id_fkey FOREIGN KEY (case_id) REFERENCES case_studies(id) ON DELETE RESTRICT;

-- --- case_sessions (1 FK) ---
ALTER TABLE case_responses DROP CONSTRAINT IF EXISTS case_responses_session_id_fkey;
ALTER TABLE case_responses ADD CONSTRAINT case_responses_session_id_fkey FOREIGN KEY (session_id) REFERENCES case_sessions(id) ON DELETE RESTRICT;

-- --- agencies (1 FK) ---
ALTER TABLE agency_contacts DROP CONSTRAINT IF EXISTS agency_contacts_agency_id_fkey;
ALTER TABLE agency_contacts ADD CONSTRAINT agency_contacts_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE RESTRICT;

-- --- onboarding_assignments (2 FKs) ---
ALTER TABLE onboarding_phase_progress DROP CONSTRAINT IF EXISTS onboarding_phase_progress_assignment_id_fkey;
ALTER TABLE onboarding_phase_progress ADD CONSTRAINT onboarding_phase_progress_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES onboarding_assignments(id) ON DELETE RESTRICT;

ALTER TABLE onboarding_task_progress DROP CONSTRAINT IF EXISTS onboarding_task_progress_assignment_id_fkey;
ALTER TABLE onboarding_task_progress ADD CONSTRAINT onboarding_task_progress_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES onboarding_assignments(id) ON DELETE RESTRICT;

-- --- onboarding_phases (2 FKs) ---
ALTER TABLE onboarding_phase_progress DROP CONSTRAINT IF EXISTS onboarding_phase_progress_phase_id_fkey;
ALTER TABLE onboarding_phase_progress ADD CONSTRAINT onboarding_phase_progress_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES onboarding_phases(id) ON DELETE RESTRICT;

ALTER TABLE onboarding_tasks DROP CONSTRAINT IF EXISTS onboarding_tasks_phase_id_fkey;
ALTER TABLE onboarding_tasks ADD CONSTRAINT onboarding_tasks_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES onboarding_phases(id) ON DELETE RESTRICT;

-- --- onboarding_task_progress (1 FK) ---
ALTER TABLE onboarding_evidence DROP CONSTRAINT IF EXISTS onboarding_evidence_task_progress_id_fkey;
ALTER TABLE onboarding_evidence ADD CONSTRAINT onboarding_evidence_task_progress_id_fkey FOREIGN KEY (task_progress_id) REFERENCES onboarding_task_progress(id) ON DELETE RESTRICT;

-- --- onboarding_tasks (3 FKs) ---
ALTER TABLE onboarding_task_dependencies DROP CONSTRAINT IF EXISTS onboarding_task_dependencies_depends_on_task_id_fkey;
ALTER TABLE onboarding_task_dependencies ADD CONSTRAINT onboarding_task_dependencies_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES onboarding_tasks(id) ON DELETE RESTRICT;

ALTER TABLE onboarding_task_dependencies DROP CONSTRAINT IF EXISTS onboarding_task_dependencies_task_id_fkey;
ALTER TABLE onboarding_task_dependencies ADD CONSTRAINT onboarding_task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES onboarding_tasks(id) ON DELETE RESTRICT;

ALTER TABLE onboarding_task_progress DROP CONSTRAINT IF EXISTS onboarding_task_progress_task_id_fkey;
ALTER TABLE onboarding_task_progress ADD CONSTRAINT onboarding_task_progress_task_id_fkey FOREIGN KEY (task_id) REFERENCES onboarding_tasks(id) ON DELETE RESTRICT;

-- --- onboarding_templates (1 FK) ---
ALTER TABLE onboarding_phases DROP CONSTRAINT IF EXISTS onboarding_phases_template_id_fkey;
ALTER TABLE onboarding_phases ADD CONSTRAINT onboarding_phases_template_id_fkey FOREIGN KEY (template_id) REFERENCES onboarding_templates(id) ON DELETE RESTRICT;

-- --- pmi_program_schedules (1 FK) ---
ALTER TABLE pmi_schedule_blocks DROP CONSTRAINT IF EXISTS pmi_schedule_blocks_program_schedule_id_fkey;
ALTER TABLE pmi_schedule_blocks ADD CONSTRAINT pmi_schedule_blocks_program_schedule_id_fkey FOREIGN KEY (program_schedule_id) REFERENCES pmi_program_schedules(id) ON DELETE RESTRICT;

-- --- pmi_rooms (2 FKs) ---
ALTER TABLE pmi_room_availability DROP CONSTRAINT IF EXISTS pmi_room_availability_room_id_fkey;
ALTER TABLE pmi_room_availability ADD CONSTRAINT pmi_room_availability_room_id_fkey FOREIGN KEY (room_id) REFERENCES pmi_rooms(id) ON DELETE RESTRICT;

ALTER TABLE pmi_schedule_blocks DROP CONSTRAINT IF EXISTS pmi_schedule_blocks_room_id_fkey;
ALTER TABLE pmi_schedule_blocks ADD CONSTRAINT pmi_schedule_blocks_room_id_fkey FOREIGN KEY (room_id) REFERENCES pmi_rooms(id) ON DELETE RESTRICT;

-- --- pmi_schedule_blocks (1 FK) ---
ALTER TABLE pmi_block_instructors DROP CONSTRAINT IF EXISTS pmi_block_instructors_schedule_block_id_fkey;
ALTER TABLE pmi_block_instructors ADD CONSTRAINT pmi_block_instructors_schedule_block_id_fkey FOREIGN KEY (schedule_block_id) REFERENCES pmi_schedule_blocks(id) ON DELETE RESTRICT;

-- --- pmi_semesters (3 FKs) ---
ALTER TABLE pmi_instructor_workload DROP CONSTRAINT IF EXISTS pmi_instructor_workload_semester_id_fkey;
ALTER TABLE pmi_instructor_workload ADD CONSTRAINT pmi_instructor_workload_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES pmi_semesters(id) ON DELETE RESTRICT;

ALTER TABLE pmi_program_schedules DROP CONSTRAINT IF EXISTS pmi_program_schedules_semester_id_fkey;
ALTER TABLE pmi_program_schedules ADD CONSTRAINT pmi_program_schedules_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES pmi_semesters(id) ON DELETE RESTRICT;

ALTER TABLE pmi_room_availability DROP CONSTRAINT IF EXISTS pmi_room_availability_semester_id_fkey;
ALTER TABLE pmi_room_availability ADD CONSTRAINT pmi_room_availability_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES pmi_semesters(id) ON DELETE RESTRICT;

-- --- lab_day_templates (2 FKs) ---
ALTER TABLE lab_template_stations DROP CONSTRAINT IF EXISTS lab_template_stations_template_id_fkey;
ALTER TABLE lab_template_stations ADD CONSTRAINT lab_template_stations_template_id_fkey FOREIGN KEY (template_id) REFERENCES lab_day_templates(id) ON DELETE RESTRICT;

ALTER TABLE lab_template_versions DROP CONSTRAINT IF EXISTS lab_template_versions_template_id_fkey;
ALTER TABLE lab_template_versions ADD CONSTRAINT lab_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES lab_day_templates(id) ON DELETE RESTRICT;

-- --- shift_trade_requests (1 FK) ---
ALTER TABLE shift_swap_interest DROP CONSTRAINT IF EXISTS shift_swap_interest_swap_request_id_fkey;
ALTER TABLE shift_swap_interest ADD CONSTRAINT shift_swap_interest_swap_request_id_fkey FOREIGN KEY (swap_request_id) REFERENCES shift_trade_requests(id) ON DELETE RESTRICT;


-- ============================================
-- PART 2: MASS DELETE PROTECTION TRIGGERS
-- Statement-level triggers that block deletion
-- of more than 5 rows at once unless the session
-- variable 'app.allow_mass_delete' is set to 'true'.
-- ============================================

CREATE OR REPLACE FUNCTION prevent_mass_delete()
RETURNS TRIGGER AS $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT count(*) INTO row_count FROM old_table;
  IF current_setting('app.allow_mass_delete', true) = 'true' THEN
    RETURN NULL;
  END IF;
  IF row_count > 5 THEN
    RAISE EXCEPTION 'Mass delete blocked: % rows would be deleted from %. Use admin override if intentional.', row_count, TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply the mass delete trigger to critical tables
DO $$
DECLARE
  tbl TEXT;
  protected_tables TEXT[] := ARRAY[
    'students',
    'cohorts',
    'student_groups',
    'lab_groups',
    'lab_group_members',
    'student_group_assignments',
    'student_internships',
    'station_completions',
    'student_skill_evaluations',
    'scenario_assessments',
    'skill_assessments',
    'student_clinical_hours',
    'lab_stations',
    'lab_days',
    'programs'
  ];
BEGIN
  FOREACH tbl IN ARRAY protected_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = tbl AND table_schema = 'public'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS prevent_mass_delete_%s ON %I', tbl, tbl);
      EXECUTE format(
        'CREATE TRIGGER prevent_mass_delete_%s '
        'AFTER DELETE ON %I '
        'REFERENCING OLD TABLE AS old_table '
        'FOR EACH STATEMENT '
        'EXECUTE FUNCTION prevent_mass_delete()',
        tbl, tbl
      );
      RAISE NOTICE 'Mass delete trigger installed on: %', tbl;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping mass delete trigger', tbl;
    END IF;
  END LOOP;
END $$;


-- ============================================
-- PART 3: DATA EXPORT ARCHIVES TABLE
-- Tracks export history for weekly, semester-end,
-- course-end, and manual data exports.
-- ============================================

CREATE TABLE IF NOT EXISTS data_export_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL CHECK (export_type IN ('weekly', 'semester_end', 'course_end', 'manual')),
  label TEXT,
  cohort_id UUID REFERENCES cohorts(id),
  folder_path TEXT NOT NULL,
  files JSONB NOT NULL DEFAULT '[]',
  total_size BIGINT DEFAULT 0,
  total_records INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_data_export_archives_type ON data_export_archives(export_type);
CREATE INDEX IF NOT EXISTS idx_data_export_archives_created ON data_export_archives(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_export_archives_expires ON data_export_archives(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE data_export_archives ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'data_export_archives' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON data_export_archives FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ============================================
-- PART 4: VERIFICATION
-- ============================================

DO $$
DECLARE
  cascade_count INTEGER;
  mass_trigger_count INTEGER;
  row_trigger_count INTEGER;
BEGIN
  -- Count remaining CASCADE FKs across ALL public tables
  SELECT COUNT(*) INTO cascade_count
  FROM information_schema.referential_constraints rc
  JOIN information_schema.table_constraints tc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.constraint_schema
  WHERE rc.delete_rule = 'CASCADE'
    AND tc.table_schema = 'public';

  -- Count mass delete protection triggers
  SELECT COUNT(*) INTO mass_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'prevent_mass_delete_%'
    AND trigger_schema = 'public';

  -- Count row-level delete protection triggers (from Part 1)
  SELECT COUNT(*) INTO row_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'prevent_delete_%'
    AND trigger_name NOT LIKE 'prevent_mass_delete_%'
    AND trigger_schema = 'public';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'FK CASCADE AUDIT PART 2 - VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Remaining CASCADE FKs (all public tables): %', cascade_count;
  RAISE NOTICE 'Mass delete triggers installed: % (expected 15)', mass_trigger_count;
  RAISE NOTICE 'Row-level delete triggers (from Part 1): %', row_trigger_count;
  RAISE NOTICE '========================================';
END $$;

NOTIFY pgrst, 'reload schema';
