-- ============================================================================
-- FK CASCADE AUDIT: Change all ON DELETE CASCADE to ON DELETE RESTRICT
-- on critical parent tables (cohorts, students, lab_days, student_groups,
-- lab_groups, student_internships, summative_evaluations)
--
-- DELETE PROTECTION: Add triggers to prevent DELETE on critical tables
-- unless explicitly called through an admin function.
-- ============================================================================

-- ============================================
-- PART 1: FK CASCADE → RESTRICT
-- 109 constraints across critical parent tables
-- ============================================

-- --- cohorts (19 FKs) ---
ALTER TABLE case_assignments DROP CONSTRAINT IF EXISTS case_assignments_cohort_id_fkey;
ALTER TABLE case_assignments ADD CONSTRAINT case_assignments_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE cohort_key_dates DROP CONSTRAINT IF EXISTS cohort_key_dates_cohort_id_fkey;
ALTER TABLE cohort_key_dates ADD CONSTRAINT cohort_key_dates_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE cohort_milestones DROP CONSTRAINT IF EXISTS cohort_milestones_cohort_id_fkey;
ALTER TABLE cohort_milestones ADD CONSTRAINT cohort_milestones_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE cohort_scenario_completions DROP CONSTRAINT IF EXISTS cohort_scenario_completions_cohort_id_fkey;
ALTER TABLE cohort_scenario_completions ADD CONSTRAINT cohort_scenario_completions_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE cohort_skill_completions DROP CONSTRAINT IF EXISTS cohort_skill_completions_cohort_id_fkey;
ALTER TABLE cohort_skill_completions ADD CONSTRAINT cohort_skill_completions_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE cohort_tasks DROP CONSTRAINT IF EXISTS cohort_tasks_cohort_id_fkey;
ALTER TABLE cohort_tasks ADD CONSTRAINT cohort_tasks_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE field_trips DROP CONSTRAINT IF EXISTS field_trips_cohort_id_fkey;
ALTER TABLE field_trips ADD CONSTRAINT field_trips_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE lab_days DROP CONSTRAINT IF EXISTS lab_days_cohort_id_fkey;
ALTER TABLE lab_days ADD CONSTRAINT lab_days_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE pmi_program_schedules DROP CONSTRAINT IF EXISTS pmi_program_schedules_cohort_id_fkey;
ALTER TABLE pmi_program_schedules ADD CONSTRAINT pmi_program_schedules_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE program_outcomes DROP CONSTRAINT IF EXISTS program_outcomes_cohort_id_fkey;
ALTER TABLE program_outcomes ADD CONSTRAINT program_outcomes_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE scenario_assessments DROP CONSTRAINT IF EXISTS scenario_assessments_cohort_id_fkey;
ALTER TABLE scenario_assessments ADD CONSTRAINT scenario_assessments_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE seating_charts DROP CONSTRAINT IF EXISTS seating_charts_cohort_id_fkey;
ALTER TABLE seating_charts ADD CONSTRAINT seating_charts_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE skill_assessments DROP CONSTRAINT IF EXISTS skill_assessments_cohort_id_fkey;
ALTER TABLE skill_assessments ADD CONSTRAINT skill_assessments_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE student_case_stats DROP CONSTRAINT IF EXISTS student_case_stats_cohort_id_fkey;
ALTER TABLE student_case_stats ADD CONSTRAINT student_case_stats_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE student_groups DROP CONSTRAINT IF EXISTS student_groups_cohort_id_fkey;
ALTER TABLE student_groups ADD CONSTRAINT student_groups_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE student_import_history DROP CONSTRAINT IF EXISTS student_import_history_cohort_id_fkey;
ALTER TABLE student_import_history ADD CONSTRAINT student_import_history_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE summative_evaluations DROP CONSTRAINT IF EXISTS summative_evaluations_cohort_id_fkey;
ALTER TABLE summative_evaluations ADD CONSTRAINT summative_evaluations_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE team_lead_log DROP CONSTRAINT IF EXISTS team_lead_log_cohort_id_fkey;
ALTER TABLE team_lead_log ADD CONSTRAINT team_lead_log_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

ALTER TABLE template_reviews DROP CONSTRAINT IF EXISTS template_reviews_cohort_id_fkey;
ALTER TABLE template_reviews ADD CONSTRAINT template_reviews_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT;

