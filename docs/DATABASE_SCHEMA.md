# PMI EMS Scheduler - Database Schema

> Auto-generated from SQL migration files on 2026-03-04
> Source: `supabase/migrations/` (146 migration files)
> Database: Supabase PostgreSQL

**Note:** The database connection was not reachable from this environment. This schema is reconstructed from the SQL migration files. Core tables (`lab_users`, `students`, `cohorts`, `lab_days`, `lab_stations`, `lab_groups`, `polls`, `submissions`, `scenarios`, `skills`, `departments`, `locations`, `instructor_certifications`, `student_clinical_hours`, `scenario_assessments`) were created in the initial schema and only their ALTER TABLE additions are shown.

---

## Table of Contents

1. [Auth & Users](#auth--users)
2. [Core Data (Initial Schema)](#core-data-initial-schema)
3. [Lab Management](#lab-management)
4. [Scenarios & Assessment](#scenarios--assessment)
5. [Clinical & Internships](#clinical--internships)
6. [Scheduling](#scheduling)
7. [Student Portal](#student-portal)
8. [Onboarding](#onboarding)
9. [Notifications & Communications](#notifications--communications)
10. [Reports & Analytics](#reports--analytics)
11. [Admin & System](#admin--system)
12. [Resources & Documents](#resources--documents)

---

## Auth & Users

### `lab_users`
Core user table (initial schema). Additional columns via migrations:

| Column | Type | Notes |
|--------|------|-------|
| role | CHECK | `superadmin`, `admin`, `lead_instructor`, `instructor`, `volunteer_instructor`, `user`, `guest` |
| totp_secret | TEXT | Two-factor authentication secret |
| totp_enabled | BOOLEAN | DEFAULT false |
| totp_backup_codes | TEXT[] | 2FA recovery codes |
| totp_verified_at | TIMESTAMPTZ | |
| is_part_time | BOOLEAN | DEFAULT false |

### `access_requests`
User access role requests.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | TEXT | NOT NULL |
| name | TEXT | |
| requested_role | TEXT | DEFAULT 'volunteer_instructor' |
| reason | TEXT | |
| status | TEXT | CHECK: pending, approved, denied |
| reviewed_by | TEXT | |
| reviewed_at | TIMESTAMPTZ | |
| denial_reason | TEXT | |
| created_at | TIMESTAMPTZ | |

### `user_endorsements`
Special user endorsements/privileges.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK -> lab_users |
| endorsement_type | TEXT | NOT NULL |
| title | TEXT | |
| department_id | UUID | FK -> departments |
| granted_by | TEXT | |
| granted_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |
| is_active | BOOLEAN | DEFAULT true |

### `user_preferences`
User dashboard and notification preferences.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_email | TEXT | UNIQUE |
| dashboard_widgets | JSONB | Widget list |
| quick_links | JSONB | Quick link list |
| notification_settings | JSONB | Email/push prefs |
| preferences | JSONB | General prefs |
| email_preferences | JSONB | Email delivery prefs |
| tour_completed | BOOLEAN | DEFAULT false |

### `user_sessions`
Active session tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_email | TEXT | NOT NULL |
| session_token | TEXT | UNIQUE |
| device_info | JSONB | |
| ip_address | TEXT | |
| last_active | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |
| is_revoked | BOOLEAN | DEFAULT false |

### `user_activity`
Page visit tracking for analytics.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_email | TEXT | NOT NULL |
| page_path | TEXT | NOT NULL |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ | |

---

## Core Data (Initial Schema)

These tables were created in the initial schema. Only migration-added columns are shown.

### `cohorts`
Student cohorts/classes.

| Column | Type | Notes |
|--------|------|-------|
| semester | TEXT | Added via migration |
| start_date | DATE | |
| end_date | DATE | |
| is_archived | BOOLEAN | DEFAULT false |
| archived_at | TIMESTAMPTZ | |
| archived_by | TEXT | |
| archive_summary | JSONB | |

### `students`
Student records.

| Column | Type | Notes |
|--------|------|-------|
| emergency_contact_name | TEXT | Added via migration |
| emergency_contact_phone | TEXT | |
| emergency_contact_relationship | TEXT | |
| learning_style | TEXT | CHECK: visual, auditory, kinesthetic, reading_writing |
| preferred_contact_method | TEXT | |
| best_contact_times | TEXT[] | |
| language_preference | TEXT | DEFAULT 'en' |
| opt_out_non_essential | BOOLEAN | DEFAULT false |
| phone | TEXT | |
| address | TEXT | |
| student_number | TEXT | |
| enrollment_date | DATE | |

### `lab_days`
Scheduled lab day sessions.

| Column | Type | Notes |
|--------|------|-------|
| semester | INTEGER | Added via migration |
| title | VARCHAR(255) | |
| assigned_timer_id | UUID | FK -> timer_display_tokens |
| needs_coverage | BOOLEAN | DEFAULT false |
| coverage_needed | INTEGER | DEFAULT 0 |
| coverage_note | TEXT | |
| checkin_token | TEXT | UNIQUE |
| checkin_enabled | BOOLEAN | DEFAULT false |
| source_template_id | UUID | FK -> lab_day_templates |

### `lab_stations`
Stations within a lab day.

| Column | Type | Notes |
|--------|------|-------|
| custom_title | VARCHAR(255) | Added via migration |
| skill_sheet_url | TEXT | |
| instructions_url | TEXT | |
| station_notes | TEXT | |
| drill_ids | UUID[] | DEFAULT '{}' |
| metadata | JSONB | DEFAULT '{}' |

### `lab_groups`
Student lab groups within cohorts.

| Column | Type | Notes |
|--------|------|-------|
| is_locked | BOOLEAN | DEFAULT false |
| locked_by | TEXT | |
| locked_at | TIMESTAMPTZ | |

### `polls`
Scheduling polls.

| Column | Type | Notes |
|--------|------|-------|
| available_slots | JSONB | DEFAULT '[]' |

### `submissions`
Poll responses.

| Column | Type | Notes |
|--------|------|-------|
| respondent_role | VARCHAR(50) | Added via migration |

### `scenarios`
EMS training scenarios.

| Column | Type | Notes |
|--------|------|-------|
| instructor_notes | TEXT | Added via migration |
| assessment_a through assessment_x | TEXT | ABCDE assessment fields |
| sample_history | JSONB | SAMPLE history template |
| opqrst | JSONB | OPQRST assessment template |
| gcs | TEXT | Glasgow Coma Scale |
| pupils | TEXT | |
| secondary_survey | JSONB | |
| ekg_findings | JSONB | |
| debrief_points | TEXT[] | |
| legacy_data | JSONB | |

### `scenario_assessments`
Student scenario assessment records.

| Column | Type | Notes |
|--------|------|-------|
| issue_level | TEXT | DEFAULT 'none' |
| flag_categories | TEXT[] | |
| flagged_for_review | BOOLEAN | DEFAULT false |
| flag_resolved | BOOLEAN | DEFAULT false |
| flag_resolution_notes | TEXT | |
| flag_resolved_by | UUID | |
| flag_resolved_at | TIMESTAMPTZ | |

### `skills`
Skills definitions (initial schema table, no migration columns shown).

### `departments`
Academic departments (initial schema table).

### `locations`
Physical locations/rooms.

| Column | Type | Notes |
|--------|------|-------|
| is_lab_room | BOOLEAN | DEFAULT false |

### `instructor_certifications`
Instructor certification records.

| Column | Type | Notes |
|--------|------|-------|
| verification_status | TEXT | DEFAULT 'pending' |
| verified_by | TEXT | |
| verified_at | TIMESTAMPTZ | |
| verification_notes | TEXT | |
| document_url | TEXT | |

### `student_clinical_hours`
Student clinical hour tracking.

| Column | Type | Notes |
|--------|------|-------|
| ems_ridealong_hours | NUMERIC | DEFAULT 0 |

---

## Lab Management

### `lab_day_attendance`
Student attendance for lab days.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | NOT NULL |
| student_id | UUID | NOT NULL |
| status | TEXT | CHECK: present, absent, excused, late |
| notes | TEXT | |
| marked_by | TEXT | NOT NULL |
| marked_at | TIMESTAMPTZ | |
| UNIQUE | | (lab_day_id, student_id) |

### `lab_day_roles`
Instructor role assignments per lab day.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| instructor_id | UUID | FK -> lab_users |
| role | TEXT | CHECK: lab_lead, roamer, observer |
| notes | TEXT | |
| UNIQUE | | (lab_day_id, instructor_id, role) |

### `lab_day_checklist_items`
Pre/post lab checklists.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| title | TEXT | NOT NULL |
| is_completed | BOOLEAN | DEFAULT false |
| completed_by | UUID | FK -> lab_users |
| sort_order | INTEGER | DEFAULT 0 |

### `lab_day_debriefs`
Post-lab debrief entries by instructors.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| instructor_email | TEXT | NOT NULL |
| rating | INTEGER | 1-5 |
| went_well | TEXT | |
| to_improve | TEXT | |
| student_concerns | TEXT | |
| equipment_issues | TEXT | |
| UNIQUE | | (lab_day_id, instructor_email) |

### `lab_day_costs`
Lab day cost tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| category | TEXT | CHECK: equipment, consumables, instructor_pay, external, other |
| description | TEXT | NOT NULL |
| amount | DECIMAL(10,2) | NOT NULL |
| created_by | TEXT | |

### `lab_day_templates`
Reusable lab day templates.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| description | TEXT | |
| template_data | JSONB | NOT NULL |
| is_shared | BOOLEAN | DEFAULT false |
| category | TEXT | orientation, skills_lab, assessment, etc. |
| program | TEXT | |
| semester | INTEGER | |
| week_number | INTEGER | |
| is_anchor | BOOLEAN | DEFAULT false |
| created_by | TEXT | NOT NULL |

### `lab_template_stations`
Stations within a template.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| template_id | UUID | FK -> lab_day_templates |
| station_type | TEXT | NOT NULL |
| station_name | TEXT | |
| skills | JSONB | DEFAULT '[]' |
| scenario_id | UUID | |
| sort_order | INTEGER | DEFAULT 0 |

### `lab_template_versions`
Template version history.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| template_id | UUID | FK -> lab_day_templates |
| version_number | INTEGER | |
| snapshot | JSONB | NOT NULL |
| change_summary | TEXT | |
| created_by | TEXT | NOT NULL |
| UNIQUE | | (template_id, version_number) |

### `lab_timer_state`
Lab rotation timer state.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days, UNIQUE |
| rotation_number | INTEGER | DEFAULT 1 |
| status | TEXT | CHECK: running, paused, stopped |
| duration_seconds | INTEGER | NOT NULL |
| debrief_seconds | INTEGER | DEFAULT 300 |
| mode | TEXT | CHECK: countdown, countup |

### `lab_timer_ready_status`
Station ready status for timer coordination.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| station_id | UUID | FK -> lab_stations |
| user_email | TEXT | NOT NULL |
| is_ready | BOOLEAN | DEFAULT false |

### `timer_display_tokens`
Authentication tokens for timer display screens.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| token | TEXT | UNIQUE |
| room_name | TEXT | NOT NULL |
| lab_room_id | UUID | FK -> locations |
| timer_type | TEXT | CHECK: fixed, mobile |
| is_active | BOOLEAN | DEFAULT true |

### `station_pool`
Reusable station definitions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| station_code | TEXT | UNIQUE |
| station_name | TEXT | NOT NULL |
| category | TEXT | CHECK: cardiology, trauma, airway, etc. |
| semester | INTEGER | DEFAULT 3 |
| cohort_id | UUID | FK -> cohorts |
| is_active | BOOLEAN | DEFAULT true |

### `station_completions`
Student station completion records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| station_id | UUID | FK -> station_pool |
| result | TEXT | CHECK: pass, needs_review, incomplete |
| lab_day_id | UUID | FK -> lab_days |
| logged_by | UUID | FK -> lab_users |

### `station_instructors`
Instructors assigned to lab stations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| station_id | UUID | FK -> lab_stations |
| user_id | UUID | FK -> lab_users |
| user_email | TEXT | NOT NULL |
| is_primary | BOOLEAN | DEFAULT false |

### `station_skills`
Skills linked to stations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| station_id | UUID | FK -> lab_stations |
| skill_id | UUID | FK -> skills |
| display_order | INTEGER | DEFAULT 0 |

### `custom_skills`
Custom skills added to individual stations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| station_id | UUID | FK -> lab_stations |
| name | TEXT | NOT NULL |
| notes | TEXT | |

### `lab_group_assignment_history`
History of student group changes.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| group_id | UUID | FK -> lab_groups |
| student_id | UUID | FK -> students |
| action | TEXT | CHECK: added, removed, moved |
| from_group_id | UUID | |
| to_group_id | UUID | |
| changed_by | TEXT | |

### `lab_equipment_items`
Equipment tracked per lab day.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| name | TEXT | NOT NULL |
| quantity | INTEGER | DEFAULT 1 |
| status | TEXT | CHECK: checked_out, returned, damaged, missing |
| station_id | UUID | FK -> lab_stations |

### `ekg_warmup_scores`
EKG rhythm identification warmup scores.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| score | INTEGER | NOT NULL |
| max_score | INTEGER | DEFAULT 10 |
| is_baseline | BOOLEAN | DEFAULT false |
| missed_rhythms | TEXT[] | |
| date | DATE | NOT NULL |

### `protocol_completions`
Student protocol case completions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| protocol_category | TEXT | CHECK: cardiac, respiratory, trauma, etc. |
| case_count | INTEGER | DEFAULT 1 |
| logged_by | UUID | FK -> lab_users |

### `field_trips`
Lab field trip events.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| cohort_id | UUID | FK -> cohorts |
| name | TEXT | NOT NULL |
| trip_date | DATE | NOT NULL |
| location | TEXT | |

### `field_trip_attendance`
Field trip attendance records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| field_trip_id | UUID | FK -> field_trips |
| student_id | UUID | FK -> students |
| attended | BOOLEAN | DEFAULT false |
| UNIQUE | | (field_trip_id, student_id) |

---

## Scenarios & Assessment

### `scenario_versions`
Scenario edit history.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| scenario_id | UUID | FK -> scenarios |
| version_number | INTEGER | NOT NULL |
| data | JSONB | NOT NULL |
| change_summary | TEXT | |
| created_by | TEXT | |

### `scenario_tags`
Tags for scenario categorization.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| scenario_id | UUID | FK -> scenarios |
| tag | TEXT | NOT NULL |

### `scenario_ratings`
Instructor ratings of scenarios.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| scenario_id | UUID | FK -> scenarios |
| user_email | TEXT | NOT NULL |
| rating | INTEGER | 1-5 |
| comment | TEXT | |
| UNIQUE | | (scenario_id, user_email) |

### `scenario_favorites`
User scenario bookmarks.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_email | TEXT | NOT NULL |
| scenario_id | UUID | NOT NULL |
| UNIQUE | | (user_email, scenario_id) |

### `scenario_participation`
Student scenario participation records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| scenario_id | UUID | FK -> scenarios |
| scenario_name | TEXT | Denormalized |
| role | TEXT | CHECK: team_lead, med_tech, monitor_tech, airway_tech, observer |
| lab_day_id | UUID | FK -> lab_days |
| date | DATE | |
| logged_by | UUID | FK -> lab_users |

### `assessment_rubrics`
Rubric definitions for assessments.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| description | TEXT | |
| rating_scale | TEXT | CHECK: numeric_5, pass_fail, qualitative_4 |
| is_active | BOOLEAN | DEFAULT true |
| created_by | TEXT | |

### `rubric_criteria`
Individual criteria within a rubric.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| rubric_id | UUID | FK -> assessment_rubrics |
| name | TEXT | NOT NULL |
| description | TEXT | |
| points | INTEGER | DEFAULT 1 |
| sort_order | INTEGER | |

### `rubric_scenario_assignments`
Rubric-to-scenario mappings.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| rubric_id | UUID | FK -> assessment_rubrics |
| scenario_id | UUID | FK -> scenarios |
| UNIQUE | | (rubric_id, scenario_id) |

### `summative_scenarios`
Summative evaluation scenario definitions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| scenario_number | INTEGER | NOT NULL |
| title | TEXT | NOT NULL |
| patient_presentation | TEXT | |
| expected_interventions | TEXT[] | |
| linked_scenario_id | UUID | FK -> scenarios |
| is_active | BOOLEAN | DEFAULT true |

### `summative_evaluations`
Summative evaluation sessions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| scenario_id | UUID | FK -> summative_scenarios |
| cohort_id | UUID | FK -> cohorts |
| evaluation_date | DATE | NOT NULL |
| examiner_name | TEXT | NOT NULL |
| examiner_email | TEXT | |
| status | TEXT | CHECK: in_progress, completed, cancelled |

### `summative_evaluation_scores`
Individual student scores on summative evaluations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| evaluation_id | UUID | FK -> summative_evaluations |
| student_id | UUID | FK -> students |
| leadership_scene_score | INTEGER | 0-3 |
| patient_assessment_score | INTEGER | 0-3 |
| patient_management_score | INTEGER | 0-3 |
| interpersonal_score | INTEGER | 0-3 |
| integration_score | INTEGER | 0-3 |
| total_score | INTEGER | GENERATED (stored) |
| critical_criteria_failed | BOOLEAN | DEFAULT false |
| passed | BOOLEAN | nullable |
| grading_complete | BOOLEAN | DEFAULT false |
| UNIQUE | | (evaluation_id, student_id) |

### `peer_evaluations`
Student peer evaluations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| evaluator_id | UUID | FK -> students |
| evaluated_id | UUID | FK -> students |
| communication_score | INTEGER | 1-5 |
| teamwork_score | INTEGER | 1-5 |
| leadership_score | INTEGER | 1-5 |
| is_self_eval | BOOLEAN | DEFAULT false |
| comments | TEXT | |

---

## Skills & Competencies

### `canonical_skills`
Master skill definitions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| canonical_name | TEXT | UNIQUE |
| skill_category | TEXT | CHECK: airway, vascular_access, medication, etc. |
| programs | TEXT[] | NOT NULL |
| paramedic_only | BOOLEAN | DEFAULT false |

### `skill_competencies`
Student skill competency levels.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| skill_id | UUID | FK -> skills |
| level | TEXT | CHECK: introduced, practiced, competent, proficient |
| demonstrations | INTEGER | DEFAULT 0 |
| UNIQUE | | (student_id, skill_id) |

### `skill_signoffs`
Instructor sign-offs on student skills.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| skill_id | UUID | FK -> skills |
| lab_day_id | UUID | FK -> lab_days |
| signed_off_by | TEXT | NOT NULL |
| revoked_by | TEXT | nullable |
| UNIQUE | | (student_id, skill_id) |

### `skill_documents`
Documents attached to skills.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| skill_id | UUID | FK -> skills |
| document_name | TEXT | NOT NULL |
| document_url | TEXT | NOT NULL |
| document_type | TEXT | CHECK: skill_sheet, checkoff, reference, protocol |
| drill_id | UUID | FK -> skill_drills |

### `skill_drills`
Skill drill exercise definitions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| description | TEXT | |
| category | TEXT | DEFAULT 'general' |
| estimated_duration | INTEGER | DEFAULT 15 (minutes) |
| equipment_needed | TEXT[] | |
| instructions | TEXT | |
| drill_data | JSONB | DEFAULT '{}' |
| is_active | BOOLEAN | DEFAULT true |

### `skill_sheets`
Step-by-step skill sheet definitions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| canonical_skill_id | UUID | FK -> canonical_skills |
| skill_name | TEXT | NOT NULL |
| program | TEXT | CHECK: emt, aemt, paramedic, aemt_paramedic, all |
| source | TEXT | CHECK: nremt, platinum, publisher, internal |
| equipment | JSONB | |
| overview | TEXT | |
| critical_criteria | JSONB | |
| critical_failures | JSONB | |

### `skill_sheet_steps`
Individual steps within a skill sheet.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| skill_sheet_id | UUID | FK -> skill_sheets |
| step_number | INTEGER | NOT NULL |
| phase | TEXT | CHECK: preparation, procedure, assessment, packaging |
| instruction | TEXT | NOT NULL |
| is_critical | BOOLEAN | DEFAULT false |

### `skill_sheet_assignments`
Skill sheets linked to skill names.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| skill_sheet_id | UUID | FK -> skill_sheets |
| skill_name | TEXT | NOT NULL |
| program | TEXT | |

### `student_skill_evaluations`
Student evaluations on skill sheets.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| skill_sheet_id | UUID | FK -> skill_sheets |
| lab_day_id | UUID | FK -> lab_days |
| evaluation_type | TEXT | CHECK: formative, final_competency |
| result | TEXT | CHECK: pass, fail, remediation |
| evaluator_id | UUID | FK -> lab_users |
| flagged_items | JSONB | |

---

## Clinical & Internships

### `clinical_sites`
Hospital clinical sites.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| abbreviation | TEXT | NOT NULL |
| system | TEXT | e.g., 'Valley Health System' |
| max_students_per_day | INTEGER | DEFAULT 2 |
| max_students_per_rotation | INTEGER | |

### `clinical_site_departments`
Departments within clinical sites.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| site_id | UUID | FK -> clinical_sites |
| department | TEXT | NOT NULL |
| UNIQUE | | (site_id, department) |

### `clinical_site_schedules`
Clinical site scheduling windows.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| clinical_site_id | UUID | FK -> clinical_sites |
| institution | TEXT | DEFAULT 'PMI' |
| days_of_week | TEXT[] | NOT NULL |
| start_date | DATE | NOT NULL |
| end_date | DATE | |

### `clinical_site_visits`
Instructor site visit records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| site_id | UUID | FK -> clinical_sites |
| agency_id | UUID | FK -> agencies |
| departments | TEXT[] | |
| visitor_name | TEXT | NOT NULL |
| visit_date | DATE | NOT NULL |
| cohort_id | UUID | FK -> cohorts |
| entire_class | BOOLEAN | DEFAULT false |

### `clinical_visit_students`
Students present at site visits.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| visit_id | UUID | FK -> clinical_site_visits |
| student_id | UUID | FK -> students |
| UNIQUE | | (visit_id, student_id) |

### `clinical_rotations`
Student clinical rotation assignments.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| site_id | UUID | FK -> clinical_sites |
| rotation_date | DATE | NOT NULL |
| shift_type | TEXT | DEFAULT 'day' |
| status | TEXT | DEFAULT 'scheduled' |
| UNIQUE | | (student_id, rotation_date) |

### `agencies`
EMS agencies for field internships.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| abbreviation | TEXT | |
| type | TEXT | NOT NULL: ems, hospital |
| max_students_per_day | INTEGER | DEFAULT 2 |
| max_students_per_rotation | INTEGER | |

### `agency_contacts`
Agency contact persons.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| agency_id | UUID | FK -> agencies |
| name | TEXT | NOT NULL |
| title | TEXT | |
| email | TEXT | |
| phone | TEXT | |
| is_primary | BOOLEAN | DEFAULT false |

### `field_preceptors`
Field internship preceptors.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| first_name | TEXT | NOT NULL |
| last_name | TEXT | NOT NULL |
| agency_id | UUID | FK -> agencies |
| station | TEXT | |
| snhd_trained_date | DATE | |
| snhd_cert_expires | DATE | |
| max_students | INTEGER | DEFAULT 1 |
| is_active | BOOLEAN | DEFAULT true |

### `student_internships`
Student field internship placements.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| cohort_id | UUID | FK -> cohorts |
| preceptor_id | UUID | FK -> field_preceptors |
| agency_id | UUID | FK -> agencies |
| shift_type | TEXT | DEFAULT '12_hour' |
| current_phase | TEXT | DEFAULT 'pre_internship' |
| status | TEXT | DEFAULT 'not_started' |
| *Phase tracking* | various | phase_1/phase_2 dates, evals, meetings |
| *NREMT clearance* | various | exam dates, pass status, SNHD submission |
| *Extension tracking* | various | is_extended, reason, dates |
| *Closeout* | various | closeout meeting, completion dates |

### `student_preceptor_assignments`
Multi-preceptor assignment tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| internship_id | UUID | FK -> student_internships |
| preceptor_id | UUID | FK -> field_preceptors |
| role | TEXT | DEFAULT 'primary' |
| is_active | BOOLEAN | DEFAULT true |
| UNIQUE | | (internship_id, preceptor_id, role) |

### `internship_meetings`
Internship meeting scheduling.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_internship_id | UUID | FK -> student_internships |
| meeting_type | TEXT | NOT NULL |
| status | TEXT | DEFAULT 'scheduled' |
| action_items | TEXT[] | |
| follow_up_needed | BOOLEAN | DEFAULT false |

### `preceptor_eval_tokens`
Tokens for external preceptor evaluation forms.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| internship_id | UUID | FK -> student_internships |
| student_id | UUID | FK -> students |
| preceptor_email | TEXT | NOT NULL |
| token | TEXT | UNIQUE |
| status | TEXT | CHECK: active, submitted, expired |
| expires_at | TIMESTAMPTZ | NOT NULL |

### `preceptor_feedback`
Preceptor feedback on students.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| preceptor_name | TEXT | NOT NULL |
| clinical_skills_rating | INTEGER | 1-5 |
| professionalism_rating | INTEGER | 1-5 |
| communication_rating | INTEGER | 1-5 |
| overall_rating | INTEGER | 1-5 |
| is_flagged | BOOLEAN | DEFAULT false |

### `closeout_surveys`
Internship closeout survey responses.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| internship_id | UUID | FK -> student_internships |
| survey_type | TEXT | CHECK: hospital_preceptor, field_preceptor |
| responses | JSONB | NOT NULL |

### `closeout_documents`
Internship closeout documents.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| internship_id | UUID | FK -> student_internships |
| doc_type | TEXT | NOT NULL |
| file_url | TEXT | |

### `employment_verifications`
Post-graduation employment verification forms.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| internship_id | UUID | FK -> student_internships |
| student_name | TEXT | |
| company_name | TEXT | |
| employment_status | TEXT | CHECK: pt, ft |
| is_draft | BOOLEAN | DEFAULT true |

### `emt_student_tracking`
EMT student milestone tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students, UNIQUE |
| mce_complete | BOOLEAN | DEFAULT false |
| vax_complete | BOOLEAN | DEFAULT false |
| ride_along_complete | BOOLEAN | DEFAULT false |
| vitals_complete | BOOLEAN | DEFAULT false |

### `aemt_student_tracking`
AEMT student milestone tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students, UNIQUE |
| mce_complete | BOOLEAN | DEFAULT false |
| vax_complete | BOOLEAN | DEFAULT false |
| ride_along_complete | BOOLEAN | DEFAULT false |
| clinical_1_complete through clinical_3_complete | BOOLEAN | DEFAULT false |
| vitals_complete | BOOLEAN | DEFAULT false |

---

## Scheduling

### `open_shifts`
Open shifts available for sign-up.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| date | DATE | NOT NULL |
| start_time | TIME | NOT NULL |
| end_time | TIME | NOT NULL |
| location | TEXT | |
| department | TEXT | EMT, Paramedic, AEMT, General |
| min_instructors | INTEGER | DEFAULT 1 |
| max_instructors | INTEGER | |
| is_filled | BOOLEAN | DEFAULT false |
| lab_day_id | UUID | FK -> lab_days |

### `shift_signups`
Instructor shift sign-ups.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| shift_id | UUID | FK -> open_shifts |
| instructor_id | UUID | FK -> lab_users |
| is_partial | BOOLEAN | DEFAULT false |
| status | TEXT | CHECK: pending, confirmed, declined, withdrawn |
| UNIQUE | | (shift_id, instructor_id) |

### `shift_trade_requests`
Shift trade/swap requests.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| requester_id | UUID | FK -> lab_users |
| requester_shift_id | UUID | FK -> open_shifts |
| target_shift_id | UUID | FK -> open_shifts |
| status | TEXT | CHECK: pending, accepted, declined, approved, cancelled |

### `shift_swap_interest`
Interest in shift swap requests.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| swap_request_id | UUID | FK -> shift_trade_requests |
| interested_by | TEXT | NOT NULL |
| status | TEXT | CHECK: interested, selected, declined |

### `substitute_requests`
Substitute coverage requests.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| requester_email | TEXT | NOT NULL |
| reason | TEXT | NOT NULL |
| status | TEXT | CHECK: pending, approved, denied, covered |
| covered_by | TEXT | |

### `instructor_availability`
Instructor availability windows.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| instructor_id | UUID | FK -> lab_users |
| date | DATE | NOT NULL |
| start_time | TIME | |
| end_time | TIME | |
| is_all_day | BOOLEAN | DEFAULT false |
| UNIQUE | | (instructor_id, date, start_time) |

### `team_availability_views`
Saved team availability view configurations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| instructor_emails | TEXT[] | NOT NULL |
| created_by | TEXT | NOT NULL |

### `bookable_resources`
Resources available for booking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| type | TEXT | CHECK: room, equipment, sim_lab, other |
| capacity | INTEGER | |
| requires_approval | BOOLEAN | DEFAULT false |

### `resource_bookings`
Resource booking records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| resource_id | UUID | FK -> bookable_resources |
| booked_by | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| start_time | TIMESTAMPTZ | NOT NULL |
| end_time | TIMESTAMPTZ | NOT NULL |
| status | TEXT | CHECK: pending, confirmed, cancelled |
| is_recurring | BOOLEAN | DEFAULT false |

### `instructor_time_entries`
Instructor time clock entries.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| instructor_email | TEXT | NOT NULL |
| clock_in | TIMESTAMPTZ | NOT NULL |
| clock_out | TIMESTAMPTZ | |
| hours_worked | DECIMAL(5,2) | |
| lab_day_id | UUID | FK -> lab_days |
| status | TEXT | CHECK: pending, approved, rejected |

---

## Student Portal

### `student_lab_signups`
Student lab session sign-ups.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| student_id | UUID | FK -> students |
| status | TEXT | CHECK: confirmed, waitlisted, cancelled |
| waitlist_position | INTEGER | |
| UNIQUE | | (lab_day_id, student_id) |

### `student_lab_ratings`
Student ratings of lab day experience.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| lab_day_id | UUID | FK -> lab_days |
| student_id | UUID | FK -> students |
| instructor_email | TEXT | NOT NULL |
| rating | INTEGER | 1-5 |
| note | TEXT | |

### `student_documents`
Student uploaded documents.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| document_type | TEXT | CHECK: certificate, transcript, compliance, etc. |
| name | TEXT | NOT NULL |
| file_url | TEXT | |
| status | TEXT | CHECK: pending, approved, rejected, expired |

### `student_notes`
Instructor notes about students.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| author_id | UUID | FK -> lab_users |
| content | TEXT | NOT NULL |
| category | TEXT | CHECK: academic, behavioral, medical, other |
| is_flagged | BOOLEAN | DEFAULT false |
| flag_level | TEXT | CHECK: yellow, red |

### `student_communications`
Communication log with students.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| type | TEXT | CHECK: phone, email, meeting, text, other |
| summary | TEXT | NOT NULL |
| flagged | BOOLEAN | DEFAULT false |
| follow_up_needed | BOOLEAN | DEFAULT false |

### `student_compliance_docs`
Student compliance document tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| doc_type | TEXT | NOT NULL |
| completed | BOOLEAN | DEFAULT false |
| expiration_date | DATE | |
| UNIQUE | | (student_id, doc_type) |

### `student_compliance_records`
Detailed compliance record tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| doc_type_id | UUID | FK -> compliance_document_types |
| status | TEXT | CHECK: complete, missing, expiring, expired |
| file_path | TEXT | |
| verified_by | TEXT | |
| UNIQUE | | (student_id, doc_type_id) |

### `compliance_document_types`
Types of compliance documents.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| is_required | BOOLEAN | DEFAULT true |
| expiration_months | INTEGER | |
| sort_order | INTEGER | DEFAULT 0 |

### `attendance_appeals`
Student attendance appeal submissions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| absence_date | DATE | NOT NULL |
| reason | TEXT | NOT NULL |
| documentation_url | TEXT | |
| status | TEXT | CHECK: pending, approved, denied |

### `document_requests`
Document requests to students.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| document_type | TEXT | NOT NULL |
| due_date | DATE | |
| status | TEXT | CHECK: pending, submitted, completed |

### `learning_plans`
Individualized learning plans.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| goals | TEXT | |
| accommodations | JSONB | DEFAULT '[]' |
| review_date | DATE | |
| is_active | BOOLEAN | DEFAULT true |

### `learning_plan_notes`
Notes within learning plans.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| plan_id | UUID | FK -> learning_plans |
| note | TEXT | NOT NULL |
| created_by | TEXT | |

### `mentorship_pairs`
Student mentorship pairings.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| mentor_id | UUID | FK -> students |
| mentee_id | UUID | FK -> students |
| status | TEXT | CHECK: active, completed, paused |
| goals | TEXT | |

### `mentorship_logs`
Mentorship interaction logs.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| pair_id | UUID | FK -> mentorship_pairs |
| log_date | DATE | |
| notes | TEXT | NOT NULL |

### `student_import_history`
Bulk student import records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| cohort_id | UUID | FK -> cohorts |
| imported_count | INTEGER | |
| skipped_count | INTEGER | |
| import_mode | TEXT | |

---

## Onboarding

### `onboarding_templates`
Onboarding workflow templates.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| instructor_type | TEXT | CHECK: full_time, part_time, lab_only, adjunct, all |
| is_active | BOOLEAN | DEFAULT true |

### `onboarding_phases`
Phases within an onboarding template.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| template_id | UUID | FK -> onboarding_templates |
| name | TEXT | NOT NULL |
| sort_order | INTEGER | |
| target_days_start | INTEGER | DEFAULT 0 |
| target_days_end | INTEGER | DEFAULT 7 |

### `onboarding_tasks`
Individual onboarding tasks.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| phase_id | UUID | FK -> onboarding_phases |
| title | TEXT | NOT NULL |
| task_type | TEXT | CHECK: checklist, document, video, form, observation, sign_off |
| is_required | BOOLEAN | DEFAULT true |
| requires_sign_off | BOOLEAN | DEFAULT false |
| lane | TEXT | CHECK: institutional, operational, clinical |

### `onboarding_assignments`
Onboarding template assignments to instructors.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| template_id | UUID | FK -> onboarding_templates |
| instructor_email | TEXT | NOT NULL |
| mentor_email | TEXT | |
| status | TEXT | CHECK: active, paused, completed, cancelled |

### `onboarding_task_progress`
Progress tracking per task per assignment.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| assignment_id | UUID | FK -> onboarding_assignments |
| task_id | UUID | FK -> onboarding_tasks |
| status | TEXT | CHECK: pending, in_progress, completed, blocked, waived |
| UNIQUE | | (assignment_id, task_id) |

### `onboarding_task_dependencies`
Task dependency rules.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| task_id | UUID | FK -> onboarding_tasks |
| depends_on_task_id | UUID | FK -> onboarding_tasks |
| gate_type | TEXT | CHECK: hard, soft |

### `onboarding_evidence`
Evidence files for task completion.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| task_progress_id | UUID | FK -> onboarding_task_progress |
| file_name | TEXT | NOT NULL |
| storage_path | TEXT | NOT NULL |

### `onboarding_event_log`
Onboarding event audit trail.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| assignment_id | UUID | FK -> onboarding_assignments |
| event_type | TEXT | NOT NULL |
| triggered_by | TEXT | NOT NULL |

---

## Notifications & Communications

### `user_notifications`
In-app notification records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_email | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| message | TEXT | NOT NULL |
| type | TEXT | CHECK: lab_assignment, lab_reminder, feedback_new, etc. |
| link_url | TEXT | |
| is_read | BOOLEAN | DEFAULT false |
| category | TEXT | DEFAULT 'system' |
| is_archived | BOOLEAN | DEFAULT false |

### `notifications_log`
External notification delivery log.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| type | TEXT | CHECK: calendar_invite, email |
| recipient_email | TEXT | NOT NULL |
| subject | TEXT | |
| status | TEXT | CHECK: sent, failed, pending |
| poll_id | UUID | FK -> polls |

### `announcements`
System-wide announcements.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| body | TEXT | NOT NULL |
| priority | TEXT | CHECK: info, warning, critical |
| target_audience | TEXT | CHECK: all, instructors, students |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | |
| is_active | BOOLEAN | DEFAULT true |

### `announcement_reads`
Announcement read tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| announcement_id | UUID | FK -> announcements |
| user_email | TEXT | |
| UNIQUE | | (announcement_id, user_email) |

### `broadcast_history`
Broadcast notification history.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| message | TEXT | NOT NULL |
| audience_type | TEXT | NOT NULL |
| audience_filter | JSONB | |
| recipient_count | INTEGER | |
| delivery_method | TEXT | NOT NULL |

### `email_log`
Email delivery log.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| to_email | TEXT | NOT NULL |
| subject | TEXT | NOT NULL |
| template | TEXT | NOT NULL |
| status | TEXT | sent, failed |
| resend_id | TEXT | Resend API ID |

### `email_queue`
Queued emails for batch processing.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| to_email | TEXT | NOT NULL |
| template | TEXT | NOT NULL |
| template_data | JSONB | |
| status | TEXT | CHECK: pending, processing, sent, failed |
| attempts | INTEGER | DEFAULT 0 |

### `email_templates`
Email template definitions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| subject | TEXT | NOT NULL |
| body | TEXT | NOT NULL |
| category | TEXT | |
| is_active | BOOLEAN | DEFAULT true |

### `email_template_customizations`
Overrides for email templates.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| template_key | TEXT | UNIQUE |
| subject | TEXT | |
| body_html | TEXT | |
| is_active | BOOLEAN | DEFAULT true |

---

## Reports & Analytics

### `report_templates`
Saved custom report definitions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| data_source | TEXT | NOT NULL |
| columns | TEXT[] | NOT NULL |
| filters | JSONB | DEFAULT '[]' |
| is_shared | BOOLEAN | DEFAULT false |
| created_by | TEXT | |

### `scheduled_exports`
Recurring automated export configurations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| report_type | TEXT | CHECK: cohort_progress, clinical_hours, etc. |
| schedule | TEXT | CHECK: weekly, monthly |
| recipients | TEXT[] | |
| is_active | BOOLEAN | DEFAULT true |

### `data_export_history`
Export execution history.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| export_type | TEXT | NOT NULL |
| format | TEXT | NOT NULL |
| row_count | INTEGER | |
| file_size | INTEGER | |
| exported_by | TEXT | NOT NULL |

### `program_outcomes`
Program-level outcome metrics.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| cohort_id | UUID | FK -> cohorts |
| year | INTEGER | NOT NULL |
| graduation_rate | DECIMAL(5,2) | |
| cert_pass_rate | DECIMAL(5,2) | |
| job_placement_rate | DECIMAL(5,2) | |
| employer_satisfaction | DECIMAL(5,2) | |

### `program_requirements`
Program clinical/skills requirements.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| program | TEXT | CHECK: paramedic, aemt, emt |
| requirement_type | TEXT | CHECK: clinical_hours, skills, scenarios |
| required_value | INTEGER | DEFAULT 0 |
| version | INTEGER | DEFAULT 1 |

---

## Admin & System

### `audit_log`
System audit trail.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK -> lab_users |
| user_email | TEXT | |
| action | TEXT | view, create, update, delete, export, login, etc. |
| resource_type | TEXT | NOT NULL |
| resource_id | UUID | |
| ip_address | TEXT | |
| metadata | JSONB | |

### `system_config`
System configuration key-value store.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| key | TEXT | UNIQUE |
| value | JSONB | NOT NULL |
| category | TEXT | |
| description | TEXT | |

### `system_alerts`
System health and monitoring alerts.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| alert_type | TEXT | NOT NULL |
| severity | TEXT | CHECK: critical, warning, info |
| title | TEXT | NOT NULL |
| message | TEXT | |
| is_resolved | BOOLEAN | DEFAULT false |

### `error_logs`
Client-side error tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_email | TEXT | |
| error_message | TEXT | NOT NULL |
| error_stack | TEXT | |
| page_url | TEXT | |
| component_name | TEXT | |
| metadata | JSONB | |

### `bulk_operations_history`
Bulk operation audit records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| operation_type | TEXT | NOT NULL |
| target_table | TEXT | NOT NULL |
| affected_count | INTEGER | |
| rollback_data | JSONB | |
| is_dry_run | BOOLEAN | DEFAULT false |

### `feedback_reports`
User feedback and bug reports.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| report_type | TEXT | DEFAULT 'bug': bug, feature, other |
| description | TEXT | NOT NULL |
| page_url | TEXT | |
| user_email | TEXT | |
| status | TEXT | new, in_progress, resolved, wont_fix |
| priority | TEXT | DEFAULT 'medium' |
| screenshot_url | TEXT | |

### `incidents`
Safety/behavioral incident reports.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| incident_date | DATE | NOT NULL |
| location | TEXT | NOT NULL |
| severity | TEXT | CHECK: minor, moderate, major, critical |
| description | TEXT | NOT NULL |
| status | TEXT | CHECK: open, investigating, resolved, closed |

### `alumni`
Graduate alumni tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| student_id | UUID | FK -> students |
| first_name | TEXT | NOT NULL |
| last_name | TEXT | NOT NULL |
| graduation_date | DATE | |
| cohort_id | UUID | FK -> cohorts |
| employment_status | TEXT | CHECK: employed, seeking, continuing_education, unknown |
| employer | TEXT | |
| job_title | TEXT | |

### `webhooks`
Integration webhook configurations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| url | TEXT | NOT NULL |
| events | TEXT[] | NOT NULL |
| secret | TEXT | |
| is_active | BOOLEAN | DEFAULT true |

### `webhook_deliveries`
Webhook delivery log.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| webhook_id | UUID | FK -> webhooks |
| event_type | TEXT | NOT NULL |
| payload | JSONB | |
| response_status | INTEGER | |
| success | BOOLEAN | |

### `app_deep_links`
Mobile/app deep link configurations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| route_pattern | TEXT | NOT NULL |
| app_scheme | TEXT | DEFAULT 'pmi' |
| is_active | BOOLEAN | DEFAULT true |

### `dashboard_layouts`
Per-user dashboard layout settings.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_email | TEXT | UNIQUE |
| layout | JSONB | DEFAULT '[]' |

### `dashboard_layout_defaults`
Default dashboard layouts per role.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| role | TEXT | UNIQUE |
| layout | JSONB | DEFAULT '[]' |

---

## Resources & Documents

### `resources`
Document and resource library.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| category | TEXT | CHECK: protocols, skill_sheets, policies, forms, other |
| resource_type | TEXT | CHECK: file, link |
| url | TEXT | |
| file_path | TEXT | |
| version | INTEGER | DEFAULT 1 |
| min_role | TEXT | DEFAULT 'instructor' |
| linked_skill_ids | TEXT[] | |
| linked_scenario_ids | TEXT[] | |

### `resource_versions`
Resource version history.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| resource_id | UUID | FK -> resources |
| version | INTEGER | |
| file_path | TEXT | |
| uploaded_by | TEXT | NOT NULL |

### `medications`
Medication reference database.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| generic_name | TEXT | |
| drug_class | TEXT | |
| indications | TEXT | |
| contraindications | TEXT | |
| dosing | JSONB | DEFAULT '{}' |
| routes | TEXT[] | |
| is_active | BOOLEAN | DEFAULT true |

### `equipment`
Lab equipment inventory.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| category | TEXT | |
| quantity | INTEGER | DEFAULT 1 |
| available_quantity | INTEGER | DEFAULT 1 |
| condition | TEXT | CHECK: new, good, fair, poor, out_of_service |
| low_stock_threshold | INTEGER | DEFAULT 1 |

### `equipment_checkouts`
Equipment checkout records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| equipment_id | UUID | FK -> equipment |
| lab_day_id | UUID | FK -> lab_days |
| quantity | INTEGER | DEFAULT 1 |
| checked_out_by | TEXT | |
| checked_in_at | TIMESTAMPTZ | |

### `equipment_maintenance`
Equipment maintenance records.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| equipment_item_id | UUID | FK -> equipment |
| maintenance_type | TEXT | NOT NULL |
| scheduled_date | DATE | |
| completed_date | DATE | |
| cost | DECIMAL(10,2) | |
| status | TEXT | CHECK: scheduled, completed, overdue, cancelled |

---

## Tasks

### `instructor_tasks`
Task management for instructors.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| description | TEXT | |
| assigned_by | UUID | FK -> lab_users |
| assigned_to | UUID | FK -> lab_users |
| due_date | DATE | |
| priority | TEXT | CHECK: low, medium, high |
| status | TEXT | CHECK: pending, in_progress, completed, cancelled |
| completion_mode | TEXT | DEFAULT 'single' |

### `task_assignees`
Multi-assignee support for tasks.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| task_id | UUID | FK -> instructor_tasks |
| assignee_id | UUID | FK -> lab_users |
| status | TEXT | CHECK: pending, in_progress, completed, cancelled |
| UNIQUE | | (task_id, assignee_id) |

### `task_comments`
Task discussion comments.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| task_id | UUID | FK -> instructor_tasks |
| author_id | UUID | FK -> lab_users |
| comment | TEXT | NOT NULL |

### `instructor_daily_notes`
Instructor daily note journal.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| instructor_id | UUID | FK -> lab_users |
| instructor_email | TEXT | |
| note_date | DATE | NOT NULL |
| content | TEXT | DEFAULT '' |
| UNIQUE | | (instructor_id, note_date) |

---

## Summary

**Total tables tracked in migrations:** ~155 (including core schema tables)

**Key relationships:**
- `lab_users` is the central user table (auth)
- `students` links to `cohorts` for class grouping
- `lab_days` -> `lab_stations` -> `station_instructors` for lab structure
- `student_internships` is the hub for all internship-related data
- `scenarios` links to `scenario_assessments`, `scenario_versions`, `scenario_tags`
- `skill_sheets` -> `skill_sheet_steps` for structured skill documentation
- `onboarding_templates` -> `onboarding_phases` -> `onboarding_tasks` for instructor onboarding