-- --- lab_days (24 FKs) ---
ALTER TABLE guest_access DROP CONSTRAINT IF EXISTS guest_access_lab_day_id_fkey;
ALTER TABLE guest_access ADD CONSTRAINT guest_access_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_attendance DROP CONSTRAINT IF EXISTS lab_day_attendance_lab_day_id_fkey;
ALTER TABLE lab_day_attendance ADD CONSTRAINT lab_day_attendance_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_checklist_items DROP CONSTRAINT IF EXISTS lab_day_checklist_items_lab_day_id_fkey;
ALTER TABLE lab_day_checklist_items ADD CONSTRAINT lab_day_checklist_items_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_checklists DROP CONSTRAINT IF EXISTS lab_day_checklists_lab_day_id_fkey;
ALTER TABLE lab_day_checklists ADD CONSTRAINT lab_day_checklists_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_costs DROP CONSTRAINT IF EXISTS lab_day_costs_lab_day_id_fkey;
ALTER TABLE lab_day_costs ADD CONSTRAINT lab_day_costs_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_debrief_notes DROP CONSTRAINT IF EXISTS lab_day_debrief_notes_lab_day_id_fkey;
ALTER TABLE lab_day_debrief_notes ADD CONSTRAINT lab_day_debrief_notes_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_debriefs DROP CONSTRAINT IF EXISTS lab_day_debriefs_lab_day_id_fkey;
ALTER TABLE lab_day_debriefs ADD CONSTRAINT lab_day_debriefs_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_equipment DROP CONSTRAINT IF EXISTS lab_day_equipment_lab_day_id_fkey;
ALTER TABLE lab_day_equipment ADD CONSTRAINT lab_day_equipment_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_roles DROP CONSTRAINT IF EXISTS lab_day_roles_lab_day_id_fkey;
ALTER TABLE lab_day_roles ADD CONSTRAINT lab_day_roles_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_signups DROP CONSTRAINT IF EXISTS lab_day_signups_lab_day_id_fkey;
ALTER TABLE lab_day_signups ADD CONSTRAINT lab_day_signups_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_equipment_items DROP CONSTRAINT IF EXISTS lab_equipment_items_lab_day_id_fkey;
ALTER TABLE lab_equipment_items ADD CONSTRAINT lab_equipment_items_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_equipment_tracking DROP CONSTRAINT IF EXISTS lab_equipment_tracking_lab_day_id_fkey;
ALTER TABLE lab_equipment_tracking ADD CONSTRAINT lab_equipment_tracking_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_stations DROP CONSTRAINT IF EXISTS lab_stations_lab_day_id_fkey;
ALTER TABLE lab_stations ADD CONSTRAINT lab_stations_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_timer_ready_status DROP CONSTRAINT IF EXISTS lab_timer_ready_status_lab_day_id_fkey;
ALTER TABLE lab_timer_ready_status ADD CONSTRAINT lab_timer_ready_status_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE lab_timer_state DROP CONSTRAINT IF EXISTS lab_timer_state_lab_day_id_fkey;
ALTER TABLE lab_timer_state ADD CONSTRAINT lab_timer_state_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE peer_evaluations DROP CONSTRAINT IF EXISTS peer_evaluations_lab_day_id_fkey;
ALTER TABLE peer_evaluations ADD CONSTRAINT peer_evaluations_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE scenario_assessments DROP CONSTRAINT IF EXISTS scenario_assessments_lab_day_id_fkey;
ALTER TABLE scenario_assessments ADD CONSTRAINT scenario_assessments_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE scenario_participation DROP CONSTRAINT IF EXISTS scenario_participation_lab_day_fkey;
ALTER TABLE scenario_participation ADD CONSTRAINT scenario_participation_lab_day_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE skill_assessments DROP CONSTRAINT IF EXISTS skill_assessments_lab_day_id_fkey;
ALTER TABLE skill_assessments ADD CONSTRAINT skill_assessments_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE student_lab_ratings DROP CONSTRAINT IF EXISTS student_lab_ratings_lab_day_id_fkey;
ALTER TABLE student_lab_ratings ADD CONSTRAINT student_lab_ratings_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE student_lab_signups DROP CONSTRAINT IF EXISTS student_lab_signups_lab_day_id_fkey;
ALTER TABLE student_lab_signups ADD CONSTRAINT student_lab_signups_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE substitute_requests DROP CONSTRAINT IF EXISTS substitute_requests_lab_day_id_fkey;
ALTER TABLE substitute_requests ADD CONSTRAINT substitute_requests_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE team_lead_log DROP CONSTRAINT IF EXISTS team_lead_log_lab_day_id_fkey;
ALTER TABLE team_lead_log ADD CONSTRAINT team_lead_log_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

ALTER TABLE template_review_items DROP CONSTRAINT IF EXISTS template_review_items_lab_day_id_fkey;
ALTER TABLE template_review_items ADD CONSTRAINT template_review_items_lab_day_id_fkey FOREIGN KEY (lab_day_id) REFERENCES lab_days(id) ON DELETE RESTRICT;

-- --- lab_groups (1 FK) ---
ALTER TABLE lab_group_assignment_history DROP CONSTRAINT IF EXISTS lab_group_assignment_history_group_id_fkey;
ALTER TABLE lab_group_assignment_history ADD CONSTRAINT lab_group_assignment_history_group_id_fkey FOREIGN KEY (group_id) REFERENCES lab_groups(id) ON DELETE RESTRICT;

-- --- student_groups (1 FK) ---
ALTER TABLE student_group_assignments DROP CONSTRAINT IF EXISTS student_group_assignments_group_id_fkey;
ALTER TABLE student_group_assignments ADD CONSTRAINT student_group_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE RESTRICT;

-- --- student_internships (7 FKs) ---
ALTER TABLE closeout_documents DROP CONSTRAINT IF EXISTS closeout_documents_internship_id_fkey;
ALTER TABLE closeout_documents ADD CONSTRAINT closeout_documents_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES student_internships(id) ON DELETE RESTRICT;

ALTER TABLE closeout_surveys DROP CONSTRAINT IF EXISTS closeout_surveys_internship_id_fkey;
ALTER TABLE closeout_surveys ADD CONSTRAINT closeout_surveys_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES student_internships(id) ON DELETE RESTRICT;

ALTER TABLE employment_verifications DROP CONSTRAINT IF EXISTS employment_verifications_internship_id_fkey;
ALTER TABLE employment_verifications ADD CONSTRAINT employment_verifications_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES student_internships(id) ON DELETE RESTRICT;

ALTER TABLE internship_meetings DROP CONSTRAINT IF EXISTS internship_meetings_student_internship_id_fkey;
ALTER TABLE internship_meetings ADD CONSTRAINT internship_meetings_student_internship_id_fkey FOREIGN KEY (student_internship_id) REFERENCES student_internships(id) ON DELETE RESTRICT;

ALTER TABLE preceptor_eval_tokens DROP CONSTRAINT IF EXISTS preceptor_eval_tokens_internship_id_fkey;
ALTER TABLE preceptor_eval_tokens ADD CONSTRAINT preceptor_eval_tokens_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES student_internships(id) ON DELETE RESTRICT;

ALTER TABLE preceptor_feedback DROP CONSTRAINT IF EXISTS preceptor_feedback_internship_id_fkey;
ALTER TABLE preceptor_feedback ADD CONSTRAINT preceptor_feedback_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES student_internships(id) ON DELETE RESTRICT;

ALTER TABLE student_preceptor_assignments DROP CONSTRAINT IF EXISTS student_preceptor_assignments_internship_id_fkey;
ALTER TABLE student_preceptor_assignments ADD CONSTRAINT student_preceptor_assignments_internship_id_fkey FOREIGN KEY (internship_id) REFERENCES student_internships(id) ON DELETE RESTRICT;

-- --- students (56 FKs) ---
ALTER TABLE aemt_student_tracking DROP CONSTRAINT IF EXISTS aemt_student_tracking_student_id_fkey;
ALTER TABLE aemt_student_tracking ADD CONSTRAINT aemt_student_tracking_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE attendance_appeals DROP CONSTRAINT IF EXISTS attendance_appeals_student_id_fkey;
ALTER TABLE attendance_appeals ADD CONSTRAINT attendance_appeals_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE case_practice_progress DROP CONSTRAINT IF EXISTS case_practice_progress_student_id_fkey;
ALTER TABLE case_practice_progress ADD CONSTRAINT case_practice_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE case_responses DROP CONSTRAINT IF EXISTS case_responses_student_id_fkey;
ALTER TABLE case_responses ADD CONSTRAINT case_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE clinical_rotations DROP CONSTRAINT IF EXISTS clinical_rotations_student_id_fkey;
ALTER TABLE clinical_rotations ADD CONSTRAINT clinical_rotations_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE clinical_visit_students DROP CONSTRAINT IF EXISTS clinical_visit_students_student_id_fkey;
ALTER TABLE clinical_visit_students ADD CONSTRAINT clinical_visit_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE custody_checkouts DROP CONSTRAINT IF EXISTS custody_checkouts_student_id_fkey;
ALTER TABLE custody_checkouts ADD CONSTRAINT custody_checkouts_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE document_requests DROP CONSTRAINT IF EXISTS document_requests_student_id_fkey;
ALTER TABLE document_requests ADD CONSTRAINT document_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE ekg_warmup_scores DROP CONSTRAINT IF EXISTS ekg_warmup_scores_student_id_fkey;
ALTER TABLE ekg_warmup_scores ADD CONSTRAINT ekg_warmup_scores_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE emt_student_tracking DROP CONSTRAINT IF EXISTS emt_student_tracking_student_id_fkey;
ALTER TABLE emt_student_tracking ADD CONSTRAINT emt_student_tracking_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE field_trip_attendance DROP CONSTRAINT IF EXISTS field_trip_attendance_student_id_fkey;
ALTER TABLE field_trip_attendance ADD CONSTRAINT field_trip_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_attendance DROP CONSTRAINT IF EXISTS lab_day_attendance_student_id_fkey;
ALTER TABLE lab_day_attendance ADD CONSTRAINT lab_day_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lab_day_signups DROP CONSTRAINT IF EXISTS lab_day_signups_student_id_fkey;
ALTER TABLE lab_day_signups ADD CONSTRAINT lab_day_signups_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lab_group_assignment_history DROP CONSTRAINT IF EXISTS lab_group_assignment_history_student_id_fkey;
ALTER TABLE lab_group_assignment_history ADD CONSTRAINT lab_group_assignment_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lab_group_history DROP CONSTRAINT IF EXISTS lab_group_history_student_id_fkey;
ALTER TABLE lab_group_history ADD CONSTRAINT lab_group_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lab_group_members DROP CONSTRAINT IF EXISTS lab_group_members_student_id_fkey;
ALTER TABLE lab_group_members ADD CONSTRAINT lab_group_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE learning_plans DROP CONSTRAINT IF EXISTS learning_plans_student_id_fkey;
ALTER TABLE learning_plans ADD CONSTRAINT learning_plans_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lvfr_aemt_grades DROP CONSTRAINT IF EXISTS lvfr_aemt_grades_student_id_fkey;
ALTER TABLE lvfr_aemt_grades ADD CONSTRAINT lvfr_aemt_grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lvfr_aemt_pharm_checkpoints DROP CONSTRAINT IF EXISTS lvfr_aemt_pharm_checkpoints_student_id_fkey;
ALTER TABLE lvfr_aemt_pharm_checkpoints ADD CONSTRAINT lvfr_aemt_pharm_checkpoints_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lvfr_aemt_skill_attempts DROP CONSTRAINT IF EXISTS lvfr_aemt_skill_attempts_student_id_fkey;
ALTER TABLE lvfr_aemt_skill_attempts ADD CONSTRAINT lvfr_aemt_skill_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE lvfr_aemt_skill_status DROP CONSTRAINT IF EXISTS lvfr_aemt_skill_status_student_id_fkey;
ALTER TABLE lvfr_aemt_skill_status ADD CONSTRAINT lvfr_aemt_skill_status_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE mentorship_pairs DROP CONSTRAINT IF EXISTS mentorship_pairs_mentee_id_fkey;
ALTER TABLE mentorship_pairs ADD CONSTRAINT mentorship_pairs_mentee_id_fkey FOREIGN KEY (mentee_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE mentorship_pairs DROP CONSTRAINT IF EXISTS mentorship_pairs_mentor_id_fkey;
ALTER TABLE mentorship_pairs ADD CONSTRAINT mentorship_pairs_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE peer_evaluations DROP CONSTRAINT IF EXISTS peer_evaluations_evaluated_id_fkey;
ALTER TABLE peer_evaluations ADD CONSTRAINT peer_evaluations_evaluated_id_fkey FOREIGN KEY (evaluated_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE peer_evaluations DROP CONSTRAINT IF EXISTS peer_evaluations_evaluator_id_fkey;
ALTER TABLE peer_evaluations ADD CONSTRAINT peer_evaluations_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE preceptor_eval_tokens DROP CONSTRAINT IF EXISTS preceptor_eval_tokens_student_id_fkey;
ALTER TABLE preceptor_eval_tokens ADD CONSTRAINT preceptor_eval_tokens_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE preceptor_feedback DROP CONSTRAINT IF EXISTS preceptor_feedback_student_id_fkey;
ALTER TABLE preceptor_feedback ADD CONSTRAINT preceptor_feedback_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE protocol_completions DROP CONSTRAINT IF EXISTS protocol_completions_student_id_fkey;
ALTER TABLE protocol_completions ADD CONSTRAINT protocol_completions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE seat_assignments DROP CONSTRAINT IF EXISTS seat_assignments_student_id_fkey;
ALTER TABLE seat_assignments ADD CONSTRAINT seat_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE seating_preferences DROP CONSTRAINT IF EXISTS seating_preferences_other_student_id_fkey;
ALTER TABLE seating_preferences ADD CONSTRAINT seating_preferences_other_student_id_fkey FOREIGN KEY (other_student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE seating_preferences DROP CONSTRAINT IF EXISTS seating_preferences_student_id_fkey;
ALTER TABLE seating_preferences ADD CONSTRAINT seating_preferences_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE skill_assessments DROP CONSTRAINT IF EXISTS skill_assessments_student_id_fkey;
ALTER TABLE skill_assessments ADD CONSTRAINT skill_assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE skill_competencies DROP CONSTRAINT IF EXISTS skill_competencies_student_id_fkey;
ALTER TABLE skill_competencies ADD CONSTRAINT skill_competencies_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE skill_signoffs DROP CONSTRAINT IF EXISTS skill_signoffs_student_id_fkey;
ALTER TABLE skill_signoffs ADD CONSTRAINT skill_signoffs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE station_completions DROP CONSTRAINT IF EXISTS station_completions_student_id_fkey;
ALTER TABLE station_completions ADD CONSTRAINT station_completions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_achievements DROP CONSTRAINT IF EXISTS student_achievements_student_id_fkey;
ALTER TABLE student_achievements ADD CONSTRAINT student_achievements_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_case_stats DROP CONSTRAINT IF EXISTS student_case_stats_student_id_fkey;
ALTER TABLE student_case_stats ADD CONSTRAINT student_case_stats_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_clinical_hours DROP CONSTRAINT IF EXISTS student_clinical_hours_student_id_fkey;
ALTER TABLE student_clinical_hours ADD CONSTRAINT student_clinical_hours_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_communications DROP CONSTRAINT IF EXISTS student_communications_student_id_fkey;
ALTER TABLE student_communications ADD CONSTRAINT student_communications_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_compliance_docs DROP CONSTRAINT IF EXISTS student_compliance_docs_student_id_fkey;
ALTER TABLE student_compliance_docs ADD CONSTRAINT student_compliance_docs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_compliance_records DROP CONSTRAINT IF EXISTS student_compliance_records_student_id_fkey;
ALTER TABLE student_compliance_records ADD CONSTRAINT student_compliance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_documents DROP CONSTRAINT IF EXISTS student_documents_student_id_fkey;
ALTER TABLE student_documents ADD CONSTRAINT student_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_field_rides DROP CONSTRAINT IF EXISTS student_field_rides_student_id_fkey;
ALTER TABLE student_field_rides ADD CONSTRAINT student_field_rides_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_group_assignments DROP CONSTRAINT IF EXISTS student_group_assignments_student_id_fkey;
ALTER TABLE student_group_assignments ADD CONSTRAINT student_group_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_individual_tasks DROP CONSTRAINT IF EXISTS student_individual_tasks_student_id_fkey;
ALTER TABLE student_individual_tasks ADD CONSTRAINT student_individual_tasks_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_internships DROP CONSTRAINT IF EXISTS student_internships_student_id_fkey;
ALTER TABLE student_internships ADD CONSTRAINT student_internships_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_lab_ratings DROP CONSTRAINT IF EXISTS student_lab_ratings_student_id_fkey;
ALTER TABLE student_lab_ratings ADD CONSTRAINT student_lab_ratings_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_lab_signups DROP CONSTRAINT IF EXISTS student_lab_signups_student_id_fkey;
ALTER TABLE student_lab_signups ADD CONSTRAINT student_lab_signups_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_learning_styles DROP CONSTRAINT IF EXISTS student_learning_styles_student_id_fkey;
ALTER TABLE student_learning_styles ADD CONSTRAINT student_learning_styles_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_mce_clearance DROP CONSTRAINT IF EXISTS student_mce_clearance_student_id_fkey;
ALTER TABLE student_mce_clearance ADD CONSTRAINT student_mce_clearance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_mce_modules DROP CONSTRAINT IF EXISTS student_mce_modules_student_id_fkey;
ALTER TABLE student_mce_modules ADD CONSTRAINT student_mce_modules_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_milestones DROP CONSTRAINT IF EXISTS student_milestones_student_id_fkey;
ALTER TABLE student_milestones ADD CONSTRAINT student_milestones_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_notes DROP CONSTRAINT IF EXISTS student_notes_student_id_fkey;
ALTER TABLE student_notes ADD CONSTRAINT student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE student_task_status DROP CONSTRAINT IF EXISTS student_task_status_student_id_fkey;
ALTER TABLE student_task_status ADD CONSTRAINT student_task_status_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE summative_evaluation_scores DROP CONSTRAINT IF EXISTS summative_evaluation_scores_student_id_fkey;
ALTER TABLE summative_evaluation_scores ADD CONSTRAINT summative_evaluation_scores_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

ALTER TABLE team_lead_log DROP CONSTRAINT IF EXISTS team_lead_log_student_id_fkey;
ALTER TABLE team_lead_log ADD CONSTRAINT team_lead_log_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;

-- --- summative_evaluations (1 FK) ---
ALTER TABLE summative_evaluation_scores DROP CONSTRAINT IF EXISTS summative_evaluation_scores_evaluation_id_fkey;
ALTER TABLE summative_evaluation_scores ADD CONSTRAINT summative_evaluation_scores_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES summative_evaluations(id) ON DELETE RESTRICT;


-- ============================================
-- PART 2: DELETE PROTECTION TRIGGERS
-- Prevents DELETE on critical tables unless
-- the session variable 'app.allow_critical_delete'
-- is set to 'true' (only through admin functions).
-- ============================================

CREATE OR REPLACE FUNCTION prevent_critical_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if admin override is set via: SET LOCAL app.allow_critical_delete = 'true';
  IF current_setting('app.allow_critical_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'DELETE on % is blocked. Use the admin deletion API with proper authorization. Table: %, Row ID: %',
    TG_TABLE_NAME, TG_TABLE_NAME, OLD.id;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to each critical table
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
    'summative_evaluations',
    'summative_evaluation_scores',
    'closeout_documents',
    'closeout_surveys'
  ];
BEGIN
  FOREACH tbl IN ARRAY protected_tables
  LOOP
    -- Only create trigger if the table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = tbl AND table_schema = 'public'
    ) THEN
      -- Drop existing trigger if any
      EXECUTE format('DROP TRIGGER IF EXISTS prevent_delete_%s ON %I', tbl, tbl);
      -- Create the trigger
      EXECUTE format(
        'CREATE TRIGGER prevent_delete_%s BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_critical_delete()',
        tbl, tbl
      );
      RAISE NOTICE 'Protected table: %', tbl;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    END IF;
  END LOOP;
END $$;


-- ============================================
-- PART 3: Admin helper function for authorized deletes
-- Usage: SELECT admin_delete('students', 'uuid-here');
-- Must be called by superadmin via service role.
-- ============================================

CREATE OR REPLACE FUNCTION admin_delete(
  target_table TEXT,
  target_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Set the override flag for this transaction only
  SET LOCAL app.allow_critical_delete = 'true';

  -- Execute the delete
  EXECUTE format('DELETE FROM %I WHERE id = $1', target_table) USING target_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restrict admin_delete to service_role only
REVOKE ALL ON FUNCTION admin_delete(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_delete(TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION admin_delete(TEXT, UUID) FROM authenticated;


-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  cascade_count INTEGER;
  trigger_count INTEGER;
BEGIN
  -- Count remaining CASCADE FKs on critical parent tables
  SELECT COUNT(*) INTO cascade_count
  FROM information_schema.referential_constraints rc
  JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON rc.constraint_name = ccu.constraint_name
  WHERE rc.delete_rule = 'CASCADE'
    AND tc.table_schema = 'public'
    AND ccu.table_name IN ('cohorts', 'students', 'lab_days', 'student_groups',
                           'lab_groups', 'student_internships', 'summative_evaluations');

  -- Count delete protection triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'prevent_delete_%'
    AND trigger_schema = 'public';

  RAISE NOTICE 'Remaining CASCADE FKs on critical tables: % (should be 0)', cascade_count;
  RAISE NOTICE 'Delete protection triggers installed: %', trigger_count;
END $$;

NOTIFY pgrst, 'reload schema';
