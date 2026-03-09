# PMI EMS Scheduler -- Database Schema

> Auto-generated from Supabase production -- March 8, 2026

## Summary

- **Total tables:** 288
- **Foreign key relationships:** 371
- **Indexes:** 931
- **RLS policies:** 473
- **Check constraints:** 1008
- **Custom enum types:** 12

## Table of Contents

- [Authentication & Users](#authentication-users) (10 tables)
- [Cohort & Student Management](#cohort-student-management) (36 tables)
- [Lab Management](#lab-management) (38 tables)
- [Scenarios & Skills](#scenarios-skills) (16 tables)
- [Clinical & Field](#clinical-field) (16 tables)
- [Scheduling & Availability](#scheduling-availability) (12 tables)
- [OSCE](#osce) (6 tables)
- [Case Studies](#case-studies) (9 tables)
- [Calendar Integration](#calendar-integration) (3 tables)
- [Tasks & Assignments](#tasks-assignments) (3 tables)
- [Notifications & Communication](#notifications-communication) (10 tables)
- [Onboarding](#onboarding) (15 tables)
- [Equipment & Inventory](#equipment-inventory) (25 tables)
- [Library](#library) (4 tables)
- [3D Printing](#3d-printing) (8 tables)
- [Access Control](#access-control) (9 tables)
- [Compliance & Certifications](#compliance-certifications) (4 tables)
- [Agencies & Affiliations](#agencies-affiliations) (4 tables)
- [Seating & Classrooms](#seating-classrooms) (4 tables)
- [Facilities & Resources](#facilities-resources) (6 tables)
- [Evaluation & Assessment](#evaluation-assessment) (10 tables)
- [Reporting & Analytics](#reporting-analytics) (7 tables)
- [System & Audit](#system-audit) (19 tables)
- [Database Views](#database-views) (7 tables)
- [Backup Tables](#backup-tables) (7 tables)

---

## Tables by Feature Area

### Authentication & Users

#### `lab_users`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| email | text | NO |  |  |
| name | text | NO |  |  |
| role | text | YES | 'instructor'::text |  |
| avatar_url | text | YES |  |  |
| is_active | boolean | YES | true |  |
| last_login | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| approved_at | timestamptz | YES |  |  |
| approved_by | uuid | YES |  |  |
| department_id | uuid | YES |  |  |
| status | text | YES | 'active'::text |  |
| totp_secret | text | YES |  |  |
| totp_enabled | boolean | YES | false |  |
| totp_backup_codes | text[] | YES |  |  |
| totp_verified_at | timestamptz | YES |  |  |
| is_part_time | boolean | YES | false |  |
| google_refresh_token | text | YES |  |  |
| google_token_expires_at | timestamptz | YES |  |  |
| google_calendar_connected | boolean | YES | false |  |
| google_calendar_scope | text | YES | 'freebusy'::text |  |
| google_calendar_ids | text[] | YES | '{}'::text[] |  |

**Foreign Keys:**
- `department_id` -> `departments.id` (`lab_users_department_id_fkey`)

**Unique Constraints:**
- `lab_users_email_key`: (email)

**Check Constraints:**
- `lab_users_role_check`: `(role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'lead_instructor'::text, 'instructor'::text, 'volunteer_instructor'::text, 'program_director'::text, 'student'::text, 'guest'::text, 'pending'::text]))`

**Indexes:**
- `idx_lab_users_email`: `CREATE INDEX idx_lab_users_email ON public.lab_users USING btree (email)`
- `idx_lab_users_email_lower`: `CREATE INDEX idx_lab_users_email_lower ON public.lab_users USING btree (lower(email))`
- `lab_users_email_key`: `CREATE UNIQUE INDEX lab_users_email_key ON public.lab_users USING btree (email)`

**RLS Policies:**
- `Allow all for lab_users` (ALL, permissive, roles: {public})

#### `guest_access`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| email | text | YES |  |  |
| access_code | text | YES |  |  |
| lab_day_id | uuid | YES |  |  |
| assigned_role | text | YES |  |  |
| expires_at | date | YES |  |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`guest_access_lab_day_id_fkey`)
- `created_by` -> `lab_users.id` (`guest_access_created_by_fkey`)

**Unique Constraints:**
- `guest_access_access_code_key`: (access_code)

**Indexes:**
- `guest_access_access_code_key`: `CREATE UNIQUE INDEX guest_access_access_code_key ON public.guest_access USING btree (access_code)`
- `idx_guest_access_code`: `CREATE INDEX idx_guest_access_code ON public.guest_access USING btree (access_code)`
- `idx_guest_access_lab_day`: `CREATE INDEX idx_guest_access_lab_day ON public.guest_access USING btree (lab_day_id)`
- `idx_guest_access_name`: `CREATE INDEX idx_guest_access_name ON public.guest_access USING btree (name)`

**RLS Policies:**
- `Allow all for guest_access` (ALL, permissive, roles: {public})

#### `user_preferences`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_email | text | NO |  |  |
| dashboard_widgets | jsonb | YES | '["notifications", "my_labs", "quick_links"]'::jsonb | string[] of enabled widget names |
| quick_links | jsonb | YES | '["scenarios", "students", "schedule"]'::jsonb | string[] of enabled quick link pages |
| notification_settings | jsonb | YES | '{"email_lab_reminders": true, "email_lab_assignments": t... | { email_lab_reminders, email_lab_assignments, ... } |
| preferences | jsonb | YES | '{}'::jsonb | { email_notifications, notification_categories[], theme? } |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| email_preferences | jsonb | YES | '{"mode": "immediate", "enabled": false, "categories": {}... | { mode, enabled, categories[] } |
| tour_completed | boolean | YES | false |  |
| tour_step | integer | YES | 0 |  |
| tour_completed_at | timestamptz | YES |  |  |

**Unique Constraints:**
- `user_preferences_user_email_key`: (user_email)

**Indexes:**
- `idx_user_preferences_email`: `CREATE INDEX idx_user_preferences_email ON public.user_preferences USING btree (user_email)`
- `user_preferences_user_email_key`: `CREATE UNIQUE INDEX user_preferences_user_email_key ON public.user_preferences USING btree (user_email)`

**RLS Policies:**
- `Users can insert own preferences` (INSERT, permissive, roles: {public})
- `Users can read own preferences` (SELECT, permissive, roles: {public})
- `Users can update own preferences` (UPDATE, permissive, roles: {public})

#### `user_activity`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_email | text | NO |  |  |
| page_path | text | NO |  |  |
| user_agent | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_user_activity_date`: `CREATE INDEX idx_user_activity_date ON public.user_activity USING btree (created_at DESC)`
- `idx_user_activity_page`: `CREATE INDEX idx_user_activity_page ON public.user_activity USING btree (page_path)`
- `idx_user_activity_user`: `CREATE INDEX idx_user_activity_user ON public.user_activity USING btree (user_email)`

**RLS Policies:**
- `activity_insert` (INSERT, permissive, roles: {public})
- `activity_select` (SELECT, permissive, roles: {public})

#### `user_departments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES |  |  |
| department_id | uuid | YES |  |  |
| is_primary | boolean | YES | false |  |
| granted_by | text | YES |  |  |
| granted_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `user_id` -> `lab_users.id` (`user_departments_user_id_fkey`)
- `department_id` -> `departments.id` (`user_departments_department_id_fkey`)

**Unique Constraints:**
- `user_departments_user_id_department_id_key`: (department_id, user_id)

**Indexes:**
- `user_departments_user_id_department_id_key`: `CREATE UNIQUE INDEX user_departments_user_id_department_id_key ON public.user_departments USING btree (user_id, department_id)`

#### `user_endorsements`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES |  |  |
| endorsement_type | text | NO |  |  |
| title | text | YES |  |  |
| department_id | uuid | YES |  |  |
| granted_by | text | YES |  |  |
| granted_at | timestamptz | YES | now() |  |
| expires_at | timestamptz | YES |  |  |
| is_active | boolean | YES | true |  |

**Foreign Keys:**
- `user_id` -> `lab_users.id` (`user_endorsements_user_id_fkey`)
- `department_id` -> `departments.id` (`user_endorsements_department_id_fkey`)

**Unique Constraints:**
- `user_endorsements_user_id_endorsement_type_department_id_key`: (user_id, department_id, endorsement_type)

**Indexes:**
- `idx_endorsements_type`: `CREATE INDEX idx_endorsements_type ON public.user_endorsements USING btree (endorsement_type)`
- `idx_endorsements_user`: `CREATE INDEX idx_endorsements_user ON public.user_endorsements USING btree (user_id)`
- `user_endorsements_user_id_endorsement_type_department_id_key`: `CREATE UNIQUE INDEX user_endorsements_user_id_endorsement_type_department_id_key ON public.user_endorsements USING btree (user_id, endorsement_type, department_id)`

**RLS Policies:**
- `Superadmins manage endorsements` (INSERT, permissive, roles: {authenticated})
- `Superadmins update endorsements` (UPDATE, permissive, roles: {authenticated})
- `Users see endorsements` (SELECT, permissive, roles: {authenticated})

#### `user_notifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_email | text | NO |  |  |
| title | text | NO |  |  |
| message | text | NO |  |  |
| type | text | NO | 'general'::text |  |
| link_url | text | YES |  |  |
| is_read | boolean | NO | false |  |
| created_at | timestamptz | YES | now() |  |
| read_at | timestamptz | YES |  |  |
| reference_type | text | YES |  |  |
| reference_id | uuid | YES |  |  |
| category | text | YES | 'system'::text |  |
| digest_sent_at | timestamptz | YES |  |  |
| archived_at | timestamptz | YES |  |  |
| is_archived | boolean | YES | false |  |

**Check Constraints:**
- `user_notifications_type_check`: `(type = ANY (ARRAY['lab_assignment'::text, 'lab_reminder'::text, 'feedback_new'::text, 'feedback_resolved'::text, 'task_assigned'::text, 'task_completed'::text, 'task_comment'::text, 'role_approved'::text, 'shift_available'::text, 'shift_confirmed'::text, 'clinical_hours'::text, 'compliance_due'::text, 'general'::text]))`
- `user_notifications_category_check`: `(category = ANY (ARRAY['tasks'::text, 'labs'::text, 'scheduling'::text, 'feedback'::text, 'clinical'::text, 'system'::text]))`

**Indexes:**
- `idx_notifications_archived`: `CREATE INDEX idx_notifications_archived ON public.user_notifications USING btree (user_email, archived_at) WHERE (archived_at IS NOT NULL)`
- `idx_notifications_digest`: `CREATE INDEX idx_notifications_digest ON public.user_notifications USING btree (user_email, digest_sent_at) WHERE (digest_sent_at IS NULL)`
- `idx_notifications_digest_pending`: `CREATE INDEX idx_notifications_digest_pending ON public.user_notifications USING btree (user_email, created_at) WHERE ((digest_sent_at IS NULL) AND (is_read = false))`
- `idx_user_notifications_category`: `CREATE INDEX idx_user_notifications_category ON public.user_notifications USING btree (category)`
- `idx_user_notifications_created`: `CREATE INDEX idx_user_notifications_created ON public.user_notifications USING btree (created_at DESC)`
- `idx_user_notifications_email`: `CREATE INDEX idx_user_notifications_email ON public.user_notifications USING btree (user_email)`
- `idx_user_notifications_email_created`: `CREATE INDEX idx_user_notifications_email_created ON public.user_notifications USING btree (user_email, created_at DESC)`
- `idx_user_notifications_email_read_created`: `CREATE INDEX idx_user_notifications_email_read_created ON public.user_notifications USING btree (user_email, is_read, created_at DESC)`
- `idx_user_notifications_ref_type_created`: `CREATE INDEX idx_user_notifications_ref_type_created ON public.user_notifications USING btree (reference_type, created_at DESC)`
- `idx_user_notifications_type`: `CREATE INDEX idx_user_notifications_type ON public.user_notifications USING btree (type)`
- `idx_user_notifications_unread`: `CREATE INDEX idx_user_notifications_unread ON public.user_notifications USING btree (user_email, is_read) WHERE (is_read = false)`
- `idx_user_notifications_user_read_date`: `CREATE INDEX idx_user_notifications_user_read_date ON public.user_notifications USING btree (user_email, is_read, created_at DESC)`

**RLS Policies:**
- `Service can delete notifications` (DELETE, permissive, roles: {public})
- `Service can insert notifications` (INSERT, permissive, roles: {public})
- `Users can read own notifications` (SELECT, permissive, roles: {public})
- `Users can update own notifications` (UPDATE, permissive, roles: {public})

#### `user_roles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO |  |  |
| role | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `user_id` -> `lab_users.id` (`user_roles_user_id_fkey`)

**Unique Constraints:**
- `user_roles_user_id_role_key`: (role, user_id)

**Check Constraints:**
- `user_roles_role_check`: `(role = ANY (ARRAY['operator'::text, 'inventory_admin'::text, 'access_admin'::text]))`

**Indexes:**
- `user_roles_user_id_role_key`: `CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role)`

**RLS Policies:**
- `Superadmins can manage all roles` (ALL, permissive, roles: {public})
- `Users can view their own roles` (SELECT, permissive, roles: {public})

#### `user_sessions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_email | text | NO |  |  |
| session_token | text | NO |  |  |
| device_info | jsonb | YES |  |  |
| ip_address | text | YES |  |  |
| last_active | timestamptz | YES | now() |  |
| expires_at | timestamptz | YES |  |  |
| is_revoked | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `user_sessions_session_token_key`: (session_token)

**Indexes:**
- `idx_user_sessions_email`: `CREATE INDEX idx_user_sessions_email ON public.user_sessions USING btree (user_email)`
- `idx_user_sessions_token`: `CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token)`
- `user_sessions_session_token_key`: `CREATE UNIQUE INDEX user_sessions_session_token_key ON public.user_sessions USING btree (session_token)`

#### `instructor_certifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| instructor_id | uuid | NO |  |  |
| cert_name | text | NO |  |  |
| cert_number | text | YES |  |  |
| issuing_body | text | YES |  |  |
| issue_date | date | YES |  |  |
| expiration_date | date | NO |  |  |
| card_image_url | text | YES |  |  |
| ce_requirement_id | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| verification_status | text | YES | 'pending'::text |  |
| verified_by | text | YES |  |  |
| verified_at | timestamptz | YES |  |  |
| verification_notes | text | YES |  |  |
| document_url | text | YES |  |  |

**Foreign Keys:**
- `ce_requirement_id` -> `ce_requirements.id` (`fk_ce_requirement`)
- `instructor_id` -> `lab_users.id` (`instructor_certifications_instructor_id_fkey`)

**Indexes:**
- `idx_instructor_certs_expiration`: `CREATE INDEX idx_instructor_certs_expiration ON public.instructor_certifications USING btree (expiration_date)`
- `idx_instructor_certs_instructor`: `CREATE INDEX idx_instructor_certs_instructor ON public.instructor_certifications USING btree (instructor_id)`

**RLS Policies:**
- `Allow all for instructor_certifications` (ALL, permissive, roles: {public})

### Cohort & Student Management

#### `programs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | text | NO |  |  |
| display_name | text | NO |  |  |
| abbreviation | text | NO |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| department_id | uuid | YES |  |  |

**Foreign Keys:**
- `department_id` -> `departments.id` (`programs_department_id_fkey`)

**Unique Constraints:**
- `programs_name_key`: (name)

**Indexes:**
- `programs_name_key`: `CREATE UNIQUE INDEX programs_name_key ON public.programs USING btree (name)`

**RLS Policies:**
- `Allow all for programs` (ALL, permissive, roles: {public})

#### `cohorts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| program_id | uuid | NO |  |  |
| cohort_number | integer | NO |  |  |
| start_date | date | YES |  |  |
| expected_end_date | date | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| current_semester | integer | YES | 1 |  |
| semester_start_date | date | YES |  |  |
| semester_end_date | date | YES |  |  |
| semester | text | YES |  |  |
| end_date | date | YES |  |  |
| is_archived | boolean | YES | false |  |
| archived_at | timestamptz | YES |  |  |
| archived_by | text | YES |  |  |
| archive_summary | jsonb | YES |  | Summary stats at archive time |

**Foreign Keys:**
- `program_id` -> `programs.id` (`cohorts_program_id_fkey`)

**Unique Constraints:**
- `cohorts_program_id_cohort_number_key`: (cohort_number, program_id)

**Indexes:**
- `cohorts_program_id_cohort_number_key`: `CREATE UNIQUE INDEX cohorts_program_id_cohort_number_key ON public.cohorts USING btree (program_id, cohort_number)`
- `idx_cohorts_archived`: `CREATE INDEX idx_cohorts_archived ON public.cohorts USING btree (is_archived)`
- `idx_cohorts_semester`: `CREATE INDEX idx_cohorts_semester ON public.cohorts USING btree (semester)`

**RLS Policies:**
- `Allow all for cohorts` (ALL, permissive, roles: {public})

#### `students`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| first_name | text | NO |  |  |
| last_name | text | NO |  |  |
| email | text | YES |  |  |
| cohort_id | uuid | YES |  |  |
| photo_url | text | YES |  |  |
| status | text | YES | 'active'::text |  |
| agency | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| prior_cert_level | text | YES |  |  |
| years_ems_experience | numeric | YES |  |  |
| prior_work_setting | text | YES |  |  |
| prior_employer | text | YES |  |  |
| scrub_top_size | text | YES |  |  |
| scrub_bottom_size | text | YES |  |  |
| student_id | text | YES |  |  |
| max_checkouts | integer | YES | 3 |  |
| has_hold | boolean | YES | false |  |
| hold_reason | text | YES |  |  |
| barcode | text | YES |  |  |
| phone | text | YES |  |  |
| address | text | YES |  |  |
| emergency_contact_relationship | text | YES |  |  |
| student_number | text | YES |  |  |
| enrollment_date | date | YES |  |  |
| preferred_contact_method | text | YES |  |  |
| best_contact_times | text[] | YES |  |  |
| language_preference | text | YES | 'en'::text |  |
| opt_out_non_essential | boolean | YES | false |  |
| emergency_contact_name | text | YES |  |  |
| emergency_contact_phone | text | YES |  |  |
| learning_style | text | YES |  |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`students_cohort_id_fkey`)

**Unique Constraints:**
- `students_student_id_key`: (student_id)

**Check Constraints:**
- `students_status_check`: `(status = ANY (ARRAY['active'::text, 'graduated'::text, 'withdrawn'::text, 'on_hold'::text]))`
- `students_learning_style_check`: `((learning_style = ANY (ARRAY['visual'::text, 'auditory'::text, 'kinesthetic'::text, 'reading'::text])) OR (learning_style IS NULL))`

**Indexes:**
- `idx_students_cohort`: `CREATE INDEX idx_students_cohort ON public.students USING btree (cohort_id)`
- `idx_students_cohort_id`: `CREATE INDEX idx_students_cohort_id ON public.students USING btree (cohort_id)`
- `idx_students_cohort_status`: `CREATE INDEX idx_students_cohort_status ON public.students USING btree (cohort_id, status)`
- `idx_students_learning_style`: `CREATE INDEX idx_students_learning_style ON public.students USING btree (learning_style)`
- `idx_students_status`: `CREATE INDEX idx_students_status ON public.students USING btree (status)`
- `students_student_id_key`: `CREATE UNIQUE INDEX students_student_id_key ON public.students USING btree (student_id)`

**RLS Policies:**
- `Allow all for students` (ALL, permissive, roles: {public})
- `Service role can manage students` (ALL, permissive, roles: {public})

#### `student_learning_styles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| student_id | uuid | YES |  |  |
| primary_style | text | YES |  |  |
| social_style | text | YES |  |  |
| processing_style | text | YES |  |  |
| structure_style | text | YES |  |  |
| assessment_data | jsonb | YES |  |  |
| assessed_date | date | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_learning_styles_student_id_fkey`)

**Unique Constraints:**
- `student_learning_styles_student_id_key`: (student_id)

**Check Constraints:**
- `student_learning_styles_structure_style_check`: `(structure_style = ANY (ARRAY['structured'::text, 'flexible'::text]))`
- `student_learning_styles_social_style_check`: `(social_style = ANY (ARRAY['social'::text, 'independent'::text]))`
- `student_learning_styles_primary_style_check`: `(primary_style = ANY (ARRAY['audio'::text, 'visual'::text, 'kinesthetic'::text]))`
- `student_learning_styles_processing_style_check`: `(processing_style = ANY (ARRAY['analytical'::text, 'global'::text]))`

**Indexes:**
- `idx_learning_styles_student`: `CREATE INDEX idx_learning_styles_student ON public.student_learning_styles USING btree (student_id)`
- `student_learning_styles_student_id_key`: `CREATE UNIQUE INDEX student_learning_styles_student_id_key ON public.student_learning_styles USING btree (student_id)`

**RLS Policies:**
- `Allow all deletes on learning styles` (DELETE, permissive, roles: {public})
- `Allow all inserts on learning styles` (INSERT, permissive, roles: {public})
- `Allow all updates on learning styles` (UPDATE, permissive, roles: {public})
- `Authenticated users can view learning styles` (SELECT, permissive, roles: {public})

#### `cohort_key_dates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cohort_id | uuid | YES |  |  |
| cohort_start | date | YES |  |  |
| immunizations_due | date | YES |  |  |
| clinical_docs_due | date | YES |  |  |
| clinicals_begin | date | YES |  |  |
| clinicals_end | date | YES |  |  |
| internship_start_window | date | YES |  |  |
| phase_1_evals_due | date | YES |  |  |
| phase_2_evals_due | date | YES |  |  |
| snhd_paperwork_due | date | YES |  |  |
| graduation_date | date | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`cohort_key_dates_cohort_id_fkey`)

**Unique Constraints:**
- `cohort_key_dates_cohort_id_key`: (cohort_id)

**Indexes:**
- `cohort_key_dates_cohort_id_key`: `CREATE UNIQUE INDEX cohort_key_dates_cohort_id_key ON public.cohort_key_dates USING btree (cohort_id)`

**RLS Policies:**
- `Allow all access to cohort_key_dates` (ALL, permissive, roles: {public})

#### `cohort_milestones`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cohort_id | uuid | YES |  |  |
| milestone_type | text | NO |  |  |
| milestone_name | text | YES |  |  |
| due_date | date | NO |  |  |
| warning_days | integer | YES | 14 |  |
| critical_days | integer | YES | 7 |  |
| applies_to | text | YES | 'all'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`cohort_milestones_cohort_id_fkey`)

**Indexes:**
- `idx_milestones_cohort`: `CREATE INDEX idx_milestones_cohort ON public.cohort_milestones USING btree (cohort_id)`
- `idx_milestones_due_date`: `CREATE INDEX idx_milestones_due_date ON public.cohort_milestones USING btree (due_date)`

**RLS Policies:**
- `Allow all access to milestones` (ALL, permissive, roles: {public})

#### `cohort_tasks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cohort_id | uuid | YES |  |  |
| template_id | uuid | YES |  |  |
| task_definition_id | uuid | YES |  |  |
| phase | text | NO |  |  |
| task_name | text | NO |  |  |
| task_description | text | YES |  |  |
| due_date | date | YES |  |  |
| source_table | text | YES |  |  |
| source_field | text | YES |  |  |
| is_required | boolean | YES | true |  |
| is_active | boolean | YES | true |  |
| sort_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `task_definition_id` -> `clinical_task_definitions.id` (`cohort_tasks_task_definition_id_fkey`)
- `cohort_id` -> `cohorts.id` (`cohort_tasks_cohort_id_fkey`)
- `template_id` -> `clinical_task_templates.id` (`cohort_tasks_template_id_fkey`)

**Indexes:**
- `idx_cohort_tasks_cohort`: `CREATE INDEX idx_cohort_tasks_cohort ON public.cohort_tasks USING btree (cohort_id)`
- `idx_cohort_tasks_phase`: `CREATE INDEX idx_cohort_tasks_phase ON public.cohort_tasks USING btree (phase)`

**RLS Policies:**
- `Allow all access to cohort_tasks` (ALL, permissive, roles: {public})

#### `cohort_scenario_completions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| cohort_id | uuid | NO |  |  |
| scenario_id | uuid | NO |  |  |
| lab_day_id | uuid | YES |  |  |
| station_id | uuid | YES |  |  |
| completed_date | date | YES | CURRENT_DATE |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `station_id` -> `lab_stations.id` (`cohort_scenario_completions_station_id_fkey`)
- `cohort_id` -> `cohorts.id` (`cohort_scenario_completions_cohort_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`cohort_scenario_completions_lab_day_id_fkey`)
- `scenario_id` -> `scenarios.id` (`cohort_scenario_completions_scenario_id_fkey`)

**Indexes:**
- `idx_cohort_scenario_completions_cohort`: `CREATE INDEX idx_cohort_scenario_completions_cohort ON public.cohort_scenario_completions USING btree (cohort_id)`
- `idx_cohort_scenario_completions_scenario`: `CREATE INDEX idx_cohort_scenario_completions_scenario ON public.cohort_scenario_completions USING btree (scenario_id)`

**RLS Policies:**
- `Allow all for cohort_scenario_completions` (ALL, permissive, roles: {public})

#### `cohort_skill_completions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| cohort_id | uuid | NO |  |  |
| skill_id | uuid | NO |  |  |
| lab_day_id | uuid | YES |  |  |
| station_id | uuid | YES |  |  |
| completed_date | date | YES | CURRENT_DATE |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`cohort_skill_completions_cohort_id_fkey`)
- `station_id` -> `lab_stations.id` (`cohort_skill_completions_station_id_fkey`)
- `skill_id` -> `skills.id` (`cohort_skill_completions_skill_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`cohort_skill_completions_lab_day_id_fkey`)

**Indexes:**
- `idx_cohort_skill_completions_cohort`: `CREATE INDEX idx_cohort_skill_completions_cohort ON public.cohort_skill_completions USING btree (cohort_id)`
- `idx_cohort_skill_completions_skill`: `CREATE INDEX idx_cohort_skill_completions_skill ON public.cohort_skill_completions USING btree (skill_id)`

**RLS Policies:**
- `Allow all for cohort_skill_completions` (ALL, permissive, roles: {public})

#### `student_documents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| document_type | text | NO |  |  |
| file_url | text | YES |  |  |
| file_name | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| reviewed_by | text | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |
| review_notes | text | YES |  |  |
| expires_at | date | YES |  |  |
| uploaded_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_documents_student_id_fkey`)

**Check Constraints:**
- `student_documents_status_check`: `(status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text]))`

**Indexes:**
- `idx_student_documents_student`: `CREATE INDEX idx_student_documents_student ON public.student_documents USING btree (student_id)`
- `idx_student_documents_type`: `CREATE INDEX idx_student_documents_type ON public.student_documents USING btree (document_type)`

**RLS Policies:**
- `student_documents_service_role` (ALL, permissive, roles: {public})

#### `student_notes`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| category | text | YES | 'other'::text |  |
| content | text | NO |  |  |
| flag_level | text | YES |  |  |
| created_by | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| author_id | uuid | YES |  |  |
| author_email | text | YES |  |  |
| is_flagged | boolean | YES | false |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_notes_student_id_fkey`)
- `author_id` -> `lab_users.id` (`student_notes_author_id_fkey`)

**Check Constraints:**
- `student_notes_flag_level_check`: `(flag_level = ANY (ARRAY['none'::text, 'yellow'::text, 'red'::text]))`
- `student_notes_category_check`: `(category = ANY (ARRAY['academic'::text, 'behavioral'::text, 'medical'::text, 'other'::text]))`

**Indexes:**
- `idx_student_notes_author`: `CREATE INDEX idx_student_notes_author ON public.student_notes USING btree (author_id)`
- `idx_student_notes_flag`: `CREATE INDEX idx_student_notes_flag ON public.student_notes USING btree (flag_level) WHERE (flag_level = ANY (ARRAY['yellow'::text, 'red'::text]))`
- `idx_student_notes_flagged`: `CREATE INDEX idx_student_notes_flagged ON public.student_notes USING btree (student_id) WHERE (is_flagged = true)`
- `idx_student_notes_student`: `CREATE INDEX idx_student_notes_student ON public.student_notes USING btree (student_id)`

**RLS Policies:**
- `Instructors can manage student notes` (ALL, permissive, roles: {public})

#### `student_import_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cohort_id | uuid | YES |  |  |
| imported_count | integer | YES | 0 |  |
| skipped_count | integer | YES | 0 |  |
| updated_count | integer | YES | 0 |  |
| import_mode | text | YES |  |  |
| imported_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`student_import_history_cohort_id_fkey`)

**Indexes:**
- `idx_import_history_cohort`: `CREATE INDEX idx_import_history_cohort ON public.student_import_history USING btree (cohort_id)`

**RLS Policies:**
- `import_history_insert` (INSERT, permissive, roles: {public})
- `import_history_select` (SELECT, permissive, roles: {public})

#### `import_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| import_type | text | NO |  |  |
| file_name | text | YES |  |  |
| records_total | integer | YES |  |  |
| records_imported | integer | YES |  |  |
| records_failed | integer | YES |  |  |
| error_log | jsonb | YES |  |  |
| imported_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_import_history_created`: `CREATE INDEX idx_import_history_created ON public.import_history USING btree (created_at DESC)`
- `idx_import_history_type`: `CREATE INDEX idx_import_history_type ON public.import_history USING btree (import_type)`

**RLS Policies:**
- `Admins can manage import_history` (ALL, permissive, roles: {public})

#### `aemt_student_tracking`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| mce_complete | boolean | YES | false |  |
| mce_date | date | YES |  |  |
| vax_uploaded | boolean | YES | false |  |
| vax_received_date | date | YES |  |  |
| ridealong_completed_date | date | YES |  |  |
| ridealong_scanned | boolean | YES | false |  |
| clinical_1_complete | boolean | YES | false |  |
| clinical_1_date | date | YES |  |  |
| clinical_1_site | text | YES |  |  |
| clinical_2_complete | boolean | YES | false |  |
| clinical_2_date | date | YES |  |  |
| clinical_2_site | text | YES |  |  |
| clinical_3_complete | boolean | YES | false |  |
| clinical_3_date | date | YES |  |  |
| clinical_3_site | text | YES |  |  |
| vitals_tracker_date | date | YES |  |  |
| status | text | YES | 'active'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`aemt_student_tracking_student_id_fkey`)
- `cohort_id` -> `cohorts.id` (`aemt_student_tracking_cohort_id_fkey`)

**Indexes:**
- `idx_aemt_tracking_cohort`: `CREATE INDEX idx_aemt_tracking_cohort ON public.aemt_student_tracking USING btree (cohort_id)`
- `idx_aemt_tracking_student`: `CREATE INDEX idx_aemt_tracking_student ON public.aemt_student_tracking USING btree (student_id)`

**RLS Policies:**
- `Allow all access to aemt_tracking` (ALL, permissive, roles: {public})
- `Allow authenticated users to insert AEMT tracking` (INSERT, permissive, roles: {authenticated})
- `Allow authenticated users to update AEMT tracking` (UPDATE, permissive, roles: {authenticated})
- `Allow authenticated users to view AEMT tracking` (SELECT, permissive, roles: {authenticated})

#### `emt_student_tracking`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| mce_complete | boolean | YES | false |  |
| mce_date | date | YES |  |  |
| vax_uploaded | boolean | YES | false |  |
| vax_received_date | date | YES |  |  |
| ridealong_completed_date | date | YES |  |  |
| ridealong_scanned | boolean | YES | false |  |
| vitals_tracker_date | date | YES |  |  |
| status | text | YES | 'active'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| vax_complete | boolean | YES | false |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`emt_student_tracking_student_id_fkey`)
- `cohort_id` -> `cohorts.id` (`emt_student_tracking_cohort_id_fkey`)

**Indexes:**
- `idx_emt_tracking_cohort`: `CREATE INDEX idx_emt_tracking_cohort ON public.emt_student_tracking USING btree (cohort_id)`
- `idx_emt_tracking_student`: `CREATE INDEX idx_emt_tracking_student ON public.emt_student_tracking USING btree (student_id)`

**RLS Policies:**
- `Allow all access to emt_tracking` (ALL, permissive, roles: {public})
- `Allow authenticated users to insert EMT tracking` (INSERT, permissive, roles: {authenticated})
- `Allow authenticated users to update EMT tracking` (UPDATE, permissive, roles: {authenticated})
- `Allow authenticated users to view EMT tracking` (SELECT, permissive, roles: {authenticated})

#### `student_achievements`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| achievement_type | text | NO |  |  |
| achievement_name | text | NO |  |  |
| earned_at | timestamptz | YES | now() |  |
| metadata | jsonb | YES | '{}'::jsonb |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_achievements_student_id_fkey`)

**Indexes:**
- `idx_student_achievements_student`: `CREATE INDEX idx_student_achievements_student ON public.student_achievements USING btree (student_id)`

**RLS Policies:**
- `Service role full access to student_achievements` (ALL, permissive, roles: {public})

#### `student_case_stats`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| student_id | uuid | NO |  | PK |
| cohort_id | uuid | NO |  | PK |
| cases_completed | integer | YES | 0 |  |
| cases_attempted | integer | YES | 0 |  |
| total_points_earned | integer | YES | 0 |  |
| total_points_possible | integer | YES | 0 |  |
| average_score | numeric | YES | 0 |  |
| best_score | numeric | YES | 0 |  |
| badges_earned | integer | YES | 0 |  |
| total_time_seconds | integer | YES | 0 |  |
| last_activity_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_case_stats_student_id_fkey`)
- `cohort_id` -> `cohorts.id` (`student_case_stats_cohort_id_fkey`)

**RLS Policies:**
- `Service role full access to student_case_stats` (ALL, permissive, roles: {public})

#### `student_communications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| type | text | NO |  |  |
| summary | text | NO |  |  |
| details | text | YES |  |  |
| flagged | boolean | YES | false |  |
| follow_up_needed | boolean | YES | false |  |
| follow_up_date | date | YES |  |  |
| follow_up_completed | boolean | YES | false |  |
| created_by | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_communications_student_id_fkey`)

**Check Constraints:**
- `student_communications_type_check`: `(type = ANY (ARRAY['phone'::text, 'email'::text, 'meeting'::text, 'text'::text, 'other'::text]))`

**Indexes:**
- `idx_student_communications_flagged`: `CREATE INDEX idx_student_communications_flagged ON public.student_communications USING btree (flagged) WHERE (flagged = true)`
- `idx_student_communications_follow_up`: `CREATE INDEX idx_student_communications_follow_up ON public.student_communications USING btree (follow_up_needed, follow_up_completed) WHERE ((follow_up_needed = true) AND (follow_up_completed = false))`
- `idx_student_communications_student`: `CREATE INDEX idx_student_communications_student ON public.student_communications USING btree (student_id)`

#### `student_compliance_docs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| complio_complete | boolean | YES | false |  |
| mce_complete | boolean | YES | false |  |
| mmr_complete | boolean | YES | false |  |
| mmr_date | date | YES |  |  |
| vzv_complete | boolean | YES | false |  |
| vzv_date | date | YES |  |  |
| hep_b_complete | boolean | YES | false |  |
| hep_b_date | date | YES |  |  |
| hep_b_declination | boolean | YES | false |  |
| tdap_complete | boolean | YES | false |  |
| tdap_date | date | YES |  |  |
| covid_complete | boolean | YES | false |  |
| covid_date | date | YES |  |  |
| covid_exemption | boolean | YES | false |  |
| tb_test_1_complete | boolean | YES | false |  |
| tb_test_1_date | date | YES |  |  |
| tb_test_2_complete | boolean | YES | false |  |
| tb_test_2_date | date | YES |  |  |
| tb_questionnaire | boolean | YES | false |  |
| physical_complete | boolean | YES | false |  |
| physical_date | date | YES |  |  |
| health_insurance_complete | boolean | YES | false |  |
| health_insurance_date | date | YES |  |  |
| bls_complete | boolean | YES | false |  |
| bls_expiration | date | YES |  |  |
| flu_shot_complete | boolean | YES | false |  |
| flu_shot_date | date | YES |  |  |
| flu_declination | boolean | YES | false |  |
| hospital_orientation_complete | boolean | YES | false |  |
| hospital_orientation_date | date | YES |  |  |
| background_check_complete | boolean | YES | false |  |
| background_check_date | date | YES |  |  |
| drug_test_complete | boolean | YES | false |  |
| drug_test_date | date | YES |  |  |
| attestation_complete | boolean | YES | false |  |
| attestation_date | date | YES |  |  |
| exhibit_complete | boolean | YES | false |  |
| docs_shared_with_sites | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| doc_type | text | YES |  |  |
| completed | boolean | YES | false |  |
| completion_date | date | YES |  |  |
| expiration_date | date | YES |  |  |
| notes | text | YES |  |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`student_compliance_docs_cohort_id_fkey`)
- `student_id` -> `students.id` (`student_compliance_docs_student_id_fkey`)

**Unique Constraints:**
- `student_compliance_docs_student_id_key`: (student_id)

**Indexes:**
- `idx_compliance_docs_cohort`: `CREATE INDEX idx_compliance_docs_cohort ON public.student_compliance_docs USING btree (cohort_id)`
- `idx_compliance_docs_student`: `CREATE INDEX idx_compliance_docs_student ON public.student_compliance_docs USING btree (student_id)`
- `idx_compliance_docs_type`: `CREATE INDEX idx_compliance_docs_type ON public.student_compliance_docs USING btree (doc_type)`
- `student_compliance_docs_student_id_key`: `CREATE UNIQUE INDEX student_compliance_docs_student_id_key ON public.student_compliance_docs USING btree (student_id)`

**RLS Policies:**
- `Allow all access to compliance_docs` (ALL, permissive, roles: {public})
- `Allow authenticated users to insert compliance docs` (INSERT, permissive, roles: {authenticated})
- `Allow authenticated users to update compliance docs` (UPDATE, permissive, roles: {authenticated})
- `Allow authenticated users to view compliance docs` (SELECT, permissive, roles: {authenticated})

#### `student_compliance_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| doc_type_id | uuid | NO |  |  |
| status | text | NO | 'missing'::text |  |
| expiration_date | date | YES |  |  |
| file_path | text | YES |  |  |
| file_name | text | YES |  |  |
| notes | text | YES |  |  |
| verified_by | text | YES |  |  |
| verified_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_compliance_records_student_id_fkey`)
- `doc_type_id` -> `compliance_document_types.id` (`student_compliance_records_doc_type_id_fkey`)

**Unique Constraints:**
- `student_compliance_records_student_id_doc_type_id_key`: (student_id, doc_type_id)

**Check Constraints:**
- `student_compliance_records_status_check`: `(status = ANY (ARRAY['complete'::text, 'missing'::text, 'expiring'::text, 'expired'::text]))`

**Indexes:**
- `idx_compliance_records_expiration`: `CREATE INDEX idx_compliance_records_expiration ON public.student_compliance_records USING btree (expiration_date)`
- `idx_compliance_records_status`: `CREATE INDEX idx_compliance_records_status ON public.student_compliance_records USING btree (status)`
- `idx_compliance_records_student`: `CREATE INDEX idx_compliance_records_student ON public.student_compliance_records USING btree (student_id)`
- `student_compliance_records_student_id_doc_type_id_key`: `CREATE UNIQUE INDEX student_compliance_records_student_id_doc_type_id_key ON public.student_compliance_records USING btree (student_id, doc_type_id)`

**RLS Policies:**
- `Allow authenticated insert of compliance records` (INSERT, permissive, roles: {authenticated})
- `Allow authenticated read of compliance records` (SELECT, permissive, roles: {authenticated})
- `Allow authenticated update of compliance records` (UPDATE, permissive, roles: {authenticated})

#### `student_field_rides`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| chh_or_complete | boolean | YES | false |  |
| chh_or_date | date | YES |  |  |
| svh_or_complete | boolean | YES | false |  |
| svh_or_date | date | YES |  |  |
| siena_or_complete | boolean | YES | false |  |
| siena_or_date | date | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`student_field_rides_cohort_id_fkey`)
- `student_id` -> `students.id` (`student_field_rides_student_id_fkey`)

**Indexes:**
- `idx_field_rides_cohort`: `CREATE INDEX idx_field_rides_cohort ON public.student_field_rides USING btree (cohort_id)`
- `idx_field_rides_student`: `CREATE INDEX idx_field_rides_student ON public.student_field_rides USING btree (student_id)`

**RLS Policies:**
- `Allow all access to field_rides` (ALL, permissive, roles: {public})

#### `student_group_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| group_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| role | text | YES | 'member'::text |  |
| assigned_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_group_assignments_student_id_fkey`)
- `group_id` -> `student_groups.id` (`student_group_assignments_group_id_fkey`)

**Unique Constraints:**
- `student_group_assignments_group_id_student_id_key`: (group_id, student_id)

**Indexes:**
- `idx_group_assignments_group`: `CREATE INDEX idx_group_assignments_group ON public.student_group_assignments USING btree (group_id)`
- `idx_group_assignments_student`: `CREATE INDEX idx_group_assignments_student ON public.student_group_assignments USING btree (student_id)`
- `student_group_assignments_group_id_student_id_key`: `CREATE UNIQUE INDEX student_group_assignments_group_id_student_id_key ON public.student_group_assignments USING btree (group_id, student_id)`

**RLS Policies:**
- `Allow all deletes on student_group_assignments` (DELETE, permissive, roles: {public})
- `Allow all inserts on group assignments` (INSERT, permissive, roles: {public})
- `Allow all updates on student_group_assignments` (UPDATE, permissive, roles: {public})
- `Authenticated users can view group assignments` (SELECT, permissive, roles: {public})

#### `student_groups`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| cohort_id | uuid | YES |  |  |
| name | text | NO |  |  |
| group_number | integer | YES |  |  |
| description | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`student_groups_cohort_id_fkey`)

**Indexes:**
- `idx_student_groups_cohort`: `CREATE INDEX idx_student_groups_cohort ON public.student_groups USING btree (cohort_id)`

**RLS Policies:**
- `Allow all deletes on student_groups` (DELETE, permissive, roles: {public})
- `Allow all inserts on groups` (INSERT, permissive, roles: {public})
- `Allow all updates on student_groups` (UPDATE, permissive, roles: {public})
- `Authenticated users can view groups` (SELECT, permissive, roles: {public})

#### `student_individual_tasks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| phase | text | YES |  |  |
| task_name | text | NO |  |  |
| task_description | text | YES |  |  |
| task_type | text | YES | 'custom'::text |  |
| due_date | date | YES |  |  |
| status | text | YES | 'pending'::text |  |
| completed_at | timestamptz | YES |  |  |
| completed_by | uuid | YES |  |  |
| assigned_by | uuid | YES |  |  |
| assigned_at | timestamptz | YES | now() |  |
| is_required | boolean | YES | true |  |
| is_urgent | boolean | YES | false |  |
| show_on_dashboard | boolean | YES | true |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_individual_tasks_student_id_fkey`)
- `cohort_id` -> `cohorts.id` (`student_individual_tasks_cohort_id_fkey`)
- `completed_by` -> `lab_users.id` (`student_individual_tasks_completed_by_fkey`)
- `assigned_by` -> `lab_users.id` (`student_individual_tasks_assigned_by_fkey`)

**Indexes:**
- `idx_individual_tasks_due`: `CREATE INDEX idx_individual_tasks_due ON public.student_individual_tasks USING btree (due_date)`
- `idx_individual_tasks_status`: `CREATE INDEX idx_individual_tasks_status ON public.student_individual_tasks USING btree (status)`
- `idx_individual_tasks_student`: `CREATE INDEX idx_individual_tasks_student ON public.student_individual_tasks USING btree (student_id)`
- `idx_individual_tasks_type`: `CREATE INDEX idx_individual_tasks_type ON public.student_individual_tasks USING btree (task_type)`

**RLS Policies:**
- `Allow all access to individual_tasks` (ALL, permissive, roles: {public})

#### `student_internships`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| preceptor_id | uuid | YES |  |  |
| agency_id | uuid | YES |  |  |
| agency_name | text | YES |  |  |
| shift_type | text | YES | '12_hour'::text |  |
| placement_date | date | YES |  |  |
| orientation_date | date | YES |  |  |
| internship_start_date | date | YES |  |  |
| expected_end_date | date | YES |  |  |
| actual_end_date | date | YES |  |  |
| current_phase | text | YES | 'pre_internship'::text |  |
| phase_1_start_date | date | YES |  |  |
| phase_1_end_date | date | YES |  |  |
| phase_1_eval_scheduled | date | YES |  |  |
| phase_1_eval_completed | boolean | YES | false |  |
| phase_1_eval_notes | text | YES |  |  |
| phase_2_start_date | date | YES |  |  |
| phase_2_end_date | date | YES |  |  |
| phase_2_eval_scheduled | date | YES |  |  |
| phase_2_eval_completed | boolean | YES | false |  |
| phase_2_eval_notes | text | YES |  |  |
| closeout_meeting_date | date | YES |  |  |
| closeout_completed | boolean | YES | false |  |
| status | text | YES | 'not_started'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| provisional_date | date | YES |  |  |
| oriented | boolean | YES | false |  |
| shift_schedule | text | YES |  |  |
| phase_1_complete_date | date | YES |  |  |
| phase_2_complete_date | date | YES |  |  |
| exams_passed | boolean | YES | false |  |
| exams_passed_date | date | YES |  |  |
| snhd_paperwork_submitted | boolean | YES | false |  |
| snhd_paperwork_date | date | YES |  |  |
| snhd_course_complete | boolean | YES | false |  |
| snhd_course_date | date | YES |  |  |
| cleared_for_nremt | boolean | YES | false |  |
| cleared_for_nremt_date | date | YES |  |  |
| nremt_notification_sent | boolean | YES | false |  |
| nremt_notification_date | date | YES |  |  |
| orientation_completed | boolean | YES | false |  |
| liability_form_completed | boolean | YES | false |  |
| background_check_completed | boolean | YES | false |  |
| drug_screen_completed | boolean | YES | false |  |
| immunizations_verified | boolean | YES | false |  |
| cpr_card_verified | boolean | YES | false |  |
| uniform_issued | boolean | YES | false |  |
| badge_issued | boolean | YES | false |  |
| ryan_notified | boolean | YES | false |  |
| ryan_notified_date | date | YES |  |  |
| written_exam_date | date | YES |  |  |
| written_exam_passed | boolean | YES | false |  |
| psychomotor_exam_date | date | YES |  |  |
| psychomotor_exam_passed | boolean | YES | false |  |
| phase_1_meeting_poll_id | text | YES |  |  |
| phase_1_meeting_scheduled | date | YES |  |  |
| phase_2_meeting_poll_id | text | YES |  |  |
| phase_2_meeting_scheduled | date | YES |  |  |
| final_exam_poll_id | text | YES |  |  |
| final_exam_scheduled | date | YES |  |  |
| course_completion_date | date | YES |  |  |
| internship_completed | boolean | YES | false |  |
| internship_completed_date | date | YES |  |  |
| closeout_meeting_scheduled | date | YES |  |  |
| internship_completion_date | date | YES |  |  |
| snhd_submitted | boolean | YES | false |  |
| snhd_submitted_date | date | YES |  |  |
| nremt_clearance_date | date | YES |  |  |
| is_extended | boolean | YES | false |  |
| extension_reason | text | YES |  |  |
| extension_date | date | YES |  |  |
| original_expected_end_date | date | YES |  |  |
| extension_eval_completed | boolean | YES | false |  |
| extension_eval_date | date | YES |  |  |
| extension_eval_notes | text | YES |  |  |
| phase_1_extended | boolean | YES | false |  |
| phase_1_extension_reason | text | YES |  |  |
| phase_1_extended_until | date | YES |  |  |
| mce_complete | boolean | YES | false |  |
| mce_completed_date | date | YES |  |  |
| snhd_field_docs_submitted_at | timestamptz | YES |  |  |
| snhd_course_completion_submitted_at | timestamptz | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| completed_by | text | YES |  |  |
| snhd_course_completion_submitted_date | date | YES |  |  |
| field_internship_docs_submitted_date | date | YES |  |  |
| closeout_overrides | jsonb | YES | '{}'::jsonb |  |

**Foreign Keys:**
- `preceptor_id` -> `field_preceptors.id` (`student_internships_preceptor_id_fkey`)
- `student_id` -> `students.id` (`student_internships_student_id_fkey`)
- `agency_id` -> `agencies.id` (`student_internships_agency_id_fkey`)
- `cohort_id` -> `cohorts.id` (`student_internships_cohort_id_fkey`)

**Indexes:**
- `idx_internships_agency_date`: `CREATE INDEX idx_internships_agency_date ON public.student_internships USING btree (agency_id, placement_date)`
- `idx_internships_cohort`: `CREATE INDEX idx_internships_cohort ON public.student_internships USING btree (cohort_id)`
- `idx_internships_placement_date`: `CREATE INDEX idx_internships_placement_date ON public.student_internships USING btree (placement_date)`
- `idx_internships_status`: `CREATE INDEX idx_internships_status ON public.student_internships USING btree (status)`
- `idx_internships_student`: `CREATE INDEX idx_internships_student ON public.student_internships USING btree (student_id)`
- `idx_student_internships_closeout_status`: `CREATE INDEX idx_student_internships_closeout_status ON public.student_internships USING btree (closeout_completed, snhd_submitted, cleared_for_nremt)`
- `idx_student_internships_snhd_course_completion`: `CREATE INDEX idx_student_internships_snhd_course_completion ON public.student_internships USING btree (snhd_course_completion_submitted_at)`
- `idx_student_internships_snhd_field_doc`: `CREATE INDEX idx_student_internships_snhd_field_doc ON public.student_internships USING btree (snhd_field_docs_submitted_at)`
- `idx_student_internships_snhd_submitted`: `CREATE INDEX idx_student_internships_snhd_submitted ON public.student_internships USING btree (snhd_submitted) WHERE (snhd_submitted = true)`

**RLS Policies:**
- `Allow all access to internships` (ALL, permissive, roles: {public})
- `Allow read access to internships` (SELECT, permissive, roles: {public})

#### `student_lab_ratings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| lab_day_id | uuid | NO |  |  |
| instructor_email | text | NO |  |  |
| rating | integer | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`student_lab_ratings_lab_day_id_fkey`)
- `student_id` -> `students.id` (`student_lab_ratings_student_id_fkey`)

**Unique Constraints:**
- `student_lab_ratings_student_id_lab_day_id_instructor_email_key`: (lab_day_id, student_id, instructor_email)

**Check Constraints:**
- `student_lab_ratings_rating_check`: `((rating >= 1) AND (rating <= 5))`

**Indexes:**
- `idx_student_lab_ratings_instructor`: `CREATE INDEX idx_student_lab_ratings_instructor ON public.student_lab_ratings USING btree (instructor_email)`
- `idx_student_lab_ratings_lab_day`: `CREATE INDEX idx_student_lab_ratings_lab_day ON public.student_lab_ratings USING btree (lab_day_id)`
- `idx_student_lab_ratings_student`: `CREATE INDEX idx_student_lab_ratings_student ON public.student_lab_ratings USING btree (student_id)`
- `student_lab_ratings_student_id_lab_day_id_instructor_email_key`: `CREATE UNIQUE INDEX student_lab_ratings_student_id_lab_day_id_instructor_email_key ON public.student_lab_ratings USING btree (student_id, lab_day_id, instructor_email)`

**RLS Policies:**
- `Service role full access` (ALL, permissive, roles: {public})

#### `student_lab_signups`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| student_id | uuid | NO |  |  |
| status | text | YES | 'confirmed'::text |  |
| waitlist_position | integer | YES |  |  |
| signed_up_at | timestamptz | YES | now() |  |
| cancelled_at | timestamptz | YES |  |  |
| cancel_reason | text | YES |  |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`student_lab_signups_lab_day_id_fkey`)
- `student_id` -> `students.id` (`student_lab_signups_student_id_fkey`)

**Unique Constraints:**
- `student_lab_signups_lab_day_id_student_id_key`: (lab_day_id, student_id)

**Check Constraints:**
- `student_lab_signups_status_check`: `(status = ANY (ARRAY['confirmed'::text, 'waitlisted'::text, 'cancelled'::text]))`

**Indexes:**
- `idx_student_lab_signups_lab`: `CREATE INDEX idx_student_lab_signups_lab ON public.student_lab_signups USING btree (lab_day_id)`
- `idx_student_lab_signups_status`: `CREATE INDEX idx_student_lab_signups_status ON public.student_lab_signups USING btree (status)`
- `idx_student_lab_signups_student`: `CREATE INDEX idx_student_lab_signups_student ON public.student_lab_signups USING btree (student_id)`
- `student_lab_signups_lab_day_id_student_id_key`: `CREATE UNIQUE INDEX student_lab_signups_lab_day_id_student_id_key ON public.student_lab_signups USING btree (lab_day_id, student_id)`

**RLS Policies:**
- `student_lab_signups_delete_policy` (DELETE, permissive, roles: {public})
- `student_lab_signups_insert_policy` (INSERT, permissive, roles: {public})
- `student_lab_signups_select_policy` (SELECT, permissive, roles: {public})
- `student_lab_signups_update_policy` (UPDATE, permissive, roles: {public})

#### `student_mce_clearance`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| mce_provider | text | YES | 'Platinum Planner'::text |  |
| modules_required | integer | YES | 0 |  |
| modules_completed | integer | YES | 0 |  |
| clearance_status | text | YES | 'not_started'::text |  |
| clearance_date | timestamptz | YES |  |  |
| cleared_by | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_mce_clearance_student_id_fkey`)

**Unique Constraints:**
- `student_mce_clearance_student_id_key`: (student_id)

**Check Constraints:**
- `student_mce_clearance_clearance_status_check`: `(clearance_status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'submitted'::text, 'cleared'::text]))`

**Indexes:**
- `idx_mce_clearance_status`: `CREATE INDEX idx_mce_clearance_status ON public.student_mce_clearance USING btree (clearance_status)`
- `idx_mce_clearance_student`: `CREATE INDEX idx_mce_clearance_student ON public.student_mce_clearance USING btree (student_id)`
- `student_mce_clearance_student_id_key`: `CREATE UNIQUE INDEX student_mce_clearance_student_id_key ON public.student_mce_clearance USING btree (student_id)`

**RLS Policies:**
- `Authenticated users can view mce clearance` (SELECT, permissive, roles: {public})
- `Service role can manage mce clearance` (ALL, permissive, roles: {public})

#### `student_mce_modules`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| bg_check | boolean | YES | false |  |
| drug_test | boolean | YES | false |  |
| physical | boolean | YES | false |  |
| insurance | boolean | YES | false |  |
| photo | boolean | YES | false |  |
| tb | boolean | YES | false |  |
| mmr | boolean | YES | false |  |
| flu | boolean | YES | false |  |
| hep_b | boolean | YES | false |  |
| tdap | boolean | YES | false |  |
| vzv | boolean | YES | false |  |
| covid | boolean | YES | false |  |
| bls | boolean | YES | false |  |
| confidentiality | boolean | YES | false |  |
| flu_declination | boolean | YES | false |  |
| hep_b_declination | boolean | YES | false |  |
| mmr_declination | boolean | YES | false |  |
| tdap_declination | boolean | YES | false |  |
| vzv_declination | boolean | YES | false |  |
| cultural_competency | boolean | YES | false |  |
| parking | boolean | YES | false |  |
| eta_module | boolean | YES | false |  |
| attestation_lgs | boolean | YES | false |  |
| wpvp | boolean | YES | false |  |
| orientation | boolean | YES | false |  |
| conduct | boolean | YES | false |  |
| all_complete | boolean | YES | false |  |
| completion_date | date | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_mce_modules_student_id_fkey`)
- `cohort_id` -> `cohorts.id` (`student_mce_modules_cohort_id_fkey`)

**Indexes:**
- `idx_mce_modules_cohort`: `CREATE INDEX idx_mce_modules_cohort ON public.student_mce_modules USING btree (cohort_id)`
- `idx_mce_modules_student`: `CREATE INDEX idx_mce_modules_student ON public.student_mce_modules USING btree (student_id)`

**RLS Policies:**
- `Allow all access to mce_modules` (ALL, permissive, roles: {public})

#### `student_milestones`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| milestone_type | text | NO |  |  |
| milestone_name | text | NO |  |  |
| semester | integer | YES |  |  |
| status | text | YES | 'complete'::text |  |
| completed_date | date | YES |  |  |
| expiration_date | date | YES |  |  |
| recorded_by | uuid | YES |  |  |
| recorded_at | timestamptz | YES | now() |  |
| auto_recorded | boolean | YES | false |  |
| notes | text | YES |  |  |
| metadata | jsonb | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`student_milestones_student_id_fkey`)

**Indexes:**
- `idx_milestones_completed`: `CREATE INDEX idx_milestones_completed ON public.student_milestones USING btree (completed_date)`
- `idx_milestones_semester`: `CREATE INDEX idx_milestones_semester ON public.student_milestones USING btree (semester)`
- `idx_milestones_student`: `CREATE INDEX idx_milestones_student ON public.student_milestones USING btree (student_id)`
- `idx_milestones_type`: `CREATE INDEX idx_milestones_type ON public.student_milestones USING btree (milestone_type)`

**RLS Policies:**
- `Allow all access to milestones` (ALL, permissive, roles: {public})

#### `student_preceptor_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| internship_id | uuid | NO |  |  |
| preceptor_id | uuid | NO |  |  |
| role | text | NO | 'primary'::text |  |
| assigned_date | date | YES | CURRENT_DATE |  |
| end_date | date | YES |  |  |
| is_active | boolean | YES | true |  |
| notes | text | YES |  |  |
| assigned_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| created_by | text | YES |  |  |
| updated_at | timestamptz | YES | now() |  |
| start_date | date | YES | CURRENT_DATE |  |

**Foreign Keys:**
- `internship_id` -> `student_internships.id` (`student_preceptor_assignments_internship_id_fkey`)
- `preceptor_id` -> `field_preceptors.id` (`student_preceptor_assignments_preceptor_id_fkey`)

**Unique Constraints:**
- `student_preceptor_assignments_internship_id_preceptor_id_ro_key`: (internship_id, role, preceptor_id)

**Indexes:**
- `idx_preceptor_assignments_active`: `CREATE INDEX idx_preceptor_assignments_active ON public.student_preceptor_assignments USING btree (is_active) WHERE (is_active = true)`
- `idx_preceptor_assignments_internship`: `CREATE INDEX idx_preceptor_assignments_internship ON public.student_preceptor_assignments USING btree (internship_id)`
- `idx_preceptor_assignments_preceptor`: `CREATE INDEX idx_preceptor_assignments_preceptor ON public.student_preceptor_assignments USING btree (preceptor_id)`
- `idx_preceptor_assignments_role`: `CREATE INDEX idx_preceptor_assignments_role ON public.student_preceptor_assignments USING btree (role)`
- `student_preceptor_assignments_internship_id_preceptor_id_ro_key`: `CREATE UNIQUE INDEX student_preceptor_assignments_internship_id_preceptor_id_ro_key ON public.student_preceptor_assignments USING btree (internship_id, preceptor_id, role)`

**RLS Policies:**
- `Users delete preceptor assignments` (DELETE, permissive, roles: {authenticated})
- `Users insert preceptor assignments` (INSERT, permissive, roles: {authenticated})
- `Users see preceptor assignments` (SELECT, permissive, roles: {authenticated})
- `Users update preceptor assignments` (UPDATE, permissive, roles: {authenticated})

#### `student_scenario_summary`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| student_id | uuid | YES |  |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| role | text | YES |  |  |
| role_count | bigint | YES |  |  |
| last_date | date | YES |  |  |

#### `student_skill_evaluations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| skill_sheet_id | uuid | NO |  |  |
| lab_day_id | uuid | YES |  |  |
| evaluation_type | text | NO |  |  |
| result | text | NO |  |  |
| evaluator_id | uuid | NO |  |  |
| notes | text | YES |  |  |
| flagged_items | jsonb | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`student_skill_evaluations_lab_day_id_fkey`)
- `evaluator_id` -> `lab_users.id` (`student_skill_evaluations_evaluator_id_fkey`)
- `student_id` -> `students.id` (`student_skill_evaluations_student_id_fkey`)
- `skill_sheet_id` -> `skill_sheets.id` (`student_skill_evaluations_skill_sheet_id_fkey`)

**Check Constraints:**
- `student_skill_evaluations_result_check`: `(result = ANY (ARRAY['pass'::text, 'fail'::text, 'remediation'::text]))`
- `student_skill_evaluations_evaluation_type_check`: `(evaluation_type = ANY (ARRAY['formative'::text, 'final_competency'::text]))`

**Indexes:**
- `idx_eval_sheet`: `CREATE INDEX idx_eval_sheet ON public.student_skill_evaluations USING btree (skill_sheet_id)`
- `idx_eval_student`: `CREATE INDEX idx_eval_student ON public.student_skill_evaluations USING btree (student_id)`

**RLS Policies:**
- `Authenticated users can view student_skill_evaluations` (SELECT, permissive, roles: {public})
- `Service role can do anything on student_skill_evaluations` (ALL, permissive, roles: {public})

#### `student_task_status`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_task_id | uuid | YES |  |  |
| status | text | YES | 'pending'::text |  |
| completed_at | timestamptz | YES |  |  |
| completed_by | uuid | YES |  |  |
| auto_completed | boolean | YES | false |  |
| manually_set | boolean | YES | false |  |
| waived_reason | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_task_id` -> `cohort_tasks.id` (`student_task_status_cohort_task_id_fkey`)
- `completed_by` -> `lab_users.id` (`student_task_status_completed_by_fkey`)
- `student_id` -> `students.id` (`student_task_status_student_id_fkey`)

**Unique Constraints:**
- `student_task_status_student_id_cohort_task_id_key`: (cohort_task_id, student_id)

**Indexes:**
- `idx_student_task_status_status`: `CREATE INDEX idx_student_task_status_status ON public.student_task_status USING btree (status)`
- `idx_student_task_status_student`: `CREATE INDEX idx_student_task_status_student ON public.student_task_status USING btree (student_id)`
- `idx_student_task_status_task`: `CREATE INDEX idx_student_task_status_task ON public.student_task_status USING btree (cohort_task_id)`
- `student_task_status_student_id_cohort_task_id_key`: `CREATE UNIQUE INDEX student_task_status_student_id_cohort_task_id_key ON public.student_task_status USING btree (student_id, cohort_task_id)`

**RLS Policies:**
- `Allow all access to student_task_status` (ALL, permissive, roles: {public})

#### `student_clinical_hours`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| hospital_orientation_hours | numeric | YES | 0 |  |
| hospital_orientation_complete | boolean | YES | false |  |
| psych_shifts | integer | YES | 0 |  |
| psych_hours | numeric | YES | 0 |  |
| cardiology_shifts | integer | YES | 0 |  |
| cardiology_hours | numeric | YES | 0 |  |
| ed_shifts | integer | YES | 0 |  |
| ed_hours | numeric | YES | 0 |  |
| ems_field_shifts | integer | YES | 0 |  |
| ems_field_hours | numeric | YES | 0 |  |
| icu_shifts | integer | YES | 0 |  |
| icu_hours | numeric | YES | 0 |  |
| ob_shifts | integer | YES | 0 |  |
| ob_hours | numeric | YES | 0 |  |
| or_shifts | integer | YES | 0 |  |
| or_hours | numeric | YES | 0 |  |
| peds_ed_shifts | integer | YES | 0 |  |
| peds_ed_hours | numeric | YES | 0 |  |
| peds_icu_shifts | integer | YES | 0 |  |
| peds_icu_hours | numeric | YES | 0 |  |
| total_shifts | integer | YES | 0 |  |
| total_hours | numeric | YES | 0 |  |
| mulligan_notes | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| ems_hours | integer | YES | 0 |  |
| ems_ridealong_hours | numeric | YES | 0 |  |
| ems_ridealong_shifts | integer | YES | 0 |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`student_clinical_hours_cohort_id_fkey`)
- `student_id` -> `students.id` (`student_clinical_hours_student_id_fkey`)

**Indexes:**
- `idx_clinical_hours_cohort`: `CREATE INDEX idx_clinical_hours_cohort ON public.student_clinical_hours USING btree (cohort_id)`
- `idx_clinical_hours_student`: `CREATE INDEX idx_clinical_hours_student ON public.student_clinical_hours USING btree (student_id)`
- `idx_student_clinical_hours_cohort`: `CREATE INDEX idx_student_clinical_hours_cohort ON public.student_clinical_hours USING btree (cohort_id)`
- `idx_student_clinical_hours_student`: `CREATE INDEX idx_student_clinical_hours_student ON public.student_clinical_hours USING btree (student_id)`

**RLS Policies:**
- `Allow all access to clinical_hours` (ALL, permissive, roles: {public})

#### `ungrouped_students`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| student_id | uuid | YES |  |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| photo_url | text | YES |  |  |
| cohort_id | uuid | YES |  |  |
| cohort_number | integer | YES |  |  |
| program | text | YES |  |  |

### Lab Management

#### `lab_days`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| date | date | NO |  |  |
| cohort_id | uuid | NO |  |  |
| semester | integer | YES |  |  |
| week_number | integer | YES |  |  |
| day_number | integer | YES |  |  |
| num_rotations | integer | YES | 4 |  |
| rotation_duration | integer | YES | 30 |  |
| notes | text | YES |  |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| title | varchar(255) | YES |  |  |
| start_time | time without time zone | YES |  |  |
| end_time | time without time zone | YES |  |  |
| assigned_timer_id | uuid | YES |  |  |
| needs_coverage | boolean | YES | false |  |
| coverage_needed | integer | YES | 0 |  |
| coverage_note | text | YES |  |  |
| source_template_id | uuid | YES |  |  |
| checkin_token | text | YES |  |  |
| checkin_enabled | boolean | YES | false |  |

**Foreign Keys:**
- `created_by` -> `lab_users.id` (`lab_days_created_by_fkey`)
- `source_template_id` -> `lab_day_templates.id` (`lab_days_source_template_id_fkey`)
- `cohort_id` -> `cohorts.id` (`lab_days_cohort_id_fkey`)
- `assigned_timer_id` -> `timer_display_tokens.id` (`lab_days_assigned_timer_id_fkey`)

**Unique Constraints:**
- `lab_days_checkin_token_key`: (checkin_token)
- `lab_days_date_cohort_id_key`: (date, cohort_id)

**Indexes:**
- `idx_lab_days_assigned_timer`: `CREATE INDEX idx_lab_days_assigned_timer ON public.lab_days USING btree (assigned_timer_id)`
- `idx_lab_days_checkin_token`: `CREATE UNIQUE INDEX idx_lab_days_checkin_token ON public.lab_days USING btree (checkin_token) WHERE (checkin_token IS NOT NULL)`
- `idx_lab_days_cohort`: `CREATE INDEX idx_lab_days_cohort ON public.lab_days USING btree (cohort_id)`
- `idx_lab_days_cohort_date`: `CREATE INDEX idx_lab_days_cohort_date ON public.lab_days USING btree (cohort_id, date)`
- `idx_lab_days_cohort_id`: `CREATE INDEX idx_lab_days_cohort_id ON public.lab_days USING btree (cohort_id)`
- `idx_lab_days_date`: `CREATE INDEX idx_lab_days_date ON public.lab_days USING btree (date)`
- `idx_lab_days_date_cohort`: `CREATE INDEX idx_lab_days_date_cohort ON public.lab_days USING btree (date, cohort_id)`
- `idx_lab_days_needs_coverage`: `CREATE INDEX idx_lab_days_needs_coverage ON public.lab_days USING btree (needs_coverage) WHERE (needs_coverage = true)`
- `idx_lab_days_semester`: `CREATE INDEX idx_lab_days_semester ON public.lab_days USING btree (semester)`
- `idx_lab_days_source_template`: `CREATE INDEX idx_lab_days_source_template ON public.lab_days USING btree (source_template_id) WHERE (source_template_id IS NOT NULL)`
- `lab_days_checkin_token_key`: `CREATE UNIQUE INDEX lab_days_checkin_token_key ON public.lab_days USING btree (checkin_token)`
- `lab_days_date_cohort_id_key`: `CREATE UNIQUE INDEX lab_days_date_cohort_id_key ON public.lab_days USING btree (date, cohort_id)`

**RLS Policies:**
- `Allow all for lab_days` (ALL, permissive, roles: {public})

#### `lab_stations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| lab_day_id | uuid | NO |  |  |
| station_number | integer | NO |  |  |
| scenario_id | uuid | YES |  |  |
| skill_name | text | YES |  |  |
| custom_title | text | YES |  |  |
| station_details | text | YES |  |  |
| instructor_id | uuid | YES |  |  |
| additional_instructor_id | uuid | YES |  |  |
| location | text | YES |  |  |
| equipment_needed | text | YES |  |  |
| documentation_required | boolean | YES | false |  |
| platinum_required | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |
| instructor_name | text | YES |  |  |
| instructor_email | text | YES |  |  |
| room | text | YES |  |  |
| rotation_minutes | integer | YES | 30 |  |
| num_rotations | integer | YES | 4 |  |
| station_type | text | YES | 'scenario'::text |  |
| notes | text | YES |  |  |
| skill_sheet_url | text | YES |  |  |
| instructions_url | text | YES |  |  |
| station_notes | text | YES |  |  |
| metadata | jsonb | YES |  |  |
| drill_ids | text[] | YES | '{}'::uuid[] |  |

**Foreign Keys:**
- `scenario_id` -> `scenarios.id` (`lab_stations_scenario_id_fkey`)
- `instructor_id` -> `lab_users.id` (`lab_stations_instructor_id_fkey`)
- `additional_instructor_id` -> `lab_users.id` (`lab_stations_additional_instructor_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`lab_stations_lab_day_id_fkey`)

**Indexes:**
- `idx_lab_stations_instructor`: `CREATE INDEX idx_lab_stations_instructor ON public.lab_stations USING btree (instructor_email)`
- `idx_lab_stations_lab_day`: `CREATE INDEX idx_lab_stations_lab_day ON public.lab_stations USING btree (lab_day_id)`
- `idx_lab_stations_lab_day_id`: `CREATE INDEX idx_lab_stations_lab_day_id ON public.lab_stations USING btree (lab_day_id)`
- `idx_lab_stations_metadata`: `CREATE INDEX idx_lab_stations_metadata ON public.lab_stations USING gin (metadata)`

**RLS Policies:**
- `Allow all for lab_stations` (ALL, permissive, roles: {public})

#### `lab_day_roles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | YES |  |  |
| instructor_id | uuid | YES |  |  |
| role | text | NO |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_day_roles_lab_day_id_fkey`)
- `instructor_id` -> `lab_users.id` (`lab_day_roles_instructor_id_fkey`)

**Unique Constraints:**
- `lab_day_roles_lab_day_id_instructor_id_role_key`: (role, instructor_id, lab_day_id)

**Check Constraints:**
- `lab_day_roles_role_check`: `(role = ANY (ARRAY['lab_lead'::text, 'roamer'::text, 'observer'::text]))`

**Indexes:**
- `idx_lab_day_roles_instructor`: `CREATE INDEX idx_lab_day_roles_instructor ON public.lab_day_roles USING btree (instructor_id)`
- `idx_lab_day_roles_lab`: `CREATE INDEX idx_lab_day_roles_lab ON public.lab_day_roles USING btree (lab_day_id)`
- `lab_day_roles_lab_day_id_instructor_id_role_key`: `CREATE UNIQUE INDEX lab_day_roles_lab_day_id_instructor_id_role_key ON public.lab_day_roles USING btree (lab_day_id, instructor_id, role)`

**RLS Policies:**
- `Authenticated users can manage lab day roles` (ALL, permissive, roles: {public})
- `lab_day_roles_delete_policy` (DELETE, permissive, roles: {public})
- `lab_day_roles_insert_policy` (INSERT, permissive, roles: {public})
- `lab_day_roles_select_policy` (SELECT, permissive, roles: {public})
- `lab_day_roles_update_policy` (UPDATE, permissive, roles: {public})

#### `scenarios`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| title | text | NO |  |  |
| applicable_programs | text[] | YES | ARRAY['EMT'::text, 'AEMT'::text, 'Paramedic'::text] |  |
| category | text | NO |  |  |
| subcategory | text | YES |  |  |
| difficulty | text | YES | 'intermediate'::text |  |
| dispatch_time | text | YES |  |  |
| dispatch_location | text | YES |  |  |
| chief_complaint | text | YES |  |  |
| dispatch_notes | text | YES |  |  |
| patient_name | text | YES |  |  |
| patient_age | integer | YES |  |  |
| patient_sex | text | YES |  |  |
| patient_weight | text | YES |  |  |
| medical_history | text[] | YES |  |  |
| medications | text[] | YES |  |  |
| allergies | text | YES |  |  |
| general_impression | text | YES |  |  |
| environment_notes | text | YES |  |  |
| assessment_x | text | YES |  |  |
| assessment_a | text | YES |  |  |
| assessment_b | text | YES |  |  |
| assessment_c | text | YES |  |  |
| assessment_d | text | YES |  |  |
| assessment_e | text | YES |  |  |
| avpu | text | YES |  |  |
| initial_vitals | jsonb | YES |  | Vitals: { bp, pulse, hr, resp, rr, spo2, etco2, temp, glucose, blood_glucose, gcs, gcs_total, gcs_e, gcs_v, gcs_m, pupils, skin, loc, pain, ekg_rhythm, twelve_lead_notes, lung_sounds, lung_notes, jvd, edema, capillary_refill, pulse_quality, notes, other_findings[] } |
| sample_history | jsonb | YES |  | SAMPLE: { signs_symptoms, allergies, medications, past_history, last_oral_intake, events } |
| opqrst | jsonb | YES |  | OPQRST: { onset, provocation, quality, radiation, severity, time } |
| phases | jsonb | YES |  | ScenarioPhase[]: { phase_number, title, trigger?, description, vitals?, patient_response?, expected_actions?, duration_minutes? } |
| learning_objectives | text[] | YES |  |  |
| critical_actions | text[] | YES |  |  |
| debrief_points | text[] | YES |  |  |
| instructor_notes | text | YES |  |  |
| equipment_needed | text[] | YES |  |  |
| medications_to_administer | text[] | YES |  |  |
| estimated_duration | integer | YES |  |  |
| documentation_required | boolean | YES | false |  |
| platinum_required | boolean | YES | false |  |
| created_by | uuid | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| patient_presentation | text | YES |  |  |
| history | text | YES |  |  |
| vitals | jsonb | YES |  |  |
| expected_interventions | text[] | YES |  |  |
| gcs | text | YES |  |  |
| pupils | text | YES |  |  |
| secondary_survey | jsonb | YES |  |  |
| ekg_findings | jsonb | YES |  |  |
| legacy_data | jsonb | YES |  |  |
| ai_generated_fields | text[] | YES | '{}'::text[] |  |
| content_review_status | text | YES | 'approved'::text |  |

**Foreign Keys:**
- `created_by` -> `lab_users.id` (`scenarios_created_by_fkey`)

**Check Constraints:**
- `scenarios_content_review_status_check`: `(content_review_status = ANY (ARRAY['approved'::text, 'pending_review'::text, 'rejected'::text]))`
- `scenarios_difficulty_check`: `(difficulty = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))`

**Indexes:**
- `idx_scenarios_active`: `CREATE INDEX idx_scenarios_active ON public.scenarios USING btree (is_active) WHERE (is_active = true)`
- `idx_scenarios_active_category`: `CREATE INDEX idx_scenarios_active_category ON public.scenarios USING btree (category, difficulty) WHERE (is_active = true)`
- `idx_scenarios_category`: `CREATE INDEX idx_scenarios_category ON public.scenarios USING btree (category)`
- `idx_scenarios_difficulty`: `CREATE INDEX idx_scenarios_difficulty ON public.scenarios USING btree (difficulty)`
- `idx_scenarios_ekg`: `CREATE INDEX idx_scenarios_ekg ON public.scenarios USING gin (ekg_findings) WHERE ((ekg_findings IS NOT NULL) AND (ekg_findings <> '{}'::jsonb))`
- `idx_scenarios_equipment_needed`: `CREATE INDEX idx_scenarios_equipment_needed ON public.scenarios USING gin (equipment_needed) WHERE ((equipment_needed IS NOT NULL) AND (array_length(equipment_needed, 1) > 0))`
- `idx_scenarios_programs`: `CREATE INDEX idx_scenarios_programs ON public.scenarios USING gin (applicable_programs)`
- `idx_scenarios_review_status`: `CREATE INDEX idx_scenarios_review_status ON public.scenarios USING btree (content_review_status)`

**RLS Policies:**
- `Allow all for scenarios` (ALL, permissive, roles: {public})

#### `scenario_assessments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| lab_station_id | uuid | NO |  |  |
| lab_day_id | uuid | NO |  |  |
| cohort_id | uuid | NO |  |  |
| rotation_number | integer | YES |  |  |
| assessment_score | integer | YES |  |  |
| treatment_score | integer | YES |  |  |
| communication_score | integer | YES |  |  |
| team_lead_id | uuid | YES |  |  |
| team_lead_issues | text | YES |  |  |
| skills_performed | text[] | YES |  |  |
| comments | text | YES |  |  |
| graded_by | uuid | YES |  |  |
| assessed_at | timestamptz | YES | now() |  |
| created_at | timestamptz | YES | now() |  |
| lab_group_id | uuid | YES |  |  |
| station_id | uuid | YES |  |  |
| criteria_ratings | jsonb | YES | '[]'::jsonb |  |
| critical_actions_completed | jsonb | YES | '{}'::jsonb |  |
| satisfactory_count | integer | YES | 0 |  |
| phase1_pass | boolean | YES | false |  |
| phase2_pass | boolean | YES | false |  |
| overall_comments | text | YES |  |  |
| issue_level | text | YES | 'none'::text |  |
| flag_categories | text[] | YES |  |  |
| flagged_for_review | boolean | YES | false |  |
| flag_resolved | boolean | YES | false |  |
| flag_resolution_notes | text | YES |  |  |
| flag_resolved_by | uuid | YES |  |  |
| flag_resolved_at | timestamptz | YES |  |  |
| overall_score | integer | YES |  |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`scenario_assessments_cohort_id_fkey`)
- `lab_group_id` -> `lab_groups.id` (`scenario_assessments_lab_group_id_fkey`)
- `team_lead_id` -> `students.id` (`scenario_assessments_team_lead_id_fkey`)
- `lab_station_id` -> `lab_stations.id` (`scenario_assessments_lab_station_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`scenario_assessments_lab_day_id_fkey`)
- `station_id` -> `lab_stations.id` (`scenario_assessments_station_id_fkey`)
- `graded_by` -> `lab_users.id` (`scenario_assessments_graded_by_fkey`)

**Check Constraints:**
- `scenario_assessments_communication_score_check`: `((communication_score >= 0) AND (communication_score <= 4))`
- `scenario_assessments_treatment_score_check`: `((treatment_score >= 0) AND (treatment_score <= 4))`
- `scenario_assessments_assessment_score_check`: `((assessment_score >= 0) AND (assessment_score <= 4))`

**Indexes:**
- `idx_scenario_assessments_cohort`: `CREATE INDEX idx_scenario_assessments_cohort ON public.scenario_assessments USING btree (cohort_id)`
- `idx_scenario_assessments_date`: `CREATE INDEX idx_scenario_assessments_date ON public.scenario_assessments USING btree (created_at)`
- `idx_scenario_assessments_flagged`: `CREATE INDEX idx_scenario_assessments_flagged ON public.scenario_assessments USING btree (flagged_for_review) WHERE (flagged_for_review = true)`
- `idx_scenario_assessments_group`: `CREATE INDEX idx_scenario_assessments_group ON public.scenario_assessments USING btree (lab_group_id)`
- `idx_scenario_assessments_issue_level`: `CREATE INDEX idx_scenario_assessments_issue_level ON public.scenario_assessments USING btree (issue_level) WHERE (issue_level <> 'none'::text)`
- `idx_scenario_assessments_lab_day`: `CREATE INDEX idx_scenario_assessments_lab_day ON public.scenario_assessments USING btree (lab_day_id)`
- `idx_scenario_assessments_station`: `CREATE INDEX idx_scenario_assessments_station ON public.scenario_assessments USING btree (lab_station_id)`
- `idx_scenario_assessments_team_lead`: `CREATE INDEX idx_scenario_assessments_team_lead ON public.scenario_assessments USING btree (team_lead_id)`

**RLS Policies:**
- `Allow all for scenario_assessments` (ALL, permissive, roles: {public})
- `Allow insert for authenticated` (INSERT, permissive, roles: {authenticated})

#### `skill_assessments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| lab_station_id | uuid | NO |  |  |
| lab_day_id | uuid | NO |  |  |
| skill_name | text | NO |  |  |
| student_id | uuid | NO |  |  |
| cohort_id | uuid | NO |  |  |
| preparation_safety | integer | YES |  |  |
| technical_performance | integer | YES |  |  |
| critical_thinking | integer | YES |  |  |
| time_management | integer | YES |  |  |
| overall_competency | integer | YES |  |  |
| narrative_feedback | text | YES |  |  |
| graded_by | uuid | YES |  |  |
| assessed_at | timestamptz | YES | now() |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`skill_assessments_cohort_id_fkey`)
- `lab_station_id` -> `lab_stations.id` (`skill_assessments_lab_station_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`skill_assessments_lab_day_id_fkey`)
- `student_id` -> `students.id` (`skill_assessments_student_id_fkey`)
- `graded_by` -> `lab_users.id` (`skill_assessments_graded_by_fkey`)

**Check Constraints:**
- `skill_assessments_overall_competency_check`: `((overall_competency >= 1) AND (overall_competency <= 5))`
- `skill_assessments_critical_thinking_check`: `((critical_thinking >= 1) AND (critical_thinking <= 5))`
- `skill_assessments_technical_performance_check`: `((technical_performance >= 1) AND (technical_performance <= 5))`
- `skill_assessments_preparation_safety_check`: `((preparation_safety >= 1) AND (preparation_safety <= 5))`
- `skill_assessments_time_management_check`: `((time_management >= 1) AND (time_management <= 5))`

**Indexes:**
- `idx_skill_assessments_station`: `CREATE INDEX idx_skill_assessments_station ON public.skill_assessments USING btree (lab_station_id)`
- `idx_skill_assessments_student`: `CREATE INDEX idx_skill_assessments_student ON public.skill_assessments USING btree (student_id)`

**RLS Policies:**
- `Allow all for skill_assessments` (ALL, permissive, roles: {public})

#### `assessment_rubrics`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| rating_scale | text | YES | 'numeric_5'::text |  |
| is_active | boolean | YES | true |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `assessment_rubrics_rating_scale_check`: `(rating_scale = ANY (ARRAY['numeric_5'::text, 'pass_fail'::text, 'qualitative_4'::text]))`

#### `canonical_skills`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| canonical_name | text | NO |  |  |
| skill_category | text | NO |  |  |
| programs | text[] | NO |  |  |
| scope_notes | text | YES |  |  |
| paramedic_only | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `canonical_skills_canonical_name_key`: (canonical_name)

**Check Constraints:**
- `canonical_skills_skill_category_check`: `(skill_category = ANY (ARRAY['airway'::text, 'vascular_access'::text, 'medication'::text, 'assessment'::text, 'cardiac'::text, 'trauma'::text, 'immobilization'::text, 'obstetrics'::text, 'pediatric'::text, 'movement'::text]))`

**Indexes:**
- `canonical_skills_canonical_name_key`: `CREATE UNIQUE INDEX canonical_skills_canonical_name_key ON public.canonical_skills USING btree (canonical_name)`

**RLS Policies:**
- `Authenticated users can view canonical_skills` (SELECT, permissive, roles: {public})
- `Service role can do anything on canonical_skills` (ALL, permissive, roles: {public})

#### `custom_skills`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| station_id | uuid | NO |  |  |
| name | text | NO |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `station_id` -> `lab_stations.id` (`custom_skills_station_id_fkey`)

**Indexes:**
- `idx_custom_skills_station`: `CREATE INDEX idx_custom_skills_station ON public.custom_skills USING btree (station_id)`

**RLS Policies:**
- `Allow all access to custom_skills` (ALL, permissive, roles: {public})
- `Allow all for custom_skills` (ALL, permissive, roles: {public})

#### `lab_checklist_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| station_type | text | NO |  |  |
| items | jsonb | NO | '[]'::jsonb |  |
| is_default | boolean | YES | false |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_checklist_templates_default`: `CREATE INDEX idx_checklist_templates_default ON public.lab_checklist_templates USING btree (station_type, is_default) WHERE (is_default = true)`
- `idx_checklist_templates_station_type`: `CREATE INDEX idx_checklist_templates_station_type ON public.lab_checklist_templates USING btree (station_type)`

**RLS Policies:**
- `Authenticated users can read checklist templates` (SELECT, permissive, roles: {public})
- `Instructors can manage checklist templates` (ALL, permissive, roles: {public})

#### `lab_day_attendance`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| student_id | uuid | NO |  |  |
| status | text | NO |  |  |
| notes | text | YES |  |  |
| recorded_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| marked_by | text | YES |  |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_day_attendance_lab_day_id_fkey`)
- `student_id` -> `students.id` (`lab_day_attendance_student_id_fkey`)

**Unique Constraints:**
- `lab_day_attendance_lab_day_id_student_id_key`: (student_id, lab_day_id)

**Check Constraints:**
- `lab_day_attendance_status_check`: `(status = ANY (ARRAY['present'::text, 'absent'::text, 'excused'::text, 'late'::text]))`

**Indexes:**
- `idx_attendance_lab_day`: `CREATE INDEX idx_attendance_lab_day ON public.lab_day_attendance USING btree (lab_day_id)`
- `idx_attendance_student`: `CREATE INDEX idx_attendance_student ON public.lab_day_attendance USING btree (student_id)`
- `idx_lab_day_attendance_lab_day`: `CREATE INDEX idx_lab_day_attendance_lab_day ON public.lab_day_attendance USING btree (lab_day_id)`
- `idx_lab_day_attendance_status`: `CREATE INDEX idx_lab_day_attendance_status ON public.lab_day_attendance USING btree (status)`
- `idx_lab_day_attendance_student`: `CREATE INDEX idx_lab_day_attendance_student ON public.lab_day_attendance USING btree (student_id)`
- `lab_day_attendance_lab_day_id_student_id_key`: `CREATE UNIQUE INDEX lab_day_attendance_lab_day_id_student_id_key ON public.lab_day_attendance USING btree (lab_day_id, student_id)`

**RLS Policies:**
- `Instructors can manage attendance` (ALL, permissive, roles: {public})

#### `lab_day_checklist_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| title | text | NO |  |  |
| is_completed | boolean | YES | false |  |
| completed_by | uuid | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| is_auto_generated | boolean | YES | false |  |
| sort_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `completed_by` -> `lab_users.id` (`lab_day_checklist_items_completed_by_fkey`)
- `lab_day_id` -> `lab_days.id` (`lab_day_checklist_items_lab_day_id_fkey`)

**Indexes:**
- `idx_checklist_lab_day`: `CREATE INDEX idx_checklist_lab_day ON public.lab_day_checklist_items USING btree (lab_day_id)`

**RLS Policies:**
- `Authenticated users can manage checklists` (ALL, permissive, roles: {public})

#### `lab_day_checklists`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| item_text | text | NO |  |  |
| is_completed | boolean | YES | false |  |
| completed_by | text | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| sort_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_day_checklists_lab_day_id_fkey`)

**Indexes:**
- `idx_lab_day_checklists_lab_day`: `CREATE INDEX idx_lab_day_checklists_lab_day ON public.lab_day_checklists USING btree (lab_day_id)`

**RLS Policies:**
- `Allow all for authenticated` (ALL, permissive, roles: {public})

#### `lab_day_costs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| category | text | NO |  |  |
| description | text | NO |  |  |
| amount | numeric | NO |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_day_costs_lab_day_id_fkey`)

**Check Constraints:**
- `lab_day_costs_category_check`: `(category = ANY (ARRAY['equipment'::text, 'consumables'::text, 'instructor_pay'::text, 'external'::text, 'other'::text]))`

**Indexes:**
- `idx_lab_day_costs_lab_day`: `CREATE INDEX idx_lab_day_costs_lab_day ON public.lab_day_costs USING btree (lab_day_id)`

#### `lab_day_debriefs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| content | text | YES |  |  |
| author | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_day_debriefs_lab_day_id_fkey`)

**Indexes:**
- `idx_lab_day_debriefs_lab_day`: `CREATE INDEX idx_lab_day_debriefs_lab_day ON public.lab_day_debriefs USING btree (lab_day_id)`

**RLS Policies:**
- `Allow all for authenticated` (ALL, permissive, roles: {public})

#### `lab_day_equipment`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| name | text | NO |  |  |
| quantity | integer | YES | 1 |  |
| status | text | YES | 'needed'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| checked_out_by | text | YES |  |  |
| checked_out_at | timestamptz | YES |  |  |
| returned_by | text | YES |  |  |
| returned_at | timestamptz | YES |  |  |
| condition_notes | text | YES |  |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_day_equipment_lab_day_id_fkey`)

**Indexes:**
- `idx_lab_day_equipment_lab_day`: `CREATE INDEX idx_lab_day_equipment_lab_day ON public.lab_day_equipment USING btree (lab_day_id)`
- `idx_lab_day_equipment_status`: `CREATE INDEX idx_lab_day_equipment_status ON public.lab_day_equipment USING btree (status)`

**RLS Policies:**
- `Allow all for authenticated` (ALL, permissive, roles: {public})
- `Service role has full access to lab_day_equipment` (ALL, permissive, roles: {public})

#### `lab_day_signups`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| student_id | uuid | NO |  |  |
| status | text | YES | 'registered'::text |  |
| registered_at | timestamptz | YES | now() |  |
| cancelled_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_day_signups_lab_day_id_fkey`)
- `student_id` -> `students.id` (`lab_day_signups_student_id_fkey`)

**Unique Constraints:**
- `lab_day_signups_lab_day_id_student_id_key`: (student_id, lab_day_id)

**Check Constraints:**
- `lab_day_signups_status_check`: `(status = ANY (ARRAY['registered'::text, 'waitlisted'::text, 'cancelled'::text]))`

**Indexes:**
- `idx_lab_day_signups_lab`: `CREATE INDEX idx_lab_day_signups_lab ON public.lab_day_signups USING btree (lab_day_id)`
- `idx_lab_day_signups_student`: `CREATE INDEX idx_lab_day_signups_student ON public.lab_day_signups USING btree (student_id)`
- `lab_day_signups_lab_day_id_student_id_key`: `CREATE UNIQUE INDEX lab_day_signups_lab_day_id_student_id_key ON public.lab_day_signups USING btree (lab_day_id, student_id)`

#### `lab_day_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| template_data | jsonb | NO |  |  |
| is_shared | boolean | YES | false |  |
| created_by | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| category | text | YES | 'other'::text |  |
| program | text | YES |  |  |
| semester | integer | YES |  |  |
| week_number | integer | YES |  |  |
| day_number | integer | YES |  |  |
| instructor_count | integer | YES |  |  |
| is_anchor | boolean | YES | false |  |
| anchor_type | text | YES |  |  |
| requires_review | boolean | YES | false |  |
| review_notes | text | YES |  |  |

**Check Constraints:**
- `lab_day_templates_category_check`: `(category = ANY (ARRAY['orientation'::text, 'skills_lab'::text, 'scenario_lab'::text, 'assessment'::text, 'capstone'::text, 'certification'::text, 'mixed'::text, 'other'::text]))`

**Indexes:**
- `idx_lab_day_templates_anchor`: `CREATE INDEX idx_lab_day_templates_anchor ON public.lab_day_templates USING btree (is_anchor) WHERE (is_anchor = true)`
- `idx_lab_day_templates_category`: `CREATE INDEX idx_lab_day_templates_category ON public.lab_day_templates USING btree (category)`
- `idx_lab_day_templates_created_by`: `CREATE INDEX idx_lab_day_templates_created_by ON public.lab_day_templates USING btree (created_by)`
- `idx_lab_day_templates_day`: `CREATE INDEX idx_lab_day_templates_day ON public.lab_day_templates USING btree (day_number)`
- `idx_lab_day_templates_review`: `CREATE INDEX idx_lab_day_templates_review ON public.lab_day_templates USING btree (requires_review) WHERE (requires_review = true)`
- `idx_lab_day_templates_shared`: `CREATE INDEX idx_lab_day_templates_shared ON public.lab_day_templates USING btree (is_shared) WHERE (is_shared = true)`
- `idx_lab_day_templates_updated_at`: `CREATE INDEX idx_lab_day_templates_updated_at ON public.lab_day_templates USING btree (updated_at DESC)`

**RLS Policies:**
- `templates_delete` (DELETE, permissive, roles: {public})
- `templates_insert` (INSERT, permissive, roles: {public})
- `templates_select` (SELECT, permissive, roles: {public})
- `templates_update` (UPDATE, permissive, roles: {public})

#### `lab_equipment_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| name | text | NO |  |  |
| quantity | integer | YES | 1 |  |
| status | text | NO | 'checked_out'::text |  |
| station_id | uuid | YES |  |  |
| notes | text | YES |  |  |
| checked_out_by | uuid | YES |  |  |
| returned_by | uuid | YES |  |  |
| returned_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `station_id` -> `lab_stations.id` (`lab_equipment_items_station_id_fkey`)
- `checked_out_by` -> `lab_users.id` (`lab_equipment_items_checked_out_by_fkey`)
- `returned_by` -> `lab_users.id` (`lab_equipment_items_returned_by_fkey`)
- `lab_day_id` -> `lab_days.id` (`lab_equipment_items_lab_day_id_fkey`)

**Check Constraints:**
- `lab_equipment_items_status_check`: `(status = ANY (ARRAY['checked_out'::text, 'returned'::text, 'damaged'::text, 'missing'::text]))`

**Indexes:**
- `idx_equipment_lab_day`: `CREATE INDEX idx_equipment_lab_day ON public.lab_equipment_items USING btree (lab_day_id)`
- `idx_equipment_status`: `CREATE INDEX idx_equipment_status ON public.lab_equipment_items USING btree (status)`

**RLS Policies:**
- `Authenticated users manage equipment` (ALL, permissive, roles: {public})

#### `lab_equipment_tracking`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| station_id | uuid | YES |  |  |
| item_name | text | NO |  |  |
| quantity | integer | YES | 1 |  |
| status | text | YES | 'checked_out'::text |  |
| notes | text | YES |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `station_id` -> `lab_stations.id` (`lab_equipment_tracking_station_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`lab_equipment_tracking_lab_day_id_fkey`)

**Check Constraints:**
- `lab_equipment_tracking_status_check`: `(status = ANY (ARRAY['checked_out'::text, 'returned'::text, 'damaged'::text, 'missing'::text]))`

**Indexes:**
- `idx_lab_equipment_tracking_lab_day`: `CREATE INDEX idx_lab_equipment_tracking_lab_day ON public.lab_equipment_tracking USING btree (lab_day_id)`

#### `lab_group_assignment_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| group_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| action | text | YES |  |  |
| from_group_id | uuid | YES |  |  |
| to_group_id | uuid | YES |  |  |
| changed_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`lab_group_assignment_history_student_id_fkey`)
- `group_id` -> `lab_groups.id` (`lab_group_assignment_history_group_id_fkey`)

**Check Constraints:**
- `lab_group_assignment_history_action_check`: `(action = ANY (ARRAY['added'::text, 'removed'::text, 'moved'::text]))`

**Indexes:**
- `idx_group_history_group`: `CREATE INDEX idx_group_history_group ON public.lab_group_assignment_history USING btree (group_id)`
- `idx_group_history_student`: `CREATE INDEX idx_group_history_student ON public.lab_group_assignment_history USING btree (student_id)`

#### `lab_group_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| student_id | uuid | NO |  |  |
| from_group_id | uuid | YES |  |  |
| to_group_id | uuid | YES |  |  |
| changed_at | timestamptz | YES | now() |  |
| changed_by | text | YES |  |  |
| reason | text | YES |  |  |

**Foreign Keys:**
- `from_group_id` -> `lab_groups.id` (`lab_group_history_from_group_id_fkey`)
- `to_group_id` -> `lab_groups.id` (`lab_group_history_to_group_id_fkey`)
- `student_id` -> `students.id` (`lab_group_history_student_id_fkey`)

**Indexes:**
- `idx_lab_group_history_date`: `CREATE INDEX idx_lab_group_history_date ON public.lab_group_history USING btree (changed_at)`
- `idx_lab_group_history_student`: `CREATE INDEX idx_lab_group_history_student ON public.lab_group_history USING btree (student_id)`

**RLS Policies:**
- `Allow all for lab_group_history` (ALL, permissive, roles: {public})

#### `lab_group_members`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| lab_group_id | uuid | NO |  |  |
| student_id | uuid | NO |  |  |
| assigned_at | timestamptz | YES | now() |  |
| assigned_by | text | YES |  |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`lab_group_members_student_id_fkey`)
- `lab_group_id` -> `lab_groups.id` (`lab_group_members_lab_group_id_fkey`)

**Unique Constraints:**
- `lab_group_members_student_id_key`: (student_id)

**Indexes:**
- `idx_lab_group_members_group`: `CREATE INDEX idx_lab_group_members_group ON public.lab_group_members USING btree (lab_group_id)`
- `idx_lab_group_members_student`: `CREATE INDEX idx_lab_group_members_student ON public.lab_group_members USING btree (student_id)`
- `lab_group_members_student_id_key`: `CREATE UNIQUE INDEX lab_group_members_student_id_key ON public.lab_group_members USING btree (student_id)`

**RLS Policies:**
- `Allow all for lab_group_members` (ALL, permissive, roles: {public})

#### `lab_group_roster`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| group_id | uuid | YES |  |  |
| group_name | text | YES |  |  |
| cohort_id | uuid | YES |  |  |
| cohort_number | integer | YES |  |  |
| program | text | YES |  |  |
| student_id | uuid | YES |  |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| photo_url | text | YES |  |  |
| assigned_at | timestamptz | YES |  |  |

#### `lab_groups`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| cohort_id | uuid | NO |  |  |
| name | text | NO |  |  |
| display_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| is_locked | boolean | YES | false |  |
| locked_by | text | YES |  |  |
| locked_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`lab_groups_cohort_id_fkey`)

**Indexes:**
- `idx_lab_groups_cohort`: `CREATE INDEX idx_lab_groups_cohort ON public.lab_groups USING btree (cohort_id)`

**RLS Policies:**
- `Allow all for lab_groups` (ALL, permissive, roles: {public})

#### `lab_template_stations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| template_id | uuid | NO |  |  |
| station_type | text | NO |  |  |
| station_name | text | YES |  |  |
| skills | jsonb | YES | '[]'::jsonb |  |
| scenario_id | uuid | YES |  |  |
| sort_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |
| scenario_title | text | YES |  |  |
| difficulty | text | YES |  |  |
| notes | text | YES |  |  |
| metadata | jsonb | YES |  |  |

**Foreign Keys:**
- `template_id` -> `lab_day_templates.id` (`lab_template_stations_template_id_fkey`)

**Indexes:**
- `idx_lab_template_stations_template`: `CREATE INDEX idx_lab_template_stations_template ON public.lab_template_stations USING btree (template_id)`

**RLS Policies:**
- `stations_delete` (DELETE, permissive, roles: {public})
- `stations_insert` (INSERT, permissive, roles: {public})
- `stations_select` (SELECT, permissive, roles: {public})
- `stations_update` (UPDATE, permissive, roles: {public})

#### `lab_template_versions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| template_id | uuid | NO |  |  |
| version_number | integer | NO | 1 |  |
| snapshot | jsonb | NO |  |  |
| change_summary | text | YES |  |  |
| source_lab_day_id | uuid | YES |  |  |
| created_by | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `template_id` -> `lab_day_templates.id` (`lab_template_versions_template_id_fkey`)
- `source_lab_day_id` -> `lab_days.id` (`lab_template_versions_source_lab_day_id_fkey`)

**Unique Constraints:**
- `lab_template_versions_template_id_version_number_key`: (version_number, template_id)

**Indexes:**
- `idx_template_versions_template`: `CREATE INDEX idx_template_versions_template ON public.lab_template_versions USING btree (template_id)`
- `lab_template_versions_template_id_version_number_key`: `CREATE UNIQUE INDEX lab_template_versions_template_id_version_number_key ON public.lab_template_versions USING btree (template_id, version_number)`

**RLS Policies:**
- `Allow all for authenticated` (ALL, permissive, roles: {public})

#### `lab_timer_ready_status`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | YES |  |  |
| station_id | uuid | YES |  |  |
| user_email | text | NO |  |  |
| user_name | text | YES |  |  |
| is_ready | boolean | YES | false |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `station_id` -> `lab_stations.id` (`lab_timer_ready_status_station_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`lab_timer_ready_status_lab_day_id_fkey`)

**Unique Constraints:**
- `lab_timer_ready_status_lab_day_id_station_id_key`: (station_id, lab_day_id)

**Indexes:**
- `idx_lab_timer_ready_status_lab_day_id`: `CREATE INDEX idx_lab_timer_ready_status_lab_day_id ON public.lab_timer_ready_status USING btree (lab_day_id)`
- `lab_timer_ready_status_lab_day_id_station_id_key`: `CREATE UNIQUE INDEX lab_timer_ready_status_lab_day_id_station_id_key ON public.lab_timer_ready_status USING btree (lab_day_id, station_id)`

**RLS Policies:**
- `Service can manage ready status` (ALL, permissive, roles: {public})
- `Users can create ready status` (INSERT, permissive, roles: {authenticated})
- `Users can delete ready status` (DELETE, permissive, roles: {authenticated})
- `Users can update ready status` (UPDATE, permissive, roles: {authenticated})
- `Users can view ready status` (SELECT, permissive, roles: {authenticated})

#### `lab_timer_state`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | YES |  |  |
| rotation_number | integer | YES | 1 |  |
| status | text | YES | 'stopped'::text |  |
| started_at | timestamptz | YES |  |  |
| paused_at | timestamptz | YES |  |  |
| elapsed_when_paused | integer | YES | 0 |  |
| duration_seconds | integer | NO |  |  |
| debrief_seconds | integer | YES | 300 |  |
| mode | text | YES | 'countdown'::text |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| rotation_acknowledged | boolean | YES | true |  |
| version | integer | YES | 0 |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`lab_timer_state_lab_day_id_fkey`)

**Unique Constraints:**
- `lab_timer_state_lab_day_id_key`: (lab_day_id)

**Check Constraints:**
- `lab_timer_state_status_check`: `(status = ANY (ARRAY['running'::text, 'paused'::text, 'stopped'::text]))`
- `lab_timer_state_mode_check`: `(mode = ANY (ARRAY['countdown'::text, 'countup'::text]))`

**Indexes:**
- `idx_lab_timer_state_lab_day_id`: `CREATE INDEX idx_lab_timer_state_lab_day_id ON public.lab_timer_state USING btree (lab_day_id)`
- `lab_timer_state_lab_day_id_key`: `CREATE UNIQUE INDEX lab_timer_state_lab_day_id_key ON public.lab_timer_state USING btree (lab_day_id)`

**RLS Policies:**
- `Service can manage timer state` (ALL, permissive, roles: {public})
- `Users can create timer state` (INSERT, permissive, roles: {authenticated})
- `Users can delete timer state` (DELETE, permissive, roles: {authenticated})
- `Users can update timer state` (UPDATE, permissive, roles: {authenticated})
- `Users can view timer state` (SELECT, permissive, roles: {authenticated})

#### `lab_week_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| program_id | uuid | YES |  |  |
| semester | text | YES |  |  |
| week_number | integer | YES |  |  |
| num_days | integer | YES | 5 |  |
| days | jsonb | NO | '[]'::jsonb |  |
| is_default | boolean | YES | false |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `program_id` -> `programs.id` (`lab_week_templates_program_id_fkey`)

**Indexes:**
- `idx_lab_week_templates_program`: `CREATE INDEX idx_lab_week_templates_program ON public.lab_week_templates USING btree (program_id)`
- `idx_lab_week_templates_week`: `CREATE INDEX idx_lab_week_templates_week ON public.lab_week_templates USING btree (semester, week_number)`

**RLS Policies:**
- `lab_week_templates_delete` (DELETE, permissive, roles: {public})
- `lab_week_templates_insert` (INSERT, permissive, roles: {public})
- `lab_week_templates_read` (SELECT, permissive, roles: {public})
- `lab_week_templates_update` (UPDATE, permissive, roles: {public})

#### `instructor_daily_notes`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| instructor_id | uuid | YES |  |  |
| note_date | date | NO |  |  |
| content | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| instructor_email | text | YES |  |  |

**Foreign Keys:**
- `instructor_id` -> `lab_users.id` (`instructor_daily_notes_instructor_id_fkey`)

**Unique Constraints:**
- `instructor_daily_notes_instructor_id_note_date_key`: (instructor_id, note_date)

**Indexes:**
- `idx_daily_notes_date`: `CREATE INDEX idx_daily_notes_date ON public.instructor_daily_notes USING btree (note_date)`
- `idx_daily_notes_instructor`: `CREATE INDEX idx_daily_notes_instructor ON public.instructor_daily_notes USING btree (instructor_email)`
- `idx_daily_notes_instructor_date`: `CREATE INDEX idx_daily_notes_instructor_date ON public.instructor_daily_notes USING btree (instructor_id, note_date)`
- `idx_daily_notes_instructor_email`: `CREATE INDEX idx_daily_notes_instructor_email ON public.instructor_daily_notes USING btree (instructor_email)`
- `instructor_daily_notes_instructor_id_note_date_key`: `CREATE UNIQUE INDEX instructor_daily_notes_instructor_id_note_date_key ON public.instructor_daily_notes USING btree (instructor_id, note_date)`

**RLS Policies:**
- `Users can manage own notes` (ALL, permissive, roles: {public})
- `daily_notes_delete_policy` (DELETE, permissive, roles: {public})
- `daily_notes_insert_policy` (INSERT, permissive, roles: {public})
- `daily_notes_select_policy` (SELECT, permissive, roles: {public})
- `daily_notes_update_policy` (UPDATE, permissive, roles: {public})

#### `instructor_upcoming_labs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| instructor_id | uuid | YES |  |  |
| additional_instructor_id | uuid | YES |  |  |
| lab_day_id | uuid | YES |  |  |
| lab_date | date | YES |  |  |
| week_number | integer | YES |  |  |
| day_number | integer | YES |  |  |
| station_id | uuid | YES |  |  |
| station_number | integer | YES |  |  |
| station_type | text | YES |  |  |
| custom_title | text | YES |  |  |
| scenario_title | text | YES |  |  |
| cohort_number | integer | YES |  |  |
| program | text | YES |  |  |

#### `station_completions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| station_id | uuid | YES |  |  |
| result | text | NO |  |  |
| completed_at | timestamptz | YES | now() |  |
| logged_by | uuid | YES |  |  |
| lab_day_id | uuid | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `station_id` -> `station_pool.id` (`station_completions_station_id_fkey`)
- `student_id` -> `students.id` (`station_completions_student_id_fkey`)
- `logged_by` -> `lab_users.id` (`station_completions_logged_by_fkey`)
- `lab_day_id` -> `lab_days.id` (`station_completions_lab_day_id_fkey`)

**Check Constraints:**
- `station_completions_result_check`: `(result = ANY (ARRAY['pass'::text, 'needs_review'::text, 'incomplete'::text]))`

**Indexes:**
- `idx_station_completions_date`: `CREATE INDEX idx_station_completions_date ON public.station_completions USING btree (completed_at DESC)`
- `idx_station_completions_result`: `CREATE INDEX idx_station_completions_result ON public.station_completions USING btree (result)`
- `idx_station_completions_station`: `CREATE INDEX idx_station_completions_station ON public.station_completions USING btree (station_id)`
- `idx_station_completions_student`: `CREATE INDEX idx_station_completions_student ON public.station_completions USING btree (student_id)`

**RLS Policies:**
- `station_completions_all` (ALL, permissive, roles: {public})

#### `station_instructors`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| station_id | uuid | YES |  |  |
| user_id | uuid | YES |  |  |
| user_email | text | YES |  |  |
| is_primary | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |
| user_name | text | YES |  |  |

**Foreign Keys:**
- `user_id` -> `lab_users.id` (`station_instructors_user_id_fkey`)
- `station_id` -> `lab_stations.id` (`station_instructors_station_id_fkey`)

**Unique Constraints:**
- `station_instructors_station_id_user_id_key`: (station_id, user_id)

**Indexes:**
- `idx_station_instructors_station`: `CREATE INDEX idx_station_instructors_station ON public.station_instructors USING btree (station_id)`
- `idx_station_instructors_unique`: `CREATE UNIQUE INDEX idx_station_instructors_unique ON public.station_instructors USING btree (station_id, user_email)`
- `idx_station_instructors_user`: `CREATE INDEX idx_station_instructors_user ON public.station_instructors USING btree (user_id)`
- `station_instructors_station_id_user_id_key`: `CREATE UNIQUE INDEX station_instructors_station_id_user_id_key ON public.station_instructors USING btree (station_id, user_id)`

**RLS Policies:**
- `Allow all for authenticated` (ALL, permissive, roles: {authenticated})
- `Users can create station instructors` (INSERT, permissive, roles: {authenticated})
- `Users can delete station instructors` (DELETE, permissive, roles: {authenticated})
- `Users can update station instructors` (UPDATE, permissive, roles: {authenticated})
- `Users can view station instructors` (SELECT, permissive, roles: {authenticated})

#### `station_pool`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| station_code | text | NO |  |  |
| station_name | text | NO |  |  |
| category | text | YES |  |  |
| description | text | YES |  |  |
| semester | integer | YES | 3 |  |
| cohort_id | uuid | YES |  |  |
| is_active | boolean | YES | true |  |
| display_order | integer | YES | 0 |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `created_by` -> `lab_users.id` (`station_pool_created_by_fkey`)
- `cohort_id` -> `cohorts.id` (`station_pool_cohort_id_fkey`)

**Unique Constraints:**
- `station_pool_station_code_key`: (station_code)

**Check Constraints:**
- `station_pool_category_check`: `(category = ANY (ARRAY['cardiology'::text, 'trauma'::text, 'airway'::text, 'pediatrics'::text, 'pharmacology'::text, 'medical'::text, 'obstetrics'::text, 'other'::text]))`

**Indexes:**
- `idx_station_pool_active`: `CREATE INDEX idx_station_pool_active ON public.station_pool USING btree (is_active, semester)`
- `idx_station_pool_category`: `CREATE INDEX idx_station_pool_category ON public.station_pool USING btree (category)`
- `idx_station_pool_cohort`: `CREATE INDEX idx_station_pool_cohort ON public.station_pool USING btree (cohort_id)`
- `station_pool_station_code_key`: `CREATE UNIQUE INDEX station_pool_station_code_key ON public.station_pool USING btree (station_code)`

**RLS Policies:**
- `station_pool_all` (ALL, permissive, roles: {public})

#### `station_skills`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| station_id | uuid | NO |  |  |
| skill_id | uuid | NO |  |  |
| display_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `skill_id` -> `skills.id` (`station_skills_skill_id_fkey`)
- `station_id` -> `lab_stations.id` (`station_skills_station_id_fkey`)

**Unique Constraints:**
- `station_skills_station_id_skill_id_key`: (station_id, skill_id)

**Indexes:**
- `idx_station_skills_skill_id`: `CREATE INDEX idx_station_skills_skill_id ON public.station_skills USING btree (skill_id)`
- `idx_station_skills_station`: `CREATE INDEX idx_station_skills_station ON public.station_skills USING btree (station_id)`
- `idx_station_skills_station_id`: `CREATE INDEX idx_station_skills_station_id ON public.station_skills USING btree (station_id)`
- `station_skills_station_id_skill_id_key`: `CREATE UNIQUE INDEX station_skills_station_id_skill_id_key ON public.station_skills USING btree (station_id, skill_id)`

**RLS Policies:**
- `Allow all for station_skills` (ALL, permissive, roles: {public})

#### `team_lead_counts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| student_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| team_lead_count | bigint | YES |  |  |
| last_team_lead_date | date | YES |  |  |

#### `team_lead_log`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| student_id | uuid | NO |  |  |
| cohort_id | uuid | NO |  |  |
| lab_day_id | uuid | NO |  |  |
| lab_station_id | uuid | NO |  |  |
| scenario_id | uuid | YES |  |  |
| date | date | NO |  |  |
| scenario_assessment_id | uuid | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `scenario_assessment_id` -> `scenario_assessments.id` (`team_lead_log_scenario_assessment_id_fkey`)
- `scenario_id` -> `scenarios.id` (`team_lead_log_scenario_id_fkey`)
- `lab_station_id` -> `lab_stations.id` (`team_lead_log_lab_station_id_fkey`)
- `cohort_id` -> `cohorts.id` (`team_lead_log_cohort_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`team_lead_log_lab_day_id_fkey`)
- `student_id` -> `students.id` (`team_lead_log_student_id_fkey`)

**Indexes:**
- `idx_team_lead_log_cohort`: `CREATE INDEX idx_team_lead_log_cohort ON public.team_lead_log USING btree (cohort_id)`
- `idx_team_lead_log_student`: `CREATE INDEX idx_team_lead_log_student ON public.team_lead_log USING btree (student_id)`

**RLS Policies:**
- `Allow all for team_lead_log` (ALL, permissive, roles: {public})

### Scenarios & Skills

#### `scenario_favorites`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_email | text | NO |  |  |
| scenario_id | uuid | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `scenario_id` -> `scenarios.id` (`scenario_favorites_scenario_id_fkey`)

**Unique Constraints:**
- `scenario_favorites_user_email_scenario_id_key`: (user_email, scenario_id)

**Indexes:**
- `idx_scenario_favorites_scenario`: `CREATE INDEX idx_scenario_favorites_scenario ON public.scenario_favorites USING btree (scenario_id)`
- `idx_scenario_favorites_user`: `CREATE INDEX idx_scenario_favorites_user ON public.scenario_favorites USING btree (user_email)`
- `scenario_favorites_user_email_scenario_id_key`: `CREATE UNIQUE INDEX scenario_favorites_user_email_scenario_id_key ON public.scenario_favorites USING btree (user_email, scenario_id)`

**RLS Policies:**
- `Users can manage their own favorites` (ALL, permissive, roles: {public})

#### `scenario_participation`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| student_id | uuid | YES |  |  |
| scenario_id | uuid | YES |  |  |
| role | text | YES |  |  |
| score | numeric | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| instructor_id | uuid | YES |  |  |
| created_by_id | uuid | YES |  |  |
| date | date | YES | CURRENT_DATE |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`scenario_participation_lab_day_fkey`)
- `created_by_id` -> `lab_users.id` (`scenario_participation_created_by_id_fkey`)
- `instructor_id` -> `lab_users.id` (`scenario_participation_instructor_id_fkey`)
- `student_id` -> `students.id` (`scenario_participation_student_id_fkey`)
- `scenario_id` -> `scenarios.id` (`scenario_participation_scenario_id_fkey`)
- `instructor_id` -> `lab_users.id` (`scenario_participation_instructor_fkey`)
- `created_by_id` -> `lab_users.id` (`scenario_participation_created_by_fkey`)

**Indexes:**
- `idx_scenario_participation_date`: `CREATE INDEX idx_scenario_participation_date ON public.scenario_participation USING btree (date DESC)`
- `idx_scenario_participation_lab_day`: `CREATE INDEX idx_scenario_participation_lab_day ON public.scenario_participation USING btree (lab_day_id)`
- `idx_scenario_participation_role`: `CREATE INDEX idx_scenario_participation_role ON public.scenario_participation USING btree (role)`
- `idx_scenario_participation_scenario`: `CREATE INDEX idx_scenario_participation_scenario ON public.scenario_participation USING btree (scenario_id)`
- `idx_scenario_participation_student`: `CREATE INDEX idx_scenario_participation_student ON public.scenario_participation USING btree (student_id)`

**RLS Policies:**
- `Allow all for authenticated` (ALL, permissive, roles: {public})
- `scenario_participation_delete_policy` (DELETE, permissive, roles: {public})
- `scenario_participation_insert_policy` (INSERT, permissive, roles: {public})
- `scenario_participation_select_policy` (SELECT, permissive, roles: {public})
- `scenario_participation_update_policy` (UPDATE, permissive, roles: {public})

#### `scenario_ratings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| scenario_id | uuid | NO |  |  |
| user_email | text | NO |  |  |
| rating | integer | YES |  |  |
| comment | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `scenario_id` -> `scenarios.id` (`scenario_ratings_scenario_id_fkey`)

**Unique Constraints:**
- `scenario_ratings_scenario_id_user_email_key`: (scenario_id, user_email)

**Check Constraints:**
- `scenario_ratings_rating_check`: `((rating >= 1) AND (rating <= 5))`

**Indexes:**
- `idx_scenario_ratings_scenario`: `CREATE INDEX idx_scenario_ratings_scenario ON public.scenario_ratings USING btree (scenario_id)`
- `scenario_ratings_scenario_id_user_email_key`: `CREATE UNIQUE INDEX scenario_ratings_scenario_id_user_email_key ON public.scenario_ratings USING btree (scenario_id, user_email)`

#### `scenario_tags`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| scenario_id | uuid | NO |  |  |
| tag | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `scenario_id` -> `scenarios.id` (`scenario_tags_scenario_id_fkey`)

**Indexes:**
- `idx_scenario_tags_scenario`: `CREATE INDEX idx_scenario_tags_scenario ON public.scenario_tags USING btree (scenario_id)`

#### `scenario_versions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| scenario_id | uuid | NO |  |  |
| version_number | integer | NO |  |  |
| data | jsonb | NO |  |  |
| change_summary | text | YES |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `scenario_id` -> `scenarios.id` (`scenario_versions_scenario_id_fkey`)

**Indexes:**
- `idx_scenario_versions_scenario`: `CREATE INDEX idx_scenario_versions_scenario ON public.scenario_versions USING btree (scenario_id)`

#### `skill_competencies`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| skill_id | uuid | NO |  |  |
| level | text | YES | 'introduced'::text |  |
| updated_by | text | YES |  |  |
| updated_at | timestamptz | YES | now() |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`skill_competencies_student_id_fkey`)
- `skill_id` -> `skills.id` (`skill_competencies_skill_id_fkey`)

**Unique Constraints:**
- `skill_competencies_student_id_skill_id_key`: (skill_id, student_id)

**Check Constraints:**
- `skill_competencies_level_check`: `(level = ANY (ARRAY['introduced'::text, 'practiced'::text, 'competent'::text, 'proficient'::text]))`

**Indexes:**
- `idx_skill_competencies_skill`: `CREATE INDEX idx_skill_competencies_skill ON public.skill_competencies USING btree (skill_id)`
- `idx_skill_competencies_student`: `CREATE INDEX idx_skill_competencies_student ON public.skill_competencies USING btree (student_id)`
- `skill_competencies_student_id_skill_id_key`: `CREATE UNIQUE INDEX skill_competencies_student_id_skill_id_key ON public.skill_competencies USING btree (student_id, skill_id)`

**RLS Policies:**
- `Service role full access on skill_competencies` (ALL, permissive, roles: {service_role})

#### `skill_documents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| skill_id | uuid | YES |  |  |
| document_name | text | NO |  |  |
| document_url | text | NO |  |  |
| document_type | text | YES |  |  |
| display_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |
| file_type | text | YES |  |  |
| drill_id | uuid | YES |  |  |

**Foreign Keys:**
- `skill_id` -> `skills.id` (`skill_documents_skill_id_fkey`)
- `drill_id` -> `skill_drills.id` (`skill_documents_drill_id_fkey`)

**Indexes:**
- `idx_skill_documents_drill`: `CREATE INDEX idx_skill_documents_drill ON public.skill_documents USING btree (drill_id)`
- `idx_skill_documents_skill`: `CREATE INDEX idx_skill_documents_skill ON public.skill_documents USING btree (skill_id)`
- `idx_skill_documents_type`: `CREATE INDEX idx_skill_documents_type ON public.skill_documents USING btree (document_type)`

**RLS Policies:**
- `Admins can manage skill_documents` (ALL, permissive, roles: {public})
- `Anyone can read skill_documents` (SELECT, permissive, roles: {public})

#### `skill_drill_cases`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| skill_drill_id | uuid | YES |  |  |
| case_id | text | NO |  |  |
| case_data | jsonb | NO |  |  |
| sort_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `skill_drill_id` -> `skill_drills.id` (`skill_drill_cases_skill_drill_id_fkey`)

**Indexes:**
- `idx_skill_drill_cases_drill_id`: `CREATE INDEX idx_skill_drill_cases_drill_id ON public.skill_drill_cases USING btree (skill_drill_id)`

**RLS Policies:**
- `skill_drill_cases_read` (SELECT, permissive, roles: {authenticated})

#### `skill_drills`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| category | text | YES |  |  |
| estimated_duration_minutes | integer | YES |  |  |
| equipment_needed | text | YES |  |  |
| instructions | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| drill_data | jsonb | YES |  |  |
| station_id | text | YES |  |  |
| program | text | YES |  |  |
| semester | integer | YES |  |  |
| format | text | YES |  |  |
| estimated_duration | integer | YES | 15 |  |

**Indexes:**
- `idx_skill_drills_active`: `CREATE INDEX idx_skill_drills_active ON public.skill_drills USING btree (is_active) WHERE (is_active = true)`
- `idx_skill_drills_category`: `CREATE INDEX idx_skill_drills_category ON public.skill_drills USING btree (category)`
- `idx_skill_drills_created_by`: `CREATE INDEX idx_skill_drills_created_by ON public.skill_drills USING btree (created_by)`
- `idx_skill_drills_program_semester`: `CREATE INDEX idx_skill_drills_program_semester ON public.skill_drills USING btree (program, semester)`
- `idx_skill_drills_station_id`: `CREATE UNIQUE INDEX idx_skill_drills_station_id ON public.skill_drills USING btree (station_id) WHERE (station_id IS NOT NULL)`

**RLS Policies:**
- `Authenticated users can view skill drills` (SELECT, permissive, roles: {public})
- `Instructors can manage skill drills` (ALL, permissive, roles: {public})
- `skill_drills_read` (SELECT, permissive, roles: {authenticated})

#### `skill_sheet_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| skill_sheet_id | uuid | NO |  |  |
| skill_name | text | NO |  |  |
| program | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `skill_sheet_id` -> `skill_sheets.id` (`skill_sheet_assignments_skill_sheet_id_fkey`)

**Unique Constraints:**
- `skill_sheet_assignments_skill_sheet_id_skill_name_program_key`: (skill_name, program, skill_sheet_id)

**Indexes:**
- `idx_assignments_skill_name`: `CREATE INDEX idx_assignments_skill_name ON public.skill_sheet_assignments USING btree (skill_name)`
- `skill_sheet_assignments_skill_sheet_id_skill_name_program_key`: `CREATE UNIQUE INDEX skill_sheet_assignments_skill_sheet_id_skill_name_program_key ON public.skill_sheet_assignments USING btree (skill_sheet_id, skill_name, program)`

**RLS Policies:**
- `Authenticated users can view skill_sheet_assignments` (SELECT, permissive, roles: {public})
- `Service role can do anything on skill_sheet_assignments` (ALL, permissive, roles: {public})

#### `skill_sheet_steps`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| skill_sheet_id | uuid | NO |  |  |
| step_number | integer | NO |  |  |
| phase | text | NO |  |  |
| instruction | text | NO |  |  |
| is_critical | boolean | YES | false |  |
| detail_notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `skill_sheet_id` -> `skill_sheets.id` (`skill_sheet_steps_skill_sheet_id_fkey`)

**Check Constraints:**
- `skill_sheet_steps_phase_check`: `(phase = ANY (ARRAY['preparation'::text, 'procedure'::text, 'assessment'::text, 'packaging'::text]))`

**Indexes:**
- `idx_steps_sheet_order`: `CREATE INDEX idx_steps_sheet_order ON public.skill_sheet_steps USING btree (skill_sheet_id, step_number)`

**RLS Policies:**
- `Authenticated users can view skill_sheet_steps` (SELECT, permissive, roles: {public})
- `Service role can do anything on skill_sheet_steps` (ALL, permissive, roles: {public})

#### `skill_sheets`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| canonical_skill_id | uuid | YES |  |  |
| skill_name | text | NO |  |  |
| program | text | NO |  |  |
| source | text | NO |  |  |
| source_priority | integer | YES |  |  |
| version | text | YES |  |  |
| equipment | jsonb | YES |  |  |
| overview | text | YES |  |  |
| critical_criteria | jsonb | YES |  |  |
| critical_failures | jsonb | YES |  |  |
| notes | text | YES |  |  |
| platinum_skill_type | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `canonical_skill_id` -> `canonical_skills.id` (`skill_sheets_canonical_skill_id_fkey`)

**Check Constraints:**
- `skill_sheets_source_check`: `(source = ANY (ARRAY['nremt'::text, 'platinum'::text, 'publisher'::text, 'internal'::text]))`
- `skill_sheets_platinum_skill_type_check`: `(platinum_skill_type = ANY (ARRAY['individual'::text, 'emt_competency'::text]))`
- `skill_sheets_program_check`: `(program = ANY (ARRAY['emt'::text, 'aemt'::text, 'paramedic'::text, 'aemt_paramedic'::text, 'all'::text]))`

**Indexes:**
- `idx_skill_sheets_canonical`: `CREATE INDEX idx_skill_sheets_canonical ON public.skill_sheets USING btree (canonical_skill_id)`
- `idx_skill_sheets_platinum_type`: `CREATE INDEX idx_skill_sheets_platinum_type ON public.skill_sheets USING btree (platinum_skill_type) WHERE (platinum_skill_type IS NOT NULL)`
- `idx_skill_sheets_program_source`: `CREATE INDEX idx_skill_sheets_program_source ON public.skill_sheets USING btree (program, source_priority)`

**RLS Policies:**
- `Authenticated users can view skill_sheets` (SELECT, permissive, roles: {public})
- `Service role can do anything on skill_sheets` (ALL, permissive, roles: {public})

#### `skill_signoffs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| skill_id | uuid | NO |  |  |
| lab_day_id | uuid | YES |  |  |
| signed_off_by | text | NO |  |  |
| signed_off_at | timestamptz | YES | now() |  |
| revoked_by | text | YES |  |  |
| revoked_at | timestamptz | YES |  |  |
| revoke_reason | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`skill_signoffs_student_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`skill_signoffs_lab_day_id_fkey`)
- `skill_id` -> `skills.id` (`skill_signoffs_skill_id_fkey`)

**Unique Constraints:**
- `skill_signoffs_student_id_skill_id_key`: (skill_id, student_id)

**Indexes:**
- `idx_skill_signoffs_skill`: `CREATE INDEX idx_skill_signoffs_skill ON public.skill_signoffs USING btree (skill_id)`
- `idx_skill_signoffs_student`: `CREATE INDEX idx_skill_signoffs_student ON public.skill_signoffs USING btree (student_id)`
- `idx_skill_signoffs_student_active`: `CREATE INDEX idx_skill_signoffs_student_active ON public.skill_signoffs USING btree (student_id) WHERE (revoked_at IS NULL)`
- `skill_signoffs_student_id_skill_id_key`: `CREATE UNIQUE INDEX skill_signoffs_student_id_skill_id_key ON public.skill_signoffs USING btree (student_id, skill_id)`

#### `skills`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | text | NO |  |  |
| category | text | YES |  |  |
| certification_levels | text[] | YES | ARRAY['EMT'::text, 'AEMT'::text, 'Paramedic'::text] |  |
| description | text | YES |  |  |
| required_count | integer | YES | 1 |  |
| is_active | boolean | YES | true |  |
| display_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |
| cert_levels | text[] | YES | ARRAY['PM'::text] |  |

**Indexes:**
- `idx_skills_category`: `CREATE INDEX idx_skills_category ON public.skills USING btree (category)`
- `idx_skills_levels`: `CREATE INDEX idx_skills_levels ON public.skills USING gin (certification_levels)`

**RLS Policies:**
- `Allow all for skills` (ALL, permissive, roles: {public})

#### `rubric_criteria`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| rubric_id | uuid | NO |  |  |
| name | text | NO |  |  |
| description | text | YES |  |  |
| points | integer | YES | 1 |  |
| sort_order | integer | YES | 0 |  |

**Foreign Keys:**
- `rubric_id` -> `assessment_rubrics.id` (`rubric_criteria_rubric_id_fkey`)

**Indexes:**
- `idx_rubric_criteria_rubric`: `CREATE INDEX idx_rubric_criteria_rubric ON public.rubric_criteria USING btree (rubric_id)`

#### `rubric_scenario_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| rubric_id | uuid | NO |  |  |
| scenario_id | uuid | NO |  |  |
| assigned_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `scenario_id` -> `scenarios.id` (`rubric_scenario_assignments_scenario_id_fkey`)
- `rubric_id` -> `assessment_rubrics.id` (`rubric_scenario_assignments_rubric_id_fkey`)

**Unique Constraints:**
- `rubric_scenario_assignments_rubric_id_scenario_id_key`: (rubric_id, scenario_id)

**Indexes:**
- `rubric_scenario_assignments_rubric_id_scenario_id_key`: `CREATE UNIQUE INDEX rubric_scenario_assignments_rubric_id_scenario_id_key ON public.rubric_scenario_assignments USING btree (rubric_id, scenario_id)`

### Clinical & Field

#### `clinical_sites`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| abbreviation | text | NO |  |  |
| system | text | YES |  |  |
| address | text | YES |  |  |
| phone | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| max_students_per_day | integer | YES | 2 |  |
| max_students_per_rotation | integer | YES |  |  |
| capacity_notes | text | YES |  |  |
| visit_monitoring_enabled | boolean | YES | true |  |
| visit_alert_days | integer | YES | 14 |  |
| visit_urgent_days | integer | YES | 28 |  |

**Check Constraints:**
- `chk_visit_alert_days_order`: `(visit_alert_days < visit_urgent_days)`
- `chk_visit_alert_days_positive`: `((visit_alert_days > 0) AND (visit_urgent_days > 0))`

**Indexes:**
- `idx_clinical_sites_active`: `CREATE INDEX idx_clinical_sites_active ON public.clinical_sites USING btree (is_active)`
- `idx_clinical_sites_capacity`: `CREATE INDEX idx_clinical_sites_capacity ON public.clinical_sites USING btree (max_students_per_day) WHERE (is_active = true)`
- `idx_clinical_sites_monitoring`: `CREATE INDEX idx_clinical_sites_monitoring ON public.clinical_sites USING btree (visit_monitoring_enabled) WHERE (visit_monitoring_enabled = true)`
- `idx_clinical_sites_system`: `CREATE INDEX idx_clinical_sites_system ON public.clinical_sites USING btree (system)`

**RLS Policies:**
- `Allow all access to clinical_sites` (ALL, permissive, roles: {public})

#### `clinical_site_departments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| site_id | uuid | NO |  |  |
| department | text | NO |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `site_id` -> `clinical_sites.id` (`clinical_site_departments_site_id_fkey`)

**Unique Constraints:**
- `clinical_site_departments_site_id_department_key`: (department, site_id)

**Indexes:**
- `clinical_site_departments_site_id_department_key`: `CREATE UNIQUE INDEX clinical_site_departments_site_id_department_key ON public.clinical_site_departments USING btree (site_id, department)`
- `idx_clinical_site_departments_site`: `CREATE INDEX idx_clinical_site_departments_site ON public.clinical_site_departments USING btree (site_id)`

**RLS Policies:**
- `Allow all access to clinical_site_departments` (ALL, permissive, roles: {public})

#### `clinical_site_visits`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| site_id | uuid | YES |  |  |
| departments | text[] | NO | '{}'::text[] |  |
| visitor_id | uuid | YES |  |  |
| visitor_name | text | NO |  |  |
| visit_date | date | NO |  |  |
| visit_time | time without time zone | YES |  |  |
| cohort_id | uuid | YES |  |  |
| entire_class | boolean | YES | false |  |
| comments | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | text | YES |  |  |
| agency_id | uuid | YES |  |  |

**Foreign Keys:**
- `agency_id` -> `agencies.id` (`clinical_site_visits_agency_id_fkey`)
- `site_id` -> `clinical_sites.id` (`clinical_site_visits_site_id_fkey`)
- `visitor_id` -> `lab_users.id` (`clinical_site_visits_visitor_id_fkey`)
- `cohort_id` -> `cohorts.id` (`clinical_site_visits_cohort_id_fkey`)

**Check Constraints:**
- `chk_site_or_agency`: `((site_id IS NOT NULL) OR (agency_id IS NOT NULL))`

**Indexes:**
- `idx_clinical_site_visits_agency`: `CREATE INDEX idx_clinical_site_visits_agency ON public.clinical_site_visits USING btree (agency_id)`
- `idx_clinical_site_visits_cohort`: `CREATE INDEX idx_clinical_site_visits_cohort ON public.clinical_site_visits USING btree (cohort_id)`
- `idx_clinical_site_visits_date`: `CREATE INDEX idx_clinical_site_visits_date ON public.clinical_site_visits USING btree (visit_date DESC)`
- `idx_clinical_site_visits_site`: `CREATE INDEX idx_clinical_site_visits_site ON public.clinical_site_visits USING btree (site_id)`
- `idx_clinical_site_visits_visitor`: `CREATE INDEX idx_clinical_site_visits_visitor ON public.clinical_site_visits USING btree (visitor_id)`

**RLS Policies:**
- `Allow all access to clinical_site_visits` (ALL, permissive, roles: {public})

#### `clinical_visit_students`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| visit_id | uuid | NO |  |  |
| student_id | uuid | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `visit_id` -> `clinical_site_visits.id` (`clinical_visit_students_visit_id_fkey`)
- `student_id` -> `students.id` (`clinical_visit_students_student_id_fkey`)

**Unique Constraints:**
- `clinical_visit_students_visit_id_student_id_key`: (visit_id, student_id)

**Indexes:**
- `clinical_visit_students_visit_id_student_id_key`: `CREATE UNIQUE INDEX clinical_visit_students_visit_id_student_id_key ON public.clinical_visit_students USING btree (visit_id, student_id)`
- `idx_clinical_visit_students_student`: `CREATE INDEX idx_clinical_visit_students_student ON public.clinical_visit_students USING btree (student_id)`
- `idx_clinical_visit_students_visit`: `CREATE INDEX idx_clinical_visit_students_visit ON public.clinical_visit_students USING btree (visit_id)`

**RLS Policies:**
- `Allow all access to clinical_visit_students` (ALL, permissive, roles: {public})

#### `clinical_rotations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| site_id | uuid | YES |  |  |
| rotation_date | date | NO |  |  |
| shift_start | time without time zone | YES |  |  |
| shift_end | time without time zone | YES |  |  |
| status | text | YES | 'scheduled'::text |  |
| notes | text | YES |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`clinical_rotations_student_id_fkey`)
- `site_id` -> `clinical_sites.id` (`clinical_rotations_site_id_fkey`)

**Unique Constraints:**
- `clinical_rotations_student_id_rotation_date_key`: (rotation_date, student_id)

**Check Constraints:**
- `clinical_rotations_status_check`: `(status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]))`

**Indexes:**
- `clinical_rotations_student_id_rotation_date_key`: `CREATE UNIQUE INDEX clinical_rotations_student_id_rotation_date_key ON public.clinical_rotations USING btree (student_id, rotation_date)`
- `idx_clinical_rotations_date`: `CREATE INDEX idx_clinical_rotations_date ON public.clinical_rotations USING btree (rotation_date)`
- `idx_clinical_rotations_site`: `CREATE INDEX idx_clinical_rotations_site ON public.clinical_rotations USING btree (site_id)`
- `idx_clinical_rotations_site_date`: `CREATE INDEX idx_clinical_rotations_site_date ON public.clinical_rotations USING btree (site_id, rotation_date)`
- `idx_clinical_rotations_student`: `CREATE INDEX idx_clinical_rotations_student ON public.clinical_rotations USING btree (student_id)`

**RLS Policies:**
- `Allow all for service role` (ALL, permissive, roles: {public})
- `Allow read for authenticated users` (SELECT, permissive, roles: {public})

#### `clinical_affiliations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| site_name | text | NO |  |  |
| agreement_status | text | NO | 'active'::text |  |
| start_date | date | YES |  |  |
| expiration_date | date | NO |  |  |
| responsible_person | text | YES |  |  |
| responsible_person_email | text | YES |  |  |
| notes | text | YES |  |  |
| document_url | text | YES |  |  |
| auto_renew | boolean | YES | false |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `clinical_affiliations_agreement_status_check`: `(agreement_status = ANY (ARRAY['active'::text, 'expired'::text, 'pending_renewal'::text, 'terminated'::text]))`

**Indexes:**
- `idx_clinical_affiliations_expiration`: `CREATE INDEX idx_clinical_affiliations_expiration ON public.clinical_affiliations USING btree (expiration_date)`
- `idx_clinical_affiliations_status`: `CREATE INDEX idx_clinical_affiliations_status ON public.clinical_affiliations USING btree (agreement_status)`

**RLS Policies:**
- `Authenticated users manage affiliations` (ALL, permissive, roles: {public})

#### `clinical_site_schedules`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| clinical_site_id | uuid | YES |  |  |
| institution | text | NO | 'PMI'::text |  |
| days_of_week | text[] | NO | '{}'::text[] |  |
| start_date | date | NO |  |  |
| end_date | date | YES |  |  |
| notes | text | YES |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `clinical_site_id` -> `clinical_sites.id` (`clinical_site_schedules_clinical_site_id_fkey`)

**Indexes:**
- `idx_clinical_site_schedules_dates`: `CREATE INDEX idx_clinical_site_schedules_dates ON public.clinical_site_schedules USING btree (start_date, end_date)`
- `idx_clinical_site_schedules_institution`: `CREATE INDEX idx_clinical_site_schedules_institution ON public.clinical_site_schedules USING btree (institution)`
- `idx_clinical_site_schedules_site`: `CREATE INDEX idx_clinical_site_schedules_site ON public.clinical_site_schedules USING btree (clinical_site_id)`

**RLS Policies:**
- `clinical_site_schedules_delete` (DELETE, permissive, roles: {public})
- `clinical_site_schedules_insert` (INSERT, permissive, roles: {public})
- `clinical_site_schedules_read` (SELECT, permissive, roles: {public})
- `clinical_site_schedules_update` (UPDATE, permissive, roles: {public})

#### `clinical_task_definitions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| template_id | uuid | YES |  |  |
| phase | text | NO |  |  |
| task_name | text | NO |  |  |
| task_description | text | YES |  |  |
| due_date_type | text | YES | 'relative_start'::text |  |
| due_date_offset | integer | YES | 0 |  |
| due_date_milestone | text | YES |  |  |
| source_table | text | YES |  |  |
| source_field | text | YES |  |  |
| source_condition | text | YES |  |  |
| is_required | boolean | YES | true |  |
| notify_days_before | integer | YES | 7 |  |
| notify_on_due | boolean | YES | true |  |
| notify_when_overdue | boolean | YES | true |  |
| sort_order | integer | YES | 0 |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `template_id` -> `clinical_task_templates.id` (`clinical_task_definitions_template_id_fkey`)

**Indexes:**
- `idx_task_definitions_phase`: `CREATE INDEX idx_task_definitions_phase ON public.clinical_task_definitions USING btree (phase)`
- `idx_task_definitions_template`: `CREATE INDEX idx_task_definitions_template ON public.clinical_task_definitions USING btree (template_id)`

**RLS Policies:**
- `Allow all access to task_definitions` (ALL, permissive, roles: {public})

#### `clinical_task_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| program_type | text | YES | 'paramedic'::text |  |
| is_default | boolean | YES | false |  |
| is_active | boolean | YES | true |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `created_by` -> `lab_users.id` (`clinical_task_templates_created_by_fkey`)

**RLS Policies:**
- `Allow all access to task_templates` (ALL, permissive, roles: {public})

#### `field_preceptors`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| first_name | text | NO |  |  |
| last_name | text | NO |  |  |
| email | text | YES |  |  |
| phone | text | YES |  |  |
| agency_id | uuid | YES |  |  |
| agency_name | text | YES |  |  |
| station | text | YES |  |  |
| normal_schedule | text | YES |  |  |
| snhd_trained_date | date | YES |  |  |
| snhd_cert_expires | date | YES |  |  |
| max_students | integer | YES | 1 |  |
| is_active | boolean | YES | true |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| credentials | text | YES |  |  |

**Foreign Keys:**
- `agency_id` -> `agencies.id` (`field_preceptors_agency_id_fkey`)

**Indexes:**
- `idx_preceptors_active`: `CREATE INDEX idx_preceptors_active ON public.field_preceptors USING btree (is_active)`
- `idx_preceptors_agency`: `CREATE INDEX idx_preceptors_agency ON public.field_preceptors USING btree (agency_id)`

**RLS Policies:**
- `Allow all access to preceptors` (ALL, permissive, roles: {public})
- `Allow read access to preceptors` (SELECT, permissive, roles: {public})

#### `field_ride_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_name | text | NO |  |  |
| student_email | text | NO |  |  |
| student_cohort | text | YES |  |  |
| agency | text | NO |  |  |
| date_requested | date | NO |  |  |
| start_time | text | YES |  |  |
| duration | text | YES |  |  |
| unit_requested | text | YES |  |  |
| hours_category | text | NO |  |  |
| status | text | YES | 'pending'::text |  |
| reviewed_by | uuid | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |
| admin_notes | text | YES |  |  |
| public_link_id | text | YES |  |  |
| submitted_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `reviewed_by` -> `lab_users.id` (`field_ride_requests_reviewed_by_fkey`)

**Indexes:**
- `idx_ride_requests_date`: `CREATE INDEX idx_ride_requests_date ON public.field_ride_requests USING btree (date_requested)`
- `idx_ride_requests_status`: `CREATE INDEX idx_ride_requests_status ON public.field_ride_requests USING btree (status)`

**RLS Policies:**
- `Anyone can submit ride requests` (INSERT, permissive, roles: {public})
- `Authenticated can view ride requests` (SELECT, permissive, roles: {public})
- `Service role manages ride requests` (ALL, permissive, roles: {public})

#### `field_trips`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cohort_id | uuid | YES |  |  |
| title | text | NO |  |  |
| destination | text | YES |  |  |
| trip_date | date | YES |  |  |
| departure_time | time without time zone | YES |  |  |
| return_time | time without time zone | YES |  |  |
| notes | text | YES |  |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| is_active | boolean | YES | true |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`field_trips_cohort_id_fkey`)
- `created_by` -> `lab_users.id` (`field_trips_created_by_fkey`)

**Indexes:**
- `idx_field_trips_active`: `CREATE INDEX idx_field_trips_active ON public.field_trips USING btree (is_active) WHERE (is_active = true)`
- `idx_field_trips_cohort`: `CREATE INDEX idx_field_trips_cohort ON public.field_trips USING btree (cohort_id)`
- `idx_field_trips_date`: `CREATE INDEX idx_field_trips_date ON public.field_trips USING btree (trip_date DESC)`

**RLS Policies:**
- `Allow all access to field_trips` (ALL, permissive, roles: {public})

#### `field_trip_attendance`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| field_trip_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| attended | boolean | YES | false |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`field_trip_attendance_student_id_fkey`)
- `field_trip_id` -> `field_trips.id` (`field_trip_attendance_field_trip_id_fkey`)

**Unique Constraints:**
- `field_trip_attendance_field_trip_id_student_id_key`: (field_trip_id, student_id)

**Indexes:**
- `field_trip_attendance_field_trip_id_student_id_key`: `CREATE UNIQUE INDEX field_trip_attendance_field_trip_id_student_id_key ON public.field_trip_attendance USING btree (field_trip_id, student_id)`
- `idx_field_trip_attendance_student`: `CREATE INDEX idx_field_trip_attendance_student ON public.field_trip_attendance USING btree (student_id)`
- `idx_field_trip_attendance_trip`: `CREATE INDEX idx_field_trip_attendance_trip ON public.field_trip_attendance USING btree (field_trip_id)`

**RLS Policies:**
- `Allow all access to field_trip_attendance` (ALL, permissive, roles: {public})

#### `preceptor_eval_tokens`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| internship_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| preceptor_email | text | NO |  |  |
| token | text | NO |  |  |
| status | text | YES | 'active'::text |  |
| expires_at | timestamptz | NO |  |  |
| submitted_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`preceptor_eval_tokens_student_id_fkey`)
- `internship_id` -> `student_internships.id` (`preceptor_eval_tokens_internship_id_fkey`)

**Unique Constraints:**
- `preceptor_eval_tokens_token_key`: (token)

**Check Constraints:**
- `preceptor_eval_tokens_status_check`: `(status = ANY (ARRAY['active'::text, 'submitted'::text, 'expired'::text]))`

**Indexes:**
- `idx_preceptor_tokens_internship`: `CREATE INDEX idx_preceptor_tokens_internship ON public.preceptor_eval_tokens USING btree (internship_id)`
- `idx_preceptor_tokens_token`: `CREATE INDEX idx_preceptor_tokens_token ON public.preceptor_eval_tokens USING btree (token)`
- `preceptor_eval_tokens_token_key`: `CREATE UNIQUE INDEX preceptor_eval_tokens_token_key ON public.preceptor_eval_tokens USING btree (token)`

**RLS Policies:**
- `tokens_insert` (INSERT, permissive, roles: {public})
- `tokens_select` (SELECT, permissive, roles: {public})
- `tokens_update` (UPDATE, permissive, roles: {public})

#### `preceptor_feedback`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| internship_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| preceptor_id | uuid | YES |  |  |
| clinical_skills | integer | YES |  |  |
| professionalism | integer | YES |  |  |
| communication | integer | YES |  |  |
| overall | integer | YES |  |  |
| comments | text | YES |  |  |
| flagged | boolean | YES | false |  |
| submitted_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| preceptor_name | text | YES |  |  |
| preceptor_email | text | YES |  |  |
| clinical_site | text | YES |  |  |
| shift_date | date | YES |  |  |
| clinical_skills_rating | integer | YES |  |  |
| professionalism_rating | integer | YES |  |  |
| communication_rating | integer | YES |  |  |
| overall_rating | integer | YES |  |  |
| strengths | text | YES |  |  |
| areas_for_improvement | text | YES |  |  |
| is_flagged | boolean | YES | false |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `internship_id` -> `student_internships.id` (`preceptor_feedback_internship_id_fkey`)
- `student_id` -> `students.id` (`preceptor_feedback_student_id_fkey`)

**Check Constraints:**
- `preceptor_feedback_communication_check`: `((communication >= 1) AND (communication <= 5))`
- `preceptor_feedback_overall_check`: `((overall >= 1) AND (overall <= 5))`
- `preceptor_feedback_professionalism_check`: `((professionalism >= 1) AND (professionalism <= 5))`
- `preceptor_feedback_clinical_skills_check`: `((clinical_skills >= 1) AND (clinical_skills <= 5))`

**Indexes:**
- `idx_preceptor_feedback_date`: `CREATE INDEX idx_preceptor_feedback_date ON public.preceptor_feedback USING btree (shift_date)`
- `idx_preceptor_feedback_flagged`: `CREATE INDEX idx_preceptor_feedback_flagged ON public.preceptor_feedback USING btree (flagged) WHERE (flagged = true)`
- `idx_preceptor_feedback_internship`: `CREATE INDEX idx_preceptor_feedback_internship ON public.preceptor_feedback USING btree (internship_id)`
- `idx_preceptor_feedback_student`: `CREATE INDEX idx_preceptor_feedback_student ON public.preceptor_feedback USING btree (student_id)`

**RLS Policies:**
- `Service role full access on preceptor_feedback` (ALL, permissive, roles: {service_role})

#### `internship_meetings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_internship_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| meeting_type | text | NO |  |  |
| scheduled_date | date | YES |  |  |
| scheduled_time | time without time zone | YES |  |  |
| location | text | YES |  |  |
| attendees | text[] | YES |  |  |
| status | text | YES | 'scheduled'::text |  |
| completed_at | timestamptz | YES |  |  |
| notes | text | YES |  |  |
| action_items | text[] | YES |  |  |
| follow_up_needed | boolean | YES | false |  |
| follow_up_date | date | YES |  |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `created_by` -> `lab_users.id` (`internship_meetings_created_by_fkey`)
- `student_internship_id` -> `student_internships.id` (`internship_meetings_student_internship_id_fkey`)
- `student_id` -> `students.id` (`internship_meetings_student_id_fkey`)

**Indexes:**
- `idx_meetings_scheduled`: `CREATE INDEX idx_meetings_scheduled ON public.internship_meetings USING btree (scheduled_date)`
- `idx_meetings_student`: `CREATE INDEX idx_meetings_student ON public.internship_meetings USING btree (student_id)`

**RLS Policies:**
- `Authenticated can view meetings` (SELECT, permissive, roles: {public})
- `Service role manages meetings` (ALL, permissive, roles: {public})

### Scheduling & Availability

#### `instructor_availability`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| instructor_id | uuid | YES |  |  |
| date | date | NO |  |  |
| start_time | time without time zone | YES |  |  |
| end_time | time without time zone | YES |  |  |
| is_all_day | boolean | YES | false |  |
| notes | text | YES |  |  |
| recurrence_rule | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `instructor_id` -> `lab_users.id` (`instructor_availability_instructor_id_fkey`)

**Unique Constraints:**
- `instructor_availability_instructor_id_date_start_time_key`: (date, start_time, instructor_id)

**Indexes:**
- `idx_availability_date`: `CREATE INDEX idx_availability_date ON public.instructor_availability USING btree (date)`
- `idx_availability_instructor`: `CREATE INDEX idx_availability_instructor ON public.instructor_availability USING btree (instructor_id)`
- `instructor_availability_instructor_id_date_start_time_key`: `CREATE UNIQUE INDEX instructor_availability_instructor_id_date_start_time_key ON public.instructor_availability USING btree (instructor_id, date, start_time)`

**RLS Policies:**
- `Admins can view all availability` (SELECT, permissive, roles: {public})
- `Users can delete own availability` (DELETE, permissive, roles: {public})
- `Users can insert own availability` (INSERT, permissive, roles: {public})
- `Users can manage own availability` (ALL, permissive, roles: {public})
- `Users can update own availability` (UPDATE, permissive, roles: {public})
- `Users can view availability` (SELECT, permissive, roles: {public})

#### `open_shifts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| description | text | YES |  |  |
| date | date | NO |  |  |
| start_time | time without time zone | NO |  |  |
| end_time | time without time zone | NO |  |  |
| location | text | YES |  |  |
| department | text | YES |  |  |
| created_by | uuid | YES |  |  |
| min_instructors | integer | YES | 1 |  |
| max_instructors | integer | YES |  |  |
| is_filled | boolean | YES | false |  |
| is_cancelled | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| lab_day_id | uuid | YES |  |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`open_shifts_lab_day_id_fkey`)
- `created_by` -> `lab_users.id` (`open_shifts_created_by_fkey`)

**Indexes:**
- `idx_open_shifts_lab_day`: `CREATE INDEX idx_open_shifts_lab_day ON public.open_shifts USING btree (lab_day_id)`
- `idx_shifts_created_by`: `CREATE INDEX idx_shifts_created_by ON public.open_shifts USING btree (created_by)`
- `idx_shifts_date`: `CREATE INDEX idx_shifts_date ON public.open_shifts USING btree (date)`

**RLS Policies:**
- `Admins can manage shifts` (ALL, permissive, roles: {public})
- `Directors can manage shifts` (ALL, permissive, roles: {public})
- `Everyone can view open shifts` (SELECT, permissive, roles: {public})

#### `shift_signups`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| shift_id | uuid | YES |  |  |
| instructor_id | uuid | YES |  |  |
| signup_start_time | time without time zone | YES |  |  |
| signup_end_time | time without time zone | YES |  |  |
| is_partial | boolean | YES | false |  |
| status | text | YES | 'pending'::text |  |
| confirmed_by | uuid | YES |  |  |
| confirmed_at | timestamptz | YES |  |  |
| declined_reason | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `instructor_id` -> `lab_users.id` (`shift_signups_instructor_id_fkey`)
- `shift_id` -> `open_shifts.id` (`shift_signups_shift_id_fkey`)
- `confirmed_by` -> `lab_users.id` (`shift_signups_confirmed_by_fkey`)

**Unique Constraints:**
- `shift_signups_shift_id_instructor_id_key`: (shift_id, instructor_id)

**Check Constraints:**
- `shift_signups_status_check`: `(status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'withdrawn'::text]))`

**Indexes:**
- `idx_signups_instructor`: `CREATE INDEX idx_signups_instructor ON public.shift_signups USING btree (instructor_id)`
- `idx_signups_shift`: `CREATE INDEX idx_signups_shift ON public.shift_signups USING btree (shift_id)`
- `idx_signups_status`: `CREATE INDEX idx_signups_status ON public.shift_signups USING btree (status)`
- `shift_signups_shift_id_instructor_id_key`: `CREATE UNIQUE INDEX shift_signups_shift_id_instructor_id_key ON public.shift_signups USING btree (shift_id, instructor_id)`

**RLS Policies:**
- `Admins can manage all signups` (ALL, permissive, roles: {public})
- `Users can manage own signups` (ALL, permissive, roles: {public})
- `Users can manage signups` (ALL, permissive, roles: {public})
- `Users can view signups` (SELECT, permissive, roles: {public})

#### `instructor_time_entries`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| instructor_email | text | NO |  |  |
| lab_day_id | uuid | YES |  |  |
| clock_in | timestamptz | NO |  |  |
| clock_out | timestamptz | YES |  |  |
| status | text | YES | 'pending'::text |  |
| approved_by | text | YES |  |  |
| approved_at | timestamptz | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`instructor_time_entries_lab_day_id_fkey`)

**Check Constraints:**
- `instructor_time_entries_status_check`: `(status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))`

**Indexes:**
- `idx_time_entries_date`: `CREATE INDEX idx_time_entries_date ON public.instructor_time_entries USING btree (clock_in)`
- `idx_time_entries_instructor`: `CREATE INDEX idx_time_entries_instructor ON public.instructor_time_entries USING btree (instructor_email)`
- `idx_time_entries_lab_day`: `CREATE INDEX idx_time_entries_lab_day ON public.instructor_time_entries USING btree (lab_day_id)`
- `idx_time_entries_status`: `CREATE INDEX idx_time_entries_status ON public.instructor_time_entries USING btree (status)`

**RLS Policies:**
- `instructors_delete_time_entries` (DELETE, permissive, roles: {public})
- `instructors_insert_own_time_entries` (INSERT, permissive, roles: {public})
- `instructors_read_own_time_entries` (SELECT, permissive, roles: {public})
- `instructors_update_own_time_entries` (UPDATE, permissive, roles: {public})

#### `instructor_tasks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| description | text | YES |  |  |
| assigned_by | uuid | YES |  |  |
| assigned_to | uuid | YES |  |  |
| due_date | date | YES |  |  |
| priority | text | YES | 'medium'::text |  |
| status | text | YES | 'pending'::text |  |
| completed_at | timestamptz | YES |  |  |
| completion_notes | text | YES |  |  |
| attachment_url | text | YES |  |  |
| related_link | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| completion_mode | text | YES | 'any'::text |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `assigned_to` -> `lab_users.id` (`instructor_tasks_assigned_to_fkey`)
- `created_by` -> `lab_users.id` (`instructor_tasks_created_by_fkey`)
- `assigned_by` -> `lab_users.id` (`instructor_tasks_assigned_by_fkey`)

**Check Constraints:**
- `instructor_tasks_completion_mode_check`: `(completion_mode = ANY (ARRAY['single'::text, 'any'::text, 'all'::text]))`
- `instructor_tasks_status_check`: `(status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))`
- `instructor_tasks_priority_check`: `(priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))`

**Indexes:**
- `idx_instructor_tasks_assigned`: `CREATE INDEX idx_instructor_tasks_assigned ON public.instructor_tasks USING btree (assigned_to)`
- `idx_instructor_tasks_assigned_by`: `CREATE INDEX idx_instructor_tasks_assigned_by ON public.instructor_tasks USING btree (assigned_by)`
- `idx_instructor_tasks_assigned_status_due`: `CREATE INDEX idx_instructor_tasks_assigned_status_due ON public.instructor_tasks USING btree (assigned_to, status, due_date)`
- `idx_instructor_tasks_assigned_to`: `CREATE INDEX idx_instructor_tasks_assigned_to ON public.instructor_tasks USING btree (assigned_to)`
- `idx_instructor_tasks_assignee_status_due`: `CREATE INDEX idx_instructor_tasks_assignee_status_due ON public.instructor_tasks USING btree (assigned_to, status, due_date)`
- `idx_instructor_tasks_due`: `CREATE INDEX idx_instructor_tasks_due ON public.instructor_tasks USING btree (due_date)`
- `idx_instructor_tasks_due_date`: `CREATE INDEX idx_instructor_tasks_due_date ON public.instructor_tasks USING btree (due_date)`
- `idx_instructor_tasks_status`: `CREATE INDEX idx_instructor_tasks_status ON public.instructor_tasks USING btree (status)`
- `idx_tasks_assigned_by`: `CREATE INDEX idx_tasks_assigned_by ON public.instructor_tasks USING btree (assigned_by)`
- `idx_tasks_assigned_to`: `CREATE INDEX idx_tasks_assigned_to ON public.instructor_tasks USING btree (assigned_to)`
- `idx_tasks_status`: `CREATE INDEX idx_tasks_status ON public.instructor_tasks USING btree (status)`

**RLS Policies:**
- `Assigner can delete tasks` (DELETE, permissive, roles: {public})
- `Assigners can delete their tasks` (DELETE, permissive, roles: {public})
- `Task participants can update` (UPDATE, permissive, roles: {public})
- `Users can create tasks` (INSERT, permissive, roles: {public})
- `Users can update tasks they're involved in` (UPDATE, permissive, roles: {public})
- `Users can view all tasks` (SELECT, permissive, roles: {public})
- `Users can view tasks assigned to or by them` (SELECT, permissive, roles: {public})

#### `shift_swap_interest`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| swap_request_id | uuid | NO |  |  |
| interested_by | text | NO |  |  |
| status | text | YES | 'interested'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `swap_request_id` -> `shift_trade_requests.id` (`shift_swap_interest_swap_request_id_fkey`)

**Check Constraints:**
- `shift_swap_interest_status_check`: `(status = ANY (ARRAY['interested'::text, 'selected'::text, 'declined'::text]))`

**Indexes:**
- `idx_swap_interest_request`: `CREATE INDEX idx_swap_interest_request ON public.shift_swap_interest USING btree (swap_request_id)`
- `idx_swap_interest_user`: `CREATE INDEX idx_swap_interest_user ON public.shift_swap_interest USING btree (interested_by)`

**RLS Policies:**
- `Authenticated users manage swap interest` (ALL, permissive, roles: {public})

#### `shift_trade_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| requester_id | uuid | NO |  |  |
| requester_shift_id | uuid | NO |  |  |
| target_shift_id | uuid | YES |  |  |
| target_user_id | uuid | YES |  |  |
| status | text | NO | 'pending'::text |  |
| reason | text | YES |  |  |
| response_note | text | YES |  |  |
| approved_by | uuid | YES |  |  |
| approved_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `requester_shift_id` -> `open_shifts.id` (`shift_trade_requests_requester_shift_id_fkey`)
- `approved_by` -> `lab_users.id` (`shift_trade_requests_approved_by_fkey`)
- `target_user_id` -> `lab_users.id` (`shift_trade_requests_target_user_id_fkey`)
- `target_shift_id` -> `open_shifts.id` (`shift_trade_requests_target_shift_id_fkey`)
- `requester_id` -> `lab_users.id` (`shift_trade_requests_requester_id_fkey`)

**Check Constraints:**
- `shift_trade_requests_status_check`: `(status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'approved'::text, 'cancelled'::text]))`

**Indexes:**
- `idx_trade_requester`: `CREATE INDEX idx_trade_requester ON public.shift_trade_requests USING btree (requester_id)`
- `idx_trade_requester_shift`: `CREATE INDEX idx_trade_requester_shift ON public.shift_trade_requests USING btree (requester_shift_id)`
- `idx_trade_status`: `CREATE INDEX idx_trade_status ON public.shift_trade_requests USING btree (status)`
- `idx_trade_target_user`: `CREATE INDEX idx_trade_target_user ON public.shift_trade_requests USING btree (target_user_id)`

**RLS Policies:**
- `Authenticated users manage trades` (ALL, permissive, roles: {public})

#### `shift_trades`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| original_shift_id | uuid | NO |  |  |
| original_instructor_email | text | NO |  |  |
| accepting_instructor_email | text | YES |  |  |
| reason | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| approved_by | text | YES |  |  |
| approved_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `original_shift_id` -> `open_shifts.id` (`shift_trades_original_shift_id_fkey`)

**Check Constraints:**
- `shift_trades_status_check`: `(status = ANY (ARRAY['pending'::text, 'accepted'::text, 'approved'::text, 'declined'::text, 'cancelled'::text]))`

**Indexes:**
- `idx_shift_trades_original_instructor`: `CREATE INDEX idx_shift_trades_original_instructor ON public.shift_trades USING btree (original_instructor_email)`
- `idx_shift_trades_shift`: `CREATE INDEX idx_shift_trades_shift ON public.shift_trades USING btree (original_shift_id)`
- `idx_shift_trades_status`: `CREATE INDEX idx_shift_trades_status ON public.shift_trades USING btree (status)`

#### `substitute_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| requester_email | text | NO |  |  |
| reason | text | NO |  |  |
| reason_details | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| reviewed_by | text | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |
| review_notes | text | YES |  |  |
| covered_by | text | YES |  |  |
| covered_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`substitute_requests_lab_day_id_fkey`)

**Check Constraints:**
- `substitute_requests_status_check`: `(status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'covered'::text]))`

**Indexes:**
- `idx_substitute_requests_lab_day`: `CREATE INDEX idx_substitute_requests_lab_day ON public.substitute_requests USING btree (lab_day_id)`
- `idx_substitute_requests_status`: `CREATE INDEX idx_substitute_requests_status ON public.substitute_requests USING btree (status)`

#### `team_availability_views`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| instructor_emails | text[] | NO |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_team_availability_creator`: `CREATE INDEX idx_team_availability_creator ON public.team_availability_views USING btree (created_by)`

**RLS Policies:**
- `Users can delete own team views` (DELETE, permissive, roles: {public})
- `Users can insert team views` (INSERT, permissive, roles: {public})
- `Users can view own team views` (SELECT, permissive, roles: {public})

#### `polls`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| description | text | YES |  |  |
| mode | text | NO |  |  |
| start_date | date | NO |  |  |
| num_weeks | integer | NO |  |  |
| weekdays_only | boolean | YES | true |  |
| created_by | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |
| participant_link | text | NO |  |  |
| admin_link | text | NO |  |  |
| available_slots | jsonb | YES | '[]'::jsonb |  |

**Unique Constraints:**
- `polls_admin_link_key`: (admin_link)
- `polls_participant_link_key`: (participant_link)

**Check Constraints:**
- `polls_mode_check`: `(mode = ANY (ARRAY['individual'::text, 'group'::text]))`

**Indexes:**
- `idx_polls_admin_link`: `CREATE INDEX idx_polls_admin_link ON public.polls USING btree (admin_link)`
- `idx_polls_available_slots`: `CREATE INDEX idx_polls_available_slots ON public.polls USING gin (available_slots)`
- `idx_polls_participant_link`: `CREATE INDEX idx_polls_participant_link ON public.polls USING btree (participant_link)`
- `polls_admin_link_key`: `CREATE UNIQUE INDEX polls_admin_link_key ON public.polls USING btree (admin_link)`
- `polls_participant_link_key`: `CREATE UNIQUE INDEX polls_participant_link_key ON public.polls USING btree (participant_link)`

**RLS Policies:**
- `Allow delete for creators` (DELETE, permissive, roles: {public})
- `Anyone can view polls` (SELECT, permissive, roles: {public})
- `Authenticated users can create polls` (INSERT, permissive, roles: {public})

#### `submissions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| poll_id | uuid | YES |  |  |
| name | text | NO |  |  |
| email | text | NO |  |  |
| agency | text | NO |  |  |
| meeting_type | text | YES |  |  |
| availability | jsonb | NO |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| respondent_role | text | YES |  |  |

**Foreign Keys:**
- `poll_id` -> `polls.id` (`submissions_poll_id_fkey`)

**Unique Constraints:**
- `submissions_poll_id_email_key`: (email, poll_id)

**Indexes:**
- `idx_submissions_email`: `CREATE INDEX idx_submissions_email ON public.submissions USING btree (email)`
- `idx_submissions_poll`: `CREATE INDEX idx_submissions_poll ON public.submissions USING btree (poll_id)`
- `idx_submissions_poll_id`: `CREATE INDEX idx_submissions_poll_id ON public.submissions USING btree (poll_id)`
- `idx_submissions_respondent_role`: `CREATE INDEX idx_submissions_respondent_role ON public.submissions USING btree (respondent_role)`
- `submissions_poll_id_email_key`: `CREATE UNIQUE INDEX submissions_poll_id_email_key ON public.submissions USING btree (poll_id, email)`

**RLS Policies:**
- `Allow delete submissions` (DELETE, permissive, roles: {public})
- `Anyone can insert submissions` (INSERT, permissive, roles: {public})
- `Anyone can view submissions` (SELECT, permissive, roles: {public})
- `Users can update their own submissions` (UPDATE, permissive, roles: {public})

### OSCE

#### `osce_events`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| subtitle | text | YES |  |  |
| slug | text | NO |  |  |
| description | text | YES |  |  |
| location | text | YES |  |  |
| start_date | date | NO |  |  |
| end_date | date | NO |  |  |
| max_observers_per_block | integer | YES | 4 |  |
| status | text | NO | 'draft'::text |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `osce_events_slug_key`: (slug)

**Check Constraints:**
- `osce_events_status_check`: `(status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'archived'::text]))`

**Indexes:**
- `idx_osce_events_slug`: `CREATE INDEX idx_osce_events_slug ON public.osce_events USING btree (slug)`
- `idx_osce_events_status`: `CREATE INDEX idx_osce_events_status ON public.osce_events USING btree (status)`
- `osce_events_slug_key`: `CREATE UNIQUE INDEX osce_events_slug_key ON public.osce_events USING btree (slug)`

**RLS Policies:**
- `osce_events_service_role` (ALL, permissive, roles: {public})

#### `osce_time_blocks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| day_number | integer | NO |  |  |
| label | text | NO |  |  |
| date | date | NO |  |  |
| start_time | time without time zone | NO |  |  |
| end_time | time without time zone | NO |  |  |
| max_observers | integer | YES | 4 |  |
| sort_order | integer | YES | 0 |  |
| event_id | uuid | NO |  |  |

**Foreign Keys:**
- `event_id` -> `osce_events.id` (`osce_time_blocks_event_id_fkey`)

**Check Constraints:**
- `osce_time_blocks_day_number_check`: `(day_number = ANY (ARRAY[1, 2]))`
- `valid_time_range`: `(end_time > start_time)`

**Indexes:**
- `idx_osce_time_blocks_event`: `CREATE INDEX idx_osce_time_blocks_event ON public.osce_time_blocks USING btree (event_id)`

#### `osce_observers`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| title | text | NO |  |  |
| agency | text | NO |  |  |
| email | text | NO |  |  |
| phone | text | YES |  |  |
| role | text | YES |  |  |
| agency_preference | boolean | YES | false |  |
| agency_preference_note | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| event_id | uuid | NO |  |  |

**Foreign Keys:**
- `event_id` -> `osce_events.id` (`osce_observers_event_id_fkey`)

**Unique Constraints:**
- `osce_observers_event_email_unique`: (email, event_id)

**Indexes:**
- `idx_osce_observers_email`: `CREATE INDEX idx_osce_observers_email ON public.osce_observers USING btree (email)`
- `idx_osce_observers_event`: `CREATE INDEX idx_osce_observers_event ON public.osce_observers USING btree (event_id)`
- `osce_observers_event_email_unique`: `CREATE UNIQUE INDEX osce_observers_event_email_unique ON public.osce_observers USING btree (event_id, email)`

#### `osce_observer_blocks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| observer_id | uuid | NO |  |  |
| block_id | uuid | NO |  |  |
| created_at | timestamptz | YES | now() |  |
| calendar_invite_sent_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `observer_id` -> `osce_observers.id` (`osce_observer_blocks_observer_id_fkey`)
- `block_id` -> `osce_time_blocks.id` (`osce_observer_blocks_block_id_fkey`)

**Unique Constraints:**
- `unique_observer_block`: (block_id, observer_id)

**Indexes:**
- `idx_osce_observer_blocks_block`: `CREATE INDEX idx_osce_observer_blocks_block ON public.osce_observer_blocks USING btree (block_id)`
- `idx_osce_observer_blocks_observer`: `CREATE INDEX idx_osce_observer_blocks_observer ON public.osce_observer_blocks USING btree (observer_id)`
- `unique_observer_block`: `CREATE UNIQUE INDEX unique_observer_block ON public.osce_observer_blocks USING btree (observer_id, block_id)`

#### `osce_student_agencies`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_name | text | NO |  |  |
| agency | text | NO |  |  |
| relationship | text | YES |  |  |
| event_id | uuid | NO |  |  |

**Foreign Keys:**
- `event_id` -> `osce_events.id` (`osce_student_agencies_event_id_fkey`)

**Indexes:**
- `idx_osce_student_agencies_event`: `CREATE INDEX idx_osce_student_agencies_event ON public.osce_student_agencies USING btree (event_id)`

#### `osce_student_schedule`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| time_block_id | uuid | NO |  |  |
| student_name | text | NO |  |  |
| slot_number | integer | NO |  |  |
| created_at | timestamptz | YES | now() |  |
| event_id | uuid | NO |  |  |

**Foreign Keys:**
- `event_id` -> `osce_events.id` (`osce_student_schedule_event_id_fkey`)
- `time_block_id` -> `osce_time_blocks.id` (`osce_student_schedule_time_block_id_fkey`)

**Unique Constraints:**
- `osce_student_schedule_time_block_id_slot_number_key`: (slot_number, time_block_id)

**Indexes:**
- `idx_osce_student_schedule_block`: `CREATE INDEX idx_osce_student_schedule_block ON public.osce_student_schedule USING btree (time_block_id)`
- `idx_osce_student_schedule_event`: `CREATE INDEX idx_osce_student_schedule_event ON public.osce_student_schedule USING btree (event_id)`
- `osce_student_schedule_time_block_id_slot_number_key`: `CREATE UNIQUE INDEX osce_student_schedule_time_block_id_slot_number_key ON public.osce_student_schedule USING btree (time_block_id, slot_number)`

### Case Studies

#### `case_studies`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| description | text | YES |  |  |
| chief_complaint | text | YES |  |  |
| category | text | YES |  |  |
| subcategory | text | YES |  |  |
| difficulty | text | YES | 'intermediate'::text |  |
| applicable_programs | text[] | YES | '{Paramedic}'::text[] |  |
| estimated_duration_minutes | integer | YES | 30 |  |
| patient_age | text | YES |  |  |
| patient_sex | text | YES |  |  |
| patient_weight | text | YES |  |  |
| patient_medical_history | text[] | YES |  |  |
| patient_medications | text[] | YES |  |  |
| patient_allergies | text | YES |  |  |
| dispatch_info | jsonb | YES | '{}'::jsonb | DispatchInfo: { call_type?, location?, additional_info? } |
| scene_info | jsonb | YES | '{}'::jsonb | SceneInfo: { scene_description?, safety_hazards?, additional_findings? } |
| phases | jsonb | NO | '[]'::jsonb | CasePhase[]: { id, title, presentation_text?, transition_text?, vitals?, physical_findings?, instructor_cues?, questions? } |
| variables | jsonb | YES | '{}'::jsonb | Record<string, unknown> for case customization |
| learning_objectives | text[] | YES | '{}'::text[] |  |
| critical_actions | text[] | YES | '{}'::text[] |  |
| common_errors | text[] | YES | '{}'::text[] |  |
| debrief_points | text[] | YES | '{}'::text[] |  |
| equipment_needed | text[] | YES | '{}'::text[] |  |
| author | text | YES |  |  |
| created_by | uuid | YES |  |  |
| visibility | text | YES | 'private'::text |  |
| is_verified | boolean | YES | false |  |
| flag_count | integer | YES | 0 |  |
| community_rating | numeric | YES | 0 |  |
| usage_count | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| is_published | boolean | YES | false |  |
| generated_by_ai | boolean | YES | false |  |
| generation_prompt | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| content_review_status | text | YES | 'not_applicable'::text |  |
| generation_brief_id | uuid | YES |  |  |

**Foreign Keys:**
- `created_by` -> `lab_users.id` (`case_studies_created_by_fkey`)
- `generation_brief_id` -> `case_briefs.id` (`case_studies_generation_brief_id_fkey`)

**Check Constraints:**
- `case_studies_content_review_status_check`: `(content_review_status = ANY (ARRAY['not_applicable'::text, 'pending_review'::text, 'approved'::text, 'changes_requested'::text, 'rejected'::text]))`
- `case_studies_difficulty_check`: `(difficulty = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))`
- `case_studies_visibility_check`: `(visibility = ANY (ARRAY['private'::text, 'program'::text, 'community'::text, 'official'::text]))`

**Indexes:**
- `idx_case_studies_category`: `CREATE INDEX idx_case_studies_category ON public.case_studies USING btree (category)`
- `idx_case_studies_created_by`: `CREATE INDEX idx_case_studies_created_by ON public.case_studies USING btree (created_by)`
- `idx_case_studies_difficulty`: `CREATE INDEX idx_case_studies_difficulty ON public.case_studies USING btree (difficulty)`
- `idx_case_studies_generated`: `CREATE INDEX idx_case_studies_generated ON public.case_studies USING btree (generated_by_ai) WHERE (generated_by_ai = true)`
- `idx_case_studies_is_active`: `CREATE INDEX idx_case_studies_is_active ON public.case_studies USING btree (is_active)`
- `idx_case_studies_published`: `CREATE INDEX idx_case_studies_published ON public.case_studies USING btree (is_published, is_active)`
- `idx_case_studies_review_status`: `CREATE INDEX idx_case_studies_review_status ON public.case_studies USING btree (content_review_status) WHERE (content_review_status <> 'not_applicable'::text)`
- `idx_case_studies_visibility`: `CREATE INDEX idx_case_studies_visibility ON public.case_studies USING btree (visibility)`

**RLS Policies:**
- `Anyone can read published cases` (SELECT, permissive, roles: {public})
- `Service role full access to case_studies` (ALL, permissive, roles: {public})

#### `case_practice_progress`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| case_id | uuid | NO |  |  |
| attempt_number | integer | NO | 1 |  |
| variant_seed | text | YES |  |  |
| current_phase | integer | YES | 0 |  |
| current_question | integer | YES | 0 |  |
| total_points | integer | YES | 0 |  |
| max_points | integer | YES | 0 |  |
| status | text | YES | 'in_progress'::text |  |
| responses | jsonb | YES | '[]'::jsonb | Array of student response objects |
| started_at | timestamptz | YES | now() |  |
| completed_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `case_id` -> `case_studies.id` (`case_practice_progress_case_id_fkey`)
- `student_id` -> `students.id` (`case_practice_progress_student_id_fkey`)

**Unique Constraints:**
- `case_practice_progress_student_id_case_id_attempt_number_key`: (case_id, student_id, attempt_number)

**Check Constraints:**
- `case_practice_progress_status_check`: `(status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'abandoned'::text]))`

**Indexes:**
- `case_practice_progress_student_id_case_id_attempt_number_key`: `CREATE UNIQUE INDEX case_practice_progress_student_id_case_id_attempt_number_key ON public.case_practice_progress USING btree (student_id, case_id, attempt_number)`
- `idx_case_practice_case`: `CREATE INDEX idx_case_practice_case ON public.case_practice_progress USING btree (case_id)`
- `idx_case_practice_status`: `CREATE INDEX idx_case_practice_status ON public.case_practice_progress USING btree (status)`
- `idx_case_practice_student`: `CREATE INDEX idx_case_practice_student ON public.case_practice_progress USING btree (student_id)`

**RLS Policies:**
- `Service role full access to case_practice_progress` (ALL, permissive, roles: {public})

#### `case_responses`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| session_id | uuid | YES |  |  |
| case_id | uuid | NO |  |  |
| student_id | uuid | YES |  |  |
| student_email | text | YES |  |  |
| student_name | text | YES |  |  |
| student_initials | text | YES |  |  |
| phase_id | text | NO |  |  |
| question_id | text | NO |  |  |
| response | jsonb | YES |  |  |
| is_correct | boolean | YES |  |  |
| points_earned | integer | YES | 0 |  |
| time_taken_seconds | integer | YES |  |  |
| hints_used | integer | YES | 0 |  |
| attempt_number | integer | YES | 1 |  |
| submitted_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `session_id` -> `case_sessions.id` (`case_responses_session_id_fkey`)
- `student_id` -> `students.id` (`case_responses_student_id_fkey`)
- `case_id` -> `case_studies.id` (`case_responses_case_id_fkey`)

**Indexes:**
- `idx_case_responses_case_id`: `CREATE INDEX idx_case_responses_case_id ON public.case_responses USING btree (case_id)`
- `idx_case_responses_case_student`: `CREATE INDEX idx_case_responses_case_student ON public.case_responses USING btree (case_id, student_id)`
- `idx_case_responses_session_id`: `CREATE INDEX idx_case_responses_session_id ON public.case_responses USING btree (session_id)`
- `idx_case_responses_student_id`: `CREATE INDEX idx_case_responses_student_id ON public.case_responses USING btree (student_id)`

**RLS Policies:**
- `Service role full access to case_responses` (ALL, permissive, roles: {public})

#### `case_sessions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| case_id | uuid | NO |  |  |
| session_code | text | NO |  |  |
| instructor_email | text | NO |  |  |
| cohort_id | uuid | YES |  |  |
| status | text | YES | 'waiting'::text |  |
| current_phase | integer | YES | 0 |  |
| current_question | integer | YES | 0 |  |
| settings | jsonb | YES | '{"anonymous": false, "time_limit": null, "allow_hints": ... |  |
| started_at | timestamptz | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`case_sessions_cohort_id_fkey`)
- `case_id` -> `case_studies.id` (`case_sessions_case_id_fkey`)

**Unique Constraints:**
- `case_sessions_session_code_key`: (session_code)

**Check Constraints:**
- `case_sessions_status_check`: `(status = ANY (ARRAY['waiting'::text, 'active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text]))`

**Indexes:**
- `case_sessions_session_code_key`: `CREATE UNIQUE INDEX case_sessions_session_code_key ON public.case_sessions USING btree (session_code)`
- `idx_case_sessions_case_id`: `CREATE INDEX idx_case_sessions_case_id ON public.case_sessions USING btree (case_id)`
- `idx_case_sessions_status`: `CREATE INDEX idx_case_sessions_status ON public.case_sessions USING btree (status)`

**RLS Policies:**
- `Service role full access to case_sessions` (ALL, permissive, roles: {public})

#### `case_analytics`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| case_id | uuid | NO |  |  |
| question_id | text | NO |  |  |
| phase_id | text | YES |  |  |
| total_attempts | integer | YES | 0 |  |
| correct_attempts | integer | YES | 0 |  |
| avg_time_seconds | numeric | YES | 0 |  |
| answer_distribution | jsonb | YES | '{}'::jsonb |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `case_id` -> `case_studies.id` (`case_analytics_case_id_fkey`)

**Unique Constraints:**
- `case_analytics_case_id_question_id_key`: (question_id, case_id)

**Indexes:**
- `case_analytics_case_id_question_id_key`: `CREATE UNIQUE INDEX case_analytics_case_id_question_id_key ON public.case_analytics USING btree (case_id, question_id)`
- `idx_case_analytics_case`: `CREATE INDEX idx_case_analytics_case ON public.case_analytics USING btree (case_id)`

**RLS Policies:**
- `Service role full access to case_analytics` (ALL, permissive, roles: {public})

#### `case_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| case_id | uuid | NO |  |  |
| cohort_id | uuid | NO |  |  |
| assigned_by | uuid | YES |  |  |
| due_date | timestamptz | YES |  |  |
| min_score_threshold | numeric | YES |  |  |
| grading_mode | text | YES | 'best_attempt'::text |  |
| gradebook_category | text | YES | 'Case Studies'::text |  |
| points_possible | integer | YES | 100 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`case_assignments_cohort_id_fkey`)
- `assigned_by` -> `lab_users.id` (`case_assignments_assigned_by_fkey`)
- `case_id` -> `case_studies.id` (`case_assignments_case_id_fkey`)

**Check Constraints:**
- `case_assignments_grading_mode_check`: `(grading_mode = ANY (ARRAY['best_attempt'::text, 'latest_attempt'::text, 'average'::text]))`

**Indexes:**
- `idx_case_assignments_case`: `CREATE INDEX idx_case_assignments_case ON public.case_assignments USING btree (case_id)`
- `idx_case_assignments_cohort`: `CREATE INDEX idx_case_assignments_cohort ON public.case_assignments USING btree (cohort_id)`

**RLS Policies:**
- `Service role full access to case_assignments` (ALL, permissive, roles: {public})

#### `case_briefs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| category | text | NO |  |  |
| subcategory | text | NO |  |  |
| difficulty | text | NO |  |  |
| programs | text[] | NO |  |  |
| scenario | text | NO |  |  |
| special_instructions | text | YES |  |  |
| batch_name | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| generated_case_id | uuid | YES |  |  |
| error_message | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `generated_case_id` -> `case_studies.id` (`case_briefs_generated_case_id_fkey`)

**Check Constraints:**
- `case_briefs_difficulty_check`: `(difficulty = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))`
- `case_briefs_status_check`: `(status = ANY (ARRAY['pending'::text, 'generating'::text, 'generated'::text, 'failed'::text, 'skipped'::text]))`

**Indexes:**
- `idx_case_briefs_batch`: `CREATE INDEX idx_case_briefs_batch ON public.case_briefs USING btree (batch_name)`
- `idx_case_briefs_category`: `CREATE INDEX idx_case_briefs_category ON public.case_briefs USING btree (category)`
- `idx_case_briefs_status`: `CREATE INDEX idx_case_briefs_status ON public.case_briefs USING btree (status)`

**RLS Policies:**
- `case_briefs_service_role` (ALL, permissive, roles: {service_role})

#### `case_flags`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| case_id | uuid | NO |  |  |
| flagged_by | uuid | NO |  |  |
| reason | text | NO |  |  |
| details | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| reviewed_by | uuid | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `flagged_by` -> `lab_users.id` (`case_flags_flagged_by_fkey`)
- `reviewed_by` -> `lab_users.id` (`case_flags_reviewed_by_fkey`)
- `case_id` -> `case_studies.id` (`case_flags_case_id_fkey`)

**Check Constraints:**
- `case_flags_status_check`: `(status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text]))`
- `case_flags_reason_check`: `(reason = ANY (ARRAY['inaccurate'::text, 'inappropriate'::text, 'duplicate'::text, 'outdated'::text, 'other'::text]))`

**RLS Policies:**
- `Service role full access to case_flags` (ALL, permissive, roles: {public})

#### `case_reviews`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| case_id | uuid | NO |  |  |
| reviewed_by | uuid | NO |  |  |
| status | text | NO |  |  |
| notes | text | YES |  |  |
| reviewed_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `reviewed_by` -> `lab_users.id` (`case_reviews_reviewed_by_fkey`)
- `case_id` -> `case_studies.id` (`case_reviews_case_id_fkey`)

**Check Constraints:**
- `case_reviews_status_check`: `(status = ANY (ARRAY['approved'::text, 'rejected'::text, 'revision_needed'::text]))`

**RLS Policies:**
- `Service role full access to case_reviews` (ALL, permissive, roles: {public})

### Calendar Integration

#### `google_calendar_events`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_email | text | NO |  |  |
| google_event_id | text | NO |  |  |
| source_type | text | NO |  |  |
| source_id | text | NO |  |  |
| lab_day_id | uuid | YES |  |  |
| shift_id | uuid | YES |  |  |
| event_summary | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `google_calendar_events_user_email_source_type_source_id_key`: (source_id, user_email, source_type)

**Check Constraints:**
- `google_calendar_events_source_type_check`: `(source_type = ANY (ARRAY['station_assignment'::text, 'lab_day_role'::text, 'shift_signup'::text, 'site_visit'::text, 'osce_block'::text, 'osce_instructor'::text]))`

**Indexes:**
- `google_calendar_events_user_email_source_type_source_id_key`: `CREATE UNIQUE INDEX google_calendar_events_user_email_source_type_source_id_key ON public.google_calendar_events USING btree (user_email, source_type, source_id)`
- `idx_gcal_events_lab_day_id`: `CREATE INDEX idx_gcal_events_lab_day_id ON public.google_calendar_events USING btree (lab_day_id)`
- `idx_gcal_events_shift_id`: `CREATE INDEX idx_gcal_events_shift_id ON public.google_calendar_events USING btree (shift_id)`
- `idx_gcal_events_source`: `CREATE INDEX idx_gcal_events_source ON public.google_calendar_events USING btree (source_type, source_id)`
- `idx_gcal_events_user_email`: `CREATE INDEX idx_gcal_events_user_email ON public.google_calendar_events USING btree (user_email)`

**RLS Policies:**
- `Allow service role full access to google_calendar_events` (ALL, permissive, roles: {public})

#### `calendar_sync_log`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| run_at | timestamptz | NO | now() |  |
| run_type | text | NO | 'cron'::text |  |
| users_processed | integer | NO | 0 |  |
| events_created | integer | NO | 0 |  |
| events_updated | integer | NO | 0 |  |
| events_deleted | integer | NO | 0 |  |
| events_verified | integer | NO | 0 |  |
| failures | integer | NO | 0 |  |
| duration_ms | integer | YES |  |  |
| error_details | jsonb | YES | '[]'::jsonb |  |
| created_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `calendar_sync_log_run_type_check`: `(run_type = ANY (ARRAY['cron'::text, 'manual'::text]))`

**Indexes:**
- `idx_calendar_sync_log_run_at`: `CREATE INDEX idx_calendar_sync_log_run_at ON public.calendar_sync_log USING btree (run_at DESC)`

**RLS Policies:**
- `Allow service role full access to calendar_sync_log` (ALL, permissive, roles: {public})

#### `scheduled_exports`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| report_type | text | NO |  |  |
| schedule_type | text | NO |  |  |
| recipients | text[] | NO |  |  |
| is_active | boolean | YES | true |  |
| last_run_at | timestamptz | YES |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| next_run_at | timestamptz | YES |  |  |

**Check Constraints:**
- `scheduled_exports_schedule_type_check`: `(schedule_type = ANY (ARRAY['weekly'::text, 'monthly'::text]))`

**Indexes:**
- `idx_scheduled_exports_active`: `CREATE INDEX idx_scheduled_exports_active ON public.scheduled_exports USING btree (is_active) WHERE (is_active = true)`
- `idx_scheduled_exports_created_by`: `CREATE INDEX idx_scheduled_exports_created_by ON public.scheduled_exports USING btree (created_by)`
- `idx_scheduled_exports_next_run`: `CREATE INDEX idx_scheduled_exports_next_run ON public.scheduled_exports USING btree (next_run_at)`

**RLS Policies:**
- `Admins can manage scheduled exports` (ALL, permissive, roles: {public})

### Tasks & Assignments

#### `assigned_tasks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| description | text | YES |  |  |
| assigned_by_email | text | NO |  |  |
| assigned_to_email | text | NO |  |  |
| status | text | YES | 'pending'::text |  |
| priority | text | YES | 'medium'::text |  |
| due_date | date | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| completed_by_email | text | YES |  |  |
| related_url | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_assigned_tasks_by`: `CREATE INDEX idx_assigned_tasks_by ON public.assigned_tasks USING btree (assigned_by_email)`
- `idx_assigned_tasks_status`: `CREATE INDEX idx_assigned_tasks_status ON public.assigned_tasks USING btree (status) WHERE (status <> 'completed'::text)`
- `idx_assigned_tasks_to`: `CREATE INDEX idx_assigned_tasks_to ON public.assigned_tasks USING btree (assigned_to_email)`

**RLS Policies:**
- `Users see own tasks` (ALL, permissive, roles: {public})

#### `task_comments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | YES |  |  |
| author_id | uuid | YES |  |  |
| comment | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `author_id` -> `lab_users.id` (`task_comments_author_id_fkey`)
- `task_id` -> `instructor_tasks.id` (`task_comments_task_id_fkey`)

**Indexes:**
- `idx_task_comments_task`: `CREATE INDEX idx_task_comments_task ON public.task_comments USING btree (task_id)`
- `idx_task_comments_task_id`: `CREATE INDEX idx_task_comments_task_id ON public.task_comments USING btree (task_id)`

**RLS Policies:**
- `Users can add comments to their tasks` (INSERT, permissive, roles: {public})
- `Users can create comments` (INSERT, permissive, roles: {public})
- `Users can view comments on their tasks` (SELECT, permissive, roles: {public})
- `Users can view task comments` (SELECT, permissive, roles: {public})

#### `task_assignees`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | YES |  |  |
| assignee_id | uuid | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| status | text | YES | 'pending'::text |  |
| completion_notes | text | YES |  |  |

**Foreign Keys:**
- `assignee_id` -> `lab_users.id` (`task_assignees_assignee_id_fkey`)
- `task_id` -> `instructor_tasks.id` (`task_assignees_task_id_fkey`)

**Unique Constraints:**
- `task_assignees_task_id_assignee_id_key`: (task_id, assignee_id)

**Check Constraints:**
- `task_assignees_status_check`: `(status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]))`

**Indexes:**
- `idx_task_assignees_assignee`: `CREATE INDEX idx_task_assignees_assignee ON public.task_assignees USING btree (assignee_id)`
- `idx_task_assignees_assignee_id`: `CREATE INDEX idx_task_assignees_assignee_id ON public.task_assignees USING btree (assignee_id)`
- `idx_task_assignees_status`: `CREATE INDEX idx_task_assignees_status ON public.task_assignees USING btree (status)`
- `idx_task_assignees_task`: `CREATE INDEX idx_task_assignees_task ON public.task_assignees USING btree (task_id)`
- `idx_task_assignees_task_id`: `CREATE INDEX idx_task_assignees_task_id ON public.task_assignees USING btree (task_id)`
- `task_assignees_task_id_assignee_id_key`: `CREATE UNIQUE INDEX task_assignees_task_id_assignee_id_key ON public.task_assignees USING btree (task_id, assignee_id)`

**RLS Policies:**
- `Users can create task assignees` (INSERT, permissive, roles: {public})
- `Users can delete task assignees` (DELETE, permissive, roles: {public})
- `Users can update task assignees` (UPDATE, permissive, roles: {public})
- `Users can view task assignees` (SELECT, permissive, roles: {public})

### Notifications & Communication

#### `notifications_log`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| type | text | NO |  |  |
| recipient_email | text | NO |  |  |
| recipient_name | text | YES |  |  |
| subject | text | YES |  |  |
| calendar_event_id | text | YES |  |  |
| calendar_event_link | text | YES |  |  |
| event_start_time | timestamptz | YES |  |  |
| event_end_time | timestamptz | YES |  |  |
| email_template | text | YES |  |  |
| email_body | text | YES |  |  |
| poll_id | uuid | YES |  |  |
| internship_id | uuid | YES |  |  |
| status | text | NO | 'sent'::text |  |
| error_message | text | YES |  |  |
| sent_by_email | text | NO |  |  |
| sent_by_name | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `poll_id` -> `polls.id` (`notifications_log_poll_id_fkey`)

**Check Constraints:**
- `notifications_log_status_check`: `(status = ANY (ARRAY['sent'::text, 'failed'::text, 'pending'::text]))`
- `notifications_log_type_check`: `(type = ANY (ARRAY['calendar_invite'::text, 'email'::text]))`

**Indexes:**
- `idx_notifications_log_created`: `CREATE INDEX idx_notifications_log_created ON public.notifications_log USING btree (created_at DESC)`
- `idx_notifications_log_poll`: `CREATE INDEX idx_notifications_log_poll ON public.notifications_log USING btree (poll_id)`
- `idx_notifications_log_recipient`: `CREATE INDEX idx_notifications_log_recipient ON public.notifications_log USING btree (recipient_email)`
- `idx_notifications_log_sent_by`: `CREATE INDEX idx_notifications_log_sent_by ON public.notifications_log USING btree (sent_by_email)`
- `idx_notifications_log_type`: `CREATE INDEX idx_notifications_log_type ON public.notifications_log USING btree (type)`

**RLS Policies:**
- `Users can insert notifications` (INSERT, permissive, roles: {public})
- `Users can read their own notifications` (SELECT, permissive, roles: {public})

#### `announcements`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| message | text | NO |  |  |
| priority | text | YES | 'info'::text |  |
| audience | text | YES | 'all'::text |  |
| start_date | timestamptz | YES | now() |  |
| end_date | timestamptz | YES |  |  |
| is_active | boolean | YES | true |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| body | text | YES |  |  |
| target_audience | text | YES | 'all'::text |  |
| starts_at | timestamptz | YES | now() |  |
| ends_at | timestamptz | YES |  |  |
| updated_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `announcements_audience_check`: `(audience = ANY (ARRAY['all'::text, 'instructors'::text, 'students'::text]))`
- `announcements_priority_check`: `(priority = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text]))`

**Indexes:**
- `idx_announcements_active`: `CREATE INDEX idx_announcements_active ON public.announcements USING btree (is_active, starts_at, ends_at)`
- `idx_announcements_created_at`: `CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at DESC)`

**RLS Policies:**
- `announcements_delete` (DELETE, permissive, roles: {public})
- `announcements_insert` (INSERT, permissive, roles: {public})
- `announcements_read` (SELECT, permissive, roles: {authenticated})
- `announcements_select` (SELECT, permissive, roles: {public})
- `announcements_update` (UPDATE, permissive, roles: {public})

#### `announcement_reads`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| announcement_id | uuid | YES |  |  |
| user_email | text | NO |  |  |
| read_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `announcement_id` -> `announcements.id` (`announcement_reads_announcement_id_fkey`)

**Unique Constraints:**
- `announcement_reads_announcement_id_user_email_key`: (announcement_id, user_email)

**Indexes:**
- `announcement_reads_announcement_id_user_email_key`: `CREATE UNIQUE INDEX announcement_reads_announcement_id_user_email_key ON public.announcement_reads USING btree (announcement_id, user_email)`
- `idx_announcement_reads_announcement`: `CREATE INDEX idx_announcement_reads_announcement ON public.announcement_reads USING btree (announcement_id)`
- `idx_announcement_reads_user`: `CREATE INDEX idx_announcement_reads_user ON public.announcement_reads USING btree (user_email)`

**RLS Policies:**
- `announcement_reads_insert` (INSERT, permissive, roles: {public})
- `announcement_reads_select` (SELECT, permissive, roles: {public})
- `announcement_reads_upsert` (UPDATE, permissive, roles: {public})

#### `email_log`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES |  |  |
| to_email | text | NO |  |  |
| subject | text | NO |  |  |
| notification_type | text | YES |  |  |
| sent_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `user_id` -> `lab_users.id` (`email_log_user_id_fkey`)

**Indexes:**
- `idx_email_log_sent_at`: `CREATE INDEX idx_email_log_sent_at ON public.email_log USING btree (sent_at DESC)`
- `idx_email_log_user`: `CREATE INDEX idx_email_log_user ON public.email_log USING btree (user_id)`
- `idx_email_log_user_id`: `CREATE INDEX idx_email_log_user_id ON public.email_log USING btree (user_id)`

**RLS Policies:**
- `Service role can access email_log` (ALL, permissive, roles: {public})

#### `email_queue`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES |  |  |
| to_email | text | NO |  |  |
| subject | text | NO |  |  |
| body_html | text | NO |  |  |
| status | text | YES | 'pending'::text |  |
| attempts | integer | YES | 0 |  |
| sent_at | timestamptz | YES |  |  |
| error | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `user_id` -> `lab_users.id` (`email_queue_user_id_fkey`)

**Check Constraints:**
- `email_queue_status_check`: `(status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))`

**Indexes:**
- `idx_email_queue_created_at`: `CREATE INDEX idx_email_queue_created_at ON public.email_queue USING btree (created_at)`
- `idx_email_queue_status`: `CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status)`
- `idx_email_queue_user_id`: `CREATE INDEX idx_email_queue_user_id ON public.email_queue USING btree (user_id)`

**RLS Policies:**
- `Service role can access email_queue` (ALL, permissive, roles: {public})

#### `email_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| subject | text | NO |  |  |
| body | text | NO |  |  |
| category | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_email_templates_category`: `CREATE INDEX idx_email_templates_category ON public.email_templates USING btree (category)`

#### `email_template_customizations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| template_key | text | NO |  |  |
| subject | text | YES |  |  |
| body_html | text | YES |  |  |
| is_active | boolean | YES | true |  |
| updated_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `email_template_customizations_template_key_key`: (template_key)

**Indexes:**
- `email_template_customizations_template_key_key`: `CREATE UNIQUE INDEX email_template_customizations_template_key_key ON public.email_template_customizations USING btree (template_key)`
- `idx_email_template_key`: `CREATE INDEX idx_email_template_key ON public.email_template_customizations USING btree (template_key)`

**RLS Policies:**
- `Admins can manage email templates` (ALL, permissive, roles: {public})

#### `broadcast_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| message | text | NO |  |  |
| audience_type | text | NO |  |  |
| audience_filter | jsonb | YES |  |  |
| recipient_count | integer | YES | 0 |  |
| delivery_method | text | NO |  |  |
| priority | text | YES | 'normal'::text |  |
| scheduled_at | timestamptz | YES |  |  |
| sent_at | timestamptz | YES |  |  |
| sent_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_broadcast_history_sent`: `CREATE INDEX idx_broadcast_history_sent ON public.broadcast_history USING btree (sent_at DESC)`

#### `webhooks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| url | text | NO |  |  |
| events | text[] | NO |  |  |
| secret | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

#### `webhook_deliveries`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| webhook_id | uuid | NO |  |  |
| event_type | text | NO |  |  |
| payload | jsonb | YES |  |  |
| response_status | integer | YES |  |  |
| response_body | text | YES |  |  |
| success | boolean | YES |  |  |
| retry_count | integer | YES | 0 |  |
| delivered_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `webhook_id` -> `webhooks.id` (`webhook_deliveries_webhook_id_fkey`)

**Indexes:**
- `idx_webhook_deliveries_date`: `CREATE INDEX idx_webhook_deliveries_date ON public.webhook_deliveries USING btree (delivered_at DESC)`
- `idx_webhook_deliveries_webhook`: `CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries USING btree (webhook_id)`

### Onboarding

#### `onboarding_assignment_summary`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| assignment_id | uuid | YES |  |  |
| instructor_email | text | YES |  |  |
| mentor_email | text | YES |  |  |
| assigned_by | text | YES |  |  |
| assignment_status | text | YES |  |  |
| start_date | date | YES |  |  |
| target_completion_date | date | YES |  |  |
| template_name | text | YES |  |  |
| instructor_name | text | YES |  |  |
| total_tasks | bigint | YES |  |  |
| completed_tasks | bigint | YES |  |  |
| in_progress_tasks | bigint | YES |  |  |
| required_tasks | bigint | YES |  |  |
| completed_required | bigint | YES |  |  |
| progress_pct | numeric | YES |  |  |

#### `onboarding_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| template_id | uuid | NO |  |  |
| instructor_email | text | NO |  |  |
| assigned_by | text | NO |  |  |
| mentor_email | text | YES |  |  |
| start_date | date | NO | CURRENT_DATE |  |
| target_completion_date | date | YES |  |  |
| status | text | YES | 'active'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| completed_at | timestamptz | YES |  |  |
| total_elapsed_days | integer | YES |  |  |
| instructor_type | text | YES | 'full_time'::text |  |
| actual_completion_date | date | YES |  |  |

**Foreign Keys:**
- `template_id` -> `onboarding_templates.id` (`onboarding_assignments_template_id_fkey`)

**Unique Constraints:**
- `onboarding_assignments_template_id_instructor_email_key`: (instructor_email, template_id)

**Check Constraints:**
- `onboarding_assignments_status_check`: `(status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'overdue'::text]))`
- `onboarding_assignments_instructor_type_check`: `(instructor_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'lab_only'::text, 'adjunct'::text]))`

**Indexes:**
- `idx_onboarding_assignments_instructor`: `CREATE INDEX idx_onboarding_assignments_instructor ON public.onboarding_assignments USING btree (instructor_email)`
- `idx_onboarding_assignments_status`: `CREATE INDEX idx_onboarding_assignments_status ON public.onboarding_assignments USING btree (status)`
- `onboarding_assignments_template_id_instructor_email_key`: `CREATE UNIQUE INDEX onboarding_assignments_template_id_instructor_email_key ON public.onboarding_assignments USING btree (template_id, instructor_email)`

**RLS Policies:**
- `Allow insert onboarding assignments` (INSERT, permissive, roles: {authenticated})
- `Allow read onboarding assignments` (SELECT, permissive, roles: {authenticated})
- `Allow update onboarding assignments` (UPDATE, permissive, roles: {authenticated})
- `admins_manage_assignments` (ALL, permissive, roles: {authenticated})
- `instructors_see_own_assignments` (SELECT, permissive, roles: {public})
- `mentors_see_mentee_assignments` (SELECT, permissive, roles: {public})
- `temp_allow_insert` (INSERT, permissive, roles: {authenticated})

#### `onboarding_benchmarks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| template_name | text | YES |  |  |
| total_completed | bigint | YES |  |  |
| avg_completion_days | numeric | YES |  |  |
| fastest_completion_days | integer | YES |  |  |
| slowest_completion_days | integer | YES |  |  |
| avg_ft_days | numeric | YES |  |  |
| avg_pt_days | numeric | YES |  |  |
| currently_active | bigint | YES |  |  |
| currently_overdue | bigint | YES |  |  |

#### `onboarding_events`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| event_type | text | NO |  |  |
| assignment_id | uuid | YES |  |  |
| task_id | uuid | YES |  |  |
| phase_id | uuid | YES |  |  |
| actor_email | text | NO |  |  |
| actor_role | text | YES |  |  |
| target_email | text | YES |  |  |
| metadata | jsonb | YES | '{}'::jsonb |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `assignment_id` -> `onboarding_assignments.id` (`onboarding_events_assignment_id_fkey`)
- `task_id` -> `onboarding_tasks.id` (`onboarding_events_task_id_fkey`)
- `phase_id` -> `onboarding_phases.id` (`onboarding_events_phase_id_fkey`)

**Check Constraints:**
- `onboarding_events_event_type_check`: `(event_type = ANY (ARRAY['assignment_created'::text, 'assignment_completed'::text, 'assignment_paused'::text, 'assignment_resumed'::text, 'task_started'::text, 'task_completed'::text, 'task_reopened'::text, 'task_blocked'::text, 'task_unblocked'::text, 'task_waived'::text, 'sign_off_requested'::text, 'sign_off_approved'::text, 'sign_off_rejected'::text, 'mentor_check_in'::text, 'observation_scheduled'::text, 'observation_completed'::text, 'escalation_triggered'::text, 'note_added'::text, 'phase_completed'::text, 'resource_accessed'::text]))`

**Indexes:**
- `idx_onboarding_events_actor`: `CREATE INDEX idx_onboarding_events_actor ON public.onboarding_events USING btree (actor_email)`
- `idx_onboarding_events_assignment`: `CREATE INDEX idx_onboarding_events_assignment ON public.onboarding_events USING btree (assignment_id)`
- `idx_onboarding_events_created`: `CREATE INDEX idx_onboarding_events_created ON public.onboarding_events USING btree (created_at)`
- `idx_onboarding_events_metadata`: `CREATE INDEX idx_onboarding_events_metadata ON public.onboarding_events USING gin (metadata)`
- `idx_onboarding_events_type`: `CREATE INDEX idx_onboarding_events_type ON public.onboarding_events USING btree (event_type)`

**RLS Policies:**
- `admins_see_all_events` (ALL, permissive, roles: {public})
- `users_see_own_events` (SELECT, permissive, roles: {public})

#### `onboarding_evidence`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_progress_id | uuid | NO |  |  |
| file_name | text | NO |  |  |
| file_type | text | YES |  |  |
| file_size_bytes | integer | YES |  |  |
| storage_path | text | NO |  |  |
| uploaded_by | text | NO |  |  |
| uploaded_at | timestamptz | YES | now() |  |
| notes | text | YES |  |  |

**Foreign Keys:**
- `task_progress_id` -> `onboarding_task_progress.id` (`onboarding_evidence_task_progress_id_fkey`)

**Indexes:**
- `idx_evidence_progress`: `CREATE INDEX idx_evidence_progress ON public.onboarding_evidence USING btree (task_progress_id)`

**RLS Policies:**
- `admins_manage_evidence` (ALL, permissive, roles: {public})
- `mentors_view_mentee_evidence` (SELECT, permissive, roles: {public})
- `users_manage_own_evidence` (ALL, permissive, roles: {public})

#### `onboarding_instructor_analytics`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| assignment_id | uuid | YES |  |  |
| instructor_email | text | YES |  |  |
| instructor_type | text | YES |  |  |
| start_date | date | YES |  |  |
| target_completion_date | date | YES |  |  |
| status | text | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| total_elapsed_days | integer | YES |  |  |
| instructor_name | text | YES |  |  |
| template_name | text | YES |  |  |
| total_tasks | bigint | YES |  |  |
| completed_tasks | bigint | YES |  |  |
| blocked_tasks | bigint | YES |  |  |
| total_time_spent_minutes | bigint | YES |  |  |
| avg_task_minutes | numeric | YES |  |  |
| avg_sign_off_turnaround_minutes | numeric | YES |  |  |
| max_sign_off_turnaround_minutes | integer | YES |  |  |
| total_reopens | bigint | YES |  |  |
| days_since_start | integer | YES |  |  |
| progress_pct | numeric | YES |  |  |

#### `onboarding_lane_progress`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| assignment_id | uuid | YES |  |  |
| instructor_email | text | YES |  |  |
| instructor_name | text | YES |  |  |
| lane | text | YES |  |  |
| total_tasks | bigint | YES |  |  |
| completed_tasks | bigint | YES |  |  |
| in_progress_tasks | bigint | YES |  |  |
| blocked_tasks | bigint | YES |  |  |
| progress_pct | numeric | YES |  |  |
| total_minutes_spent | bigint | YES |  |  |

#### `onboarding_phase_analytics`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| phase_id | uuid | YES |  |  |
| phase_name | text | YES |  |  |
| phase_number | integer | YES |  |  |
| instructor_email | text | YES |  |  |
| instructor_name | text | YES |  |  |
| instructor_type | text | YES |  |  |
| status | text | YES |  |  |
| elapsed_days | integer | YES |  |  |
| total_task_minutes | integer | YES |  |  |
| target_days_start | integer | YES |  |  |
| target_days_end | integer | YES |  |  |
| days_over_target | integer | YES |  |  |

#### `onboarding_phase_progress`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| assignment_id | uuid | NO |  |  |
| phase_id | uuid | NO |  |  |
| status | text | YES | 'pending'::text |  |
| started_at | timestamptz | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| elapsed_days | integer | YES |  |  |
| total_task_minutes | integer | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `assignment_id` -> `onboarding_assignments.id` (`onboarding_phase_progress_assignment_id_fkey`)
- `phase_id` -> `onboarding_phases.id` (`onboarding_phase_progress_phase_id_fkey`)

**Unique Constraints:**
- `onboarding_phase_progress_assignment_id_phase_id_key`: (phase_id, assignment_id)

**Check Constraints:**
- `onboarding_phase_progress_status_check`: `(status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text]))`

**Indexes:**
- `onboarding_phase_progress_assignment_id_phase_id_key`: `CREATE UNIQUE INDEX onboarding_phase_progress_assignment_id_phase_id_key ON public.onboarding_phase_progress USING btree (assignment_id, phase_id)`

**RLS Policies:**
- `admins_manage_phase_progress` (ALL, permissive, roles: {public})
- `users_see_own_phase_progress` (SELECT, permissive, roles: {public})

#### `onboarding_phases`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| template_id | uuid | NO |  |  |
| name | text | NO |  |  |
| description | text | YES |  |  |
| sort_order | integer | NO | 0 |  |
| target_days_start | integer | YES | 0 |  |
| target_days_end | integer | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `template_id` -> `onboarding_templates.id` (`onboarding_phases_template_id_fkey`)

**Indexes:**
- `idx_onboarding_phases_template`: `CREATE INDEX idx_onboarding_phases_template ON public.onboarding_phases USING btree (template_id)`

**RLS Policies:**
- `admins_manage_phases` (ALL, permissive, roles: {public})
- `anyone_reads_phases` (SELECT, permissive, roles: {public})

#### `onboarding_task_dependencies`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | NO |  |  |
| depends_on_task_id | uuid | NO |  |  |
| gate_type | text | NO | 'hard'::text |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `depends_on_task_id` -> `onboarding_tasks.id` (`onboarding_task_dependencies_depends_on_task_id_fkey`)
- `task_id` -> `onboarding_tasks.id` (`onboarding_task_dependencies_task_id_fkey`)

**Unique Constraints:**
- `onboarding_task_dependencies_task_id_depends_on_task_id_key`: (task_id, depends_on_task_id)

**Check Constraints:**
- `onboarding_task_dependencies_check`: `(task_id <> depends_on_task_id)`
- `onboarding_task_dependencies_gate_type_check`: `(gate_type = ANY (ARRAY['hard'::text, 'soft'::text]))`

**Indexes:**
- `onboarding_task_dependencies_task_id_depends_on_task_id_key`: `CREATE UNIQUE INDEX onboarding_task_dependencies_task_id_depends_on_task_id_key ON public.onboarding_task_dependencies USING btree (task_id, depends_on_task_id)`

**RLS Policies:**
- `admins_manage_dependencies` (ALL, permissive, roles: {public})
- `anyone_reads_dependencies` (SELECT, permissive, roles: {public})

#### `onboarding_task_progress`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| assignment_id | uuid | NO |  |  |
| task_id | uuid | NO |  |  |
| status | text | YES | 'pending'::text |  |
| started_at | timestamptz | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| signed_off_by | text | YES |  |  |
| signed_off_at | timestamptz | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| time_spent_minutes | integer | YES |  |  |
| reopened_count | integer | YES | 0 |  |
| sign_off_requested_at | timestamptz | YES |  |  |
| sign_off_turnaround_minutes | integer | YES |  |  |
| blocked_reason | text | YES |  |  |
| blocked_at | timestamptz | YES |  |  |
| unblocked_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `task_id` -> `onboarding_tasks.id` (`onboarding_task_progress_task_id_fkey`)
- `assignment_id` -> `onboarding_assignments.id` (`onboarding_task_progress_assignment_id_fkey`)

**Unique Constraints:**
- `onboarding_task_progress_assignment_id_task_id_key`: (task_id, assignment_id)

**Check Constraints:**
- `onboarding_task_progress_status_check`: `(status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'waived'::text, 'blocked'::text]))`

**Indexes:**
- `idx_onboarding_task_progress_assignment`: `CREATE INDEX idx_onboarding_task_progress_assignment ON public.onboarding_task_progress USING btree (assignment_id)`
- `idx_onboarding_task_progress_status`: `CREATE INDEX idx_onboarding_task_progress_status ON public.onboarding_task_progress USING btree (status)`
- `onboarding_task_progress_assignment_id_task_id_key`: `CREATE UNIQUE INDEX onboarding_task_progress_assignment_id_task_id_key ON public.onboarding_task_progress USING btree (assignment_id, task_id)`

**RLS Policies:**
- `admins_manage_all_progress` (ALL, permissive, roles: {public})
- `instructors_manage_own_progress` (ALL, permissive, roles: {public})
- `mentors_view_mentee_progress` (SELECT, permissive, roles: {public})

#### `onboarding_task_with_dependencies`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| progress_id | uuid | YES |  |  |
| assignment_id | uuid | YES |  |  |
| task_id | uuid | YES |  |  |
| status | text | YES |  |  |
| title | text | YES |  |  |
| lane | text | YES |  |  |
| requires_evidence | boolean | YES |  |  |
| requires_sign_off | boolean | YES |  |  |
| applicable_types | text[] | YES |  |  |
| depends_on_task_id | uuid | YES |  |  |
| gate_type | text | YES |  |  |
| dependency_title | text | YES |  |  |
| dependency_status | text | YES |  |  |
| is_blocked_by_dependency | boolean | YES |  |  |

#### `onboarding_tasks`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| phase_id | uuid | NO |  |  |
| title | text | NO |  |  |
| description | text | YES |  |  |
| task_type | text | NO |  |  |
| resource_url | text | YES |  |  |
| sort_order | integer | NO | 0 |  |
| is_required | boolean | YES | true |  |
| estimated_minutes | integer | YES |  |  |
| requires_sign_off | boolean | YES | false |  |
| sign_off_role | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| lane | text | YES | 'operational'::text |  |
| applicable_types | text[] | YES | '{full_time,part_time,lab_only,adjunct}'::text[] |  |
| requires_evidence | boolean | YES | false |  |
| requires_director | boolean | YES | false |  |

**Foreign Keys:**
- `phase_id` -> `onboarding_phases.id` (`onboarding_tasks_phase_id_fkey`)

**Check Constraints:**
- `onboarding_tasks_sign_off_role_check`: `((sign_off_role = ANY (ARRAY['admin'::text, 'mentor'::text, 'program_director'::text])) OR (sign_off_role IS NULL))`
- `onboarding_tasks_task_type_check`: `(task_type = ANY (ARRAY['video'::text, 'document'::text, 'form'::text, 'sign_off'::text, 'checklist'::text, 'observation'::text, 'zoom_session'::text]))`
- `onboarding_tasks_lane_check`: `(lane = ANY (ARRAY['institutional'::text, 'operational'::text, 'mentorship'::text]))`

**Indexes:**
- `idx_onboarding_tasks_phase`: `CREATE INDEX idx_onboarding_tasks_phase ON public.onboarding_tasks USING btree (phase_id)`

**RLS Policies:**
- `admins_manage_tasks` (ALL, permissive, roles: {public})
- `anyone_reads_tasks` (SELECT, permissive, roles: {public})

#### `onboarding_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| instructor_type | text | YES | 'all'::text |  |
| is_active | boolean | YES | true |  |
| created_by | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `onboarding_templates_instructor_type_check`: `(instructor_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'lab_only'::text, 'adjunct'::text, 'all'::text]))`

**RLS Policies:**
- `admins_manage_templates` (ALL, permissive, roles: {public})
- `anyone_reads_active_templates` (SELECT, permissive, roles: {public})

### Equipment & Inventory

#### `equipment`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| category | text | YES |  |  |
| quantity | integer | YES | 1 |  |
| available_quantity | integer | YES | 1 |  |
| condition | text | YES | 'good'::text |  |
| location | text | YES |  |  |
| last_maintenance | date | YES |  |  |
| next_maintenance | date | YES |  |  |
| low_stock_threshold | integer | YES | 1 |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| maintenance_interval_days | integer | YES |  |  |
| is_out_of_service | boolean | YES | false |  |
| out_of_service_at | timestamptz | YES |  |  |
| out_of_service_reason | text | YES |  |  |

**Check Constraints:**
- `equipment_condition_check`: `(condition = ANY (ARRAY['new'::text, 'good'::text, 'fair'::text, 'poor'::text, 'out_of_service'::text]))`

**RLS Policies:**
- `equipment_read` (SELECT, permissive, roles: {authenticated})

#### `equipment_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| asset_tag | text | YES |  |  |
| serial_number | text | YES |  |  |
| category_id | uuid | YES |  |  |
| manufacturer | text | YES |  |  |
| model_number | text | YES |  |  |
| description | text | YES |  |  |
| status | text | YES | 'available'::text |  |
| condition | text | YES | 'good'::text |  |
| location_id | uuid | YES |  |  |
| purchase_date | date | YES |  |  |
| purchase_price | numeric | YES |  |  |
| warranty_expires | date | YES |  |  |
| last_maintenance_date | date | YES |  |  |
| next_maintenance_due | date | YES |  |  |
| assigned_to | text | YES |  |  |
| assigned_at | timestamptz | YES |  |  |
| notes | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |
| updated_by | uuid | YES |  |  |

**Foreign Keys:**
- `location_id` -> `locations.id` (`equipment_items_location_id_fkey`)
- `category_id` -> `equipment_categories.id` (`equipment_items_category_id_fkey`)

**Unique Constraints:**
- `equipment_items_asset_tag_key`: (asset_tag)

**Indexes:**
- `equipment_items_asset_tag_key`: `CREATE UNIQUE INDEX equipment_items_asset_tag_key ON public.equipment_items USING btree (asset_tag)`
- `idx_equipment_items_asset_tag`: `CREATE INDEX idx_equipment_items_asset_tag ON public.equipment_items USING btree (asset_tag)`
- `idx_equipment_items_assigned`: `CREATE INDEX idx_equipment_items_assigned ON public.equipment_items USING btree (assigned_to) WHERE (assigned_to IS NOT NULL)`
- `idx_equipment_items_category`: `CREATE INDEX idx_equipment_items_category ON public.equipment_items USING btree (category_id)`
- `idx_equipment_items_location`: `CREATE INDEX idx_equipment_items_location ON public.equipment_items USING btree (location_id)`
- `idx_equipment_items_status`: `CREATE INDEX idx_equipment_items_status ON public.equipment_items USING btree (status)`

**RLS Policies:**
- `Authenticated can read equipment` (SELECT, permissive, roles: {public})
- `Inventory admins can manage equipment` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `equipment_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| parent_category_id | uuid | YES |  |  |
| sort_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `parent_category_id` -> `equipment_categories.id` (`equipment_categories_parent_category_id_fkey`)

**Unique Constraints:**
- `equipment_categories_name_key`: (name)

**Indexes:**
- `equipment_categories_name_key`: `CREATE UNIQUE INDEX equipment_categories_name_key ON public.equipment_categories USING btree (name)`

**RLS Policies:**
- `Anyone can read equipment categories` (SELECT, permissive, roles: {public})
- `Inventory admins can manage equipment categories` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `equipment_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| equipment_item_id | uuid | NO |  |  |
| assigned_to_type | text | NO |  |  |
| assigned_to_name | text | NO |  |  |
| assigned_to_id | uuid | YES |  |  |
| assigned_by | uuid | YES |  |  |
| assigned_at | timestamptz | YES | now() |  |
| expected_return_date | date | YES |  |  |
| returned_at | timestamptz | YES |  |  |
| returned_to | uuid | YES |  |  |
| status | text | YES | 'active'::text |  |
| purpose | text | YES |  |  |
| condition_at_checkout | text | YES |  |  |
| condition_at_return | text | YES |  |  |
| notes | text | YES |  |  |

**Foreign Keys:**
- `equipment_item_id` -> `equipment_items.id` (`equipment_assignments_equipment_item_id_fkey`)

**Indexes:**
- `idx_equipment_assignments_item`: `CREATE INDEX idx_equipment_assignments_item ON public.equipment_assignments USING btree (equipment_item_id)`
- `idx_equipment_assignments_status`: `CREATE INDEX idx_equipment_assignments_status ON public.equipment_assignments USING btree (status) WHERE (status = 'active'::text)`

**RLS Policies:**
- `Authenticated can read equipment assignments` (SELECT, permissive, roles: {public})
- `Inventory admins can manage equipment assignments` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `equipment_checkouts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| equipment_id | uuid | NO |  |  |
| lab_day_id | uuid | YES |  |  |
| quantity | integer | YES | 1 |  |
| checked_out_by | text | YES |  |  |
| checked_out_at | timestamptz | YES | now() |  |
| checked_in_at | timestamptz | YES |  |  |
| checked_in_by | text | YES |  |  |
| condition_on_return | text | YES |  |  |
| notes | text | YES |  |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`equipment_checkouts_lab_day_id_fkey`)
- `equipment_id` -> `equipment.id` (`equipment_checkouts_equipment_id_fkey`)

**Indexes:**
- `idx_equipment_checkouts_equipment`: `CREATE INDEX idx_equipment_checkouts_equipment ON public.equipment_checkouts USING btree (equipment_id)`
- `idx_equipment_checkouts_lab_day`: `CREATE INDEX idx_equipment_checkouts_lab_day ON public.equipment_checkouts USING btree (lab_day_id)`

#### `equipment_maintenance`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| equipment_item_id | uuid | NO |  |  |
| maintenance_type | text | NO |  |  |
| description | text | NO |  |  |
| performed_by | text | YES |  |  |
| performed_at | date | NO |  |  |
| cost | numeric | YES |  |  |
| next_due_date | date | YES |  |  |
| parts_replaced | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |
| completed_by | uuid | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| scheduled_date | date | YES |  |  |
| completed_date | date | YES |  |  |
| status | text | YES | 'scheduled'::text |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `equipment_item_id` -> `equipment_items.id` (`equipment_maintenance_equipment_item_id_fkey`)

**Indexes:**
- `idx_equipment_maintenance_due`: `CREATE INDEX idx_equipment_maintenance_due ON public.equipment_maintenance USING btree (next_due_date) WHERE (next_due_date IS NOT NULL)`
- `idx_equipment_maintenance_equipment`: `CREATE INDEX idx_equipment_maintenance_equipment ON public.equipment_maintenance USING btree (equipment_item_id)`
- `idx_equipment_maintenance_item`: `CREATE INDEX idx_equipment_maintenance_item ON public.equipment_maintenance USING btree (equipment_item_id)`
- `idx_equipment_maintenance_next_due`: `CREATE INDEX idx_equipment_maintenance_next_due ON public.equipment_maintenance USING btree (next_due_date)`
- `idx_equipment_maintenance_scheduled`: `CREATE INDEX idx_equipment_maintenance_scheduled ON public.equipment_maintenance USING btree (scheduled_date)`
- `idx_equipment_maintenance_status`: `CREATE INDEX idx_equipment_maintenance_status ON public.equipment_maintenance USING btree (status)`

**RLS Policies:**
- `Authenticated can read equipment maintenance` (SELECT, permissive, roles: {public})
- `Inventory admins can manage equipment maintenance` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `bin_contents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| bin_id | uuid | NO |  |  |
| inventory_item_id | uuid | NO |  |  |
| quantity | integer | NO | 0 |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `bin_id` -> `inventory_bins.id` (`bin_contents_bin_id_fkey`)

**Unique Constraints:**
- `bin_contents_bin_id_inventory_item_id_key`: (inventory_item_id, bin_id)

**Check Constraints:**
- `bin_contents_quantity_check`: `(quantity >= 0)`

**Indexes:**
- `bin_contents_bin_id_inventory_item_id_key`: `CREATE UNIQUE INDEX bin_contents_bin_id_inventory_item_id_key ON public.bin_contents USING btree (bin_id, inventory_item_id)`

**RLS Policies:**
- `Authenticated can read bin contents` (SELECT, permissive, roles: {public})
- `Inventory admins can manage bin contents` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `custody_checkouts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| item_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| quantity | integer | NO | 1 |  |
| checked_out_by | uuid | YES |  |  |
| checked_out_at | timestamptz | YES | now() |  |
| due_date | date | YES |  |  |
| returned_at | timestamptz | YES |  |  |
| returned_to | uuid | YES |  |  |
| quantity_returned | integer | YES |  |  |
| status | text | YES | 'checked_out'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`custody_checkouts_student_id_fkey`)

**Check Constraints:**
- `custody_checkouts_status_check`: `(status = ANY (ARRAY['checked_out'::text, 'returned'::text, 'overdue'::text, 'lost'::text]))`

**Indexes:**
- `idx_custody_checkouts_status`: `CREATE INDEX idx_custody_checkouts_status ON public.custody_checkouts USING btree (status)`
- `idx_custody_checkouts_student_id`: `CREATE INDEX idx_custody_checkouts_student_id ON public.custody_checkouts USING btree (student_id)`

**RLS Policies:**
- `Authenticated can read custody checkouts` (SELECT, permissive, roles: {public})
- `Inventory admins can manage custody checkouts` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `custody_checkout_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| custody_checkout_id | uuid | NO |  |  |
| inventory_item_id | uuid | NO |  |  |
| quantity_checked_out | integer | NO |  |  |
| quantity_returned | integer | YES | 0 |  |
| quantity_consumed | integer | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `custody_checkout_id` -> `custody_checkouts.id` (`custody_checkout_items_custody_checkout_id_fkey`)

**Check Constraints:**
- `custody_checkout_items_quantity_checked_out_check`: `(quantity_checked_out > 0)`
- `custody_checkout_items_quantity_returned_check`: `(quantity_returned >= 0)`

**RLS Policies:**
- `Authenticated can read custody checkout items` (SELECT, permissive, roles: {public})
- `Inventory admins can manage custody checkout items` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `filament_types`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| material | text | NO | 'PLA'::text |  |
| cost_per_unit | numeric | NO | 20.00 |  |
| unit_weight_grams | integer | NO | 1000 |  |
| cost_per_kg | numeric | YES |  |  |
| color | text | NO |  |  |
| notes | text | YES |  |  |
| is_active | boolean | YES | true |  |
| quantity_grams | numeric | YES | 0 |  |
| low_stock_threshold_grams | integer | YES | 200 |  |
| is_archived | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| color_hex | text | YES |  |  |

**Indexes:**
- `idx_filament_types_active`: `CREATE INDEX idx_filament_types_active ON public.filament_types USING btree (is_active) WHERE (is_active = true)`

**RLS Policies:**
- `Anyone can view active filament types` (SELECT, permissive, roles: {public})
- `Operators can manage filaments` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `filament_purchases`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| filament_type_id | uuid | NO |  |  |
| purchase_date | date | NO | CURRENT_DATE |  |
| spool_count | integer | NO |  |  |
| grams_per_spool | integer | NO |  |  |
| total_grams | integer | YES |  |  |
| cost_per_spool | numeric | NO |  |  |
| total_cost | numeric | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `filament_type_id` -> `filament_types.id` (`filament_purchases_filament_type_id_fkey`)

**Indexes:**
- `idx_filament_purchases_filament`: `CREATE INDEX idx_filament_purchases_filament ON public.filament_purchases USING btree (filament_type_id)`

**RLS Policies:**
- `Operators can manage purchases` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `filament_adjustments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| filament_type_id | uuid | NO |  |  |
| adjustment_type | text | NO |  |  |
| grams | integer | NO |  |  |
| quantity_before | integer | NO |  |  |
| quantity_after | integer | NO |  |  |
| reason | text | NO |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `filament_type_id` -> `filament_types.id` (`filament_adjustments_filament_type_id_fkey`)

**Check Constraints:**
- `filament_adjustments_adjustment_type_check`: `(adjustment_type = ANY (ARRAY['add'::text, 'remove'::text]))`
- `filament_adjustments_grams_check`: `(grams > 0)`

**Indexes:**
- `idx_filament_adjustments_created_at`: `CREATE INDEX idx_filament_adjustments_created_at ON public.filament_adjustments USING btree (created_at)`
- `idx_filament_adjustments_filament`: `CREATE INDEX idx_filament_adjustments_filament ON public.filament_adjustments USING btree (filament_type_id)`

**RLS Policies:**
- `Operators can manage adjustments` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `inventory_bin_contents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| bin_id | uuid | YES |  |  |
| item_id | uuid | YES |  |  |
| quantity | integer | NO | 0 |  |
| expiration_date | date | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `bin_id` -> `inventory_bins.id` (`inventory_bin_contents_bin_id_fkey`)

**Unique Constraints:**
- `inventory_bin_contents_bin_id_item_id_expiration_date_key`: (item_id, bin_id, expiration_date)

**Indexes:**
- `idx_bin_contents_bin_id`: `CREATE INDEX idx_bin_contents_bin_id ON public.inventory_bin_contents USING btree (bin_id)`
- `idx_bin_contents_item_id`: `CREATE INDEX idx_bin_contents_item_id ON public.inventory_bin_contents USING btree (item_id)`
- `inventory_bin_contents_bin_id_item_id_expiration_date_key`: `CREATE UNIQUE INDEX inventory_bin_contents_bin_id_item_id_expiration_date_key ON public.inventory_bin_contents USING btree (bin_id, item_id, expiration_date)`

#### `inventory_bin_transactions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| bin_content_id | uuid | YES |  |  |
| transaction_type | text | NO |  |  |
| quantity | integer | NO |  |  |
| performed_by | uuid | YES |  |  |
| reason | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `bin_content_id` -> `inventory_bin_contents.id` (`inventory_bin_transactions_bin_content_id_fkey`)

**Check Constraints:**
- `inventory_bin_transactions_transaction_type_check`: `(transaction_type = ANY (ARRAY['in'::text, 'out'::text, 'adjustment'::text, 'expired'::text]))`

#### `inventory_bins`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| bin_code | text | NO |  |  |
| location_id | uuid | YES |  |  |
| name | text | NO |  |  |
| description | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| barcode | text | YES |  |  |
| is_active | boolean | YES | true |  |
| inventory_item_id | uuid | YES |  |  |
| color | text | YES |  |  |
| notes | text | YES |  |  |
| bin_type | text | YES | 'single_item'::text |  |

**Foreign Keys:**
- `location_id` -> `inventory_locations.id` (`inventory_bins_location_id_fkey`)

**Unique Constraints:**
- `inventory_bins_bin_code_key`: (bin_code)

**Indexes:**
- `inventory_bins_bin_code_key`: `CREATE UNIQUE INDEX inventory_bins_bin_code_key ON public.inventory_bins USING btree (bin_code)`

**RLS Policies:**
- `Authenticated can read bins` (SELECT, permissive, roles: {public})
- `Inventory admins can manage bins` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `inventory_containers`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| room_id | uuid | NO |  |  |
| name | text | NO |  |  |
| sort_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `room_id` -> `inventory_rooms.id` (`inventory_containers_room_id_fkey`)

**Indexes:**
- `idx_inventory_containers_room`: `CREATE INDEX idx_inventory_containers_room ON public.inventory_containers USING btree (room_id)`

#### `inventory_locations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `inventory_locations_name_key`: (name)

**Indexes:**
- `inventory_locations_name_key`: `CREATE UNIQUE INDEX inventory_locations_name_key ON public.inventory_locations USING btree (name)`

#### `inventory_positions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| container_id | uuid | NO |  |  |
| name | text | NO |  |  |
| qr_code_url | text | YES |  |  |
| sort_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `container_id` -> `inventory_containers.id` (`inventory_positions_container_id_fkey`)

**Indexes:**
- `idx_inventory_positions_container`: `CREATE INDEX idx_inventory_positions_container ON public.inventory_positions USING btree (container_id)`

#### `inventory_rooms`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| sort_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

#### `supply_barcodes`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| barcode_value | text | NO |  |  |
| supply_item_id | uuid | YES |  |  |
| item_name | text | YES |  |  |
| ndc | text | YES |  |  |
| strength | text | YES |  |  |
| drug_form | text | YES |  |  |
| manufacturer | text | YES |  |  |
| default_item_type | text | YES | 'medication'::text |  |
| is_ndc | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `supply_item_id` -> `supply_items.id` (`supply_barcodes_supply_item_id_fkey`)

**Unique Constraints:**
- `supply_barcodes_barcode_value_key`: (barcode_value)

**Indexes:**
- `idx_supply_barcodes_item`: `CREATE INDEX idx_supply_barcodes_item ON public.supply_barcodes USING btree (supply_item_id)`
- `idx_supply_barcodes_value`: `CREATE INDEX idx_supply_barcodes_value ON public.supply_barcodes USING btree (barcode_value)`
- `supply_barcodes_barcode_value_key`: `CREATE UNIQUE INDEX supply_barcodes_barcode_value_key ON public.supply_barcodes USING btree (barcode_value)`

**RLS Policies:**
- `Inventory admins can manage supply barcodes` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `supply_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| parent_category_id | uuid | YES |  |  |
| sort_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `parent_category_id` -> `supply_categories.id` (`supply_categories_parent_category_id_fkey`)

**Unique Constraints:**
- `supply_categories_name_key`: (name)

**Indexes:**
- `supply_categories_name_key`: `CREATE UNIQUE INDEX supply_categories_name_key ON public.supply_categories USING btree (name)`

**RLS Policies:**
- `Anyone can read supply categories` (SELECT, permissive, roles: {public})
- `Inventory admins can manage supply categories` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `supply_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| sku | text | YES |  |  |
| category_id | uuid | YES |  |  |
| description | text | YES |  |  |
| item_type | text | NO | 'supply'::text |  |
| quantity | integer | NO | 0 |  |
| unit_of_measure | text | YES | 'each'::text |  |
| reorder_level | integer | YES | 5 |  |
| reorder_quantity | integer | YES | 50 |  |
| lot_number | text | YES |  |  |
| expiration_date | date | YES |  |  |
| expiration_warning_days | integer | YES | 30 |  |
| ndc | text | YES |  |  |
| strength | text | YES |  |  |
| drug_form | text | YES |  |  |
| manufacturer | text | YES |  |  |
| donor | text | YES |  |  |
| location_id | uuid | YES |  |  |
| bin_id | uuid | YES |  |  |
| notes | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |
| updated_by | uuid | YES |  |  |

**Foreign Keys:**
- `location_id` -> `locations.id` (`supply_items_location_id_fkey`)
- `bin_id` -> `inventory_bins.id` (`supply_items_bin_id_fkey`)
- `category_id` -> `supply_categories.id` (`supply_items_category_id_fkey`)

**Unique Constraints:**
- `supply_items_sku_key`: (sku)

**Indexes:**
- `idx_supply_items_category`: `CREATE INDEX idx_supply_items_category ON public.supply_items USING btree (category_id)`
- `idx_supply_items_expiration`: `CREATE INDEX idx_supply_items_expiration ON public.supply_items USING btree (expiration_date) WHERE (expiration_date IS NOT NULL)`
- `idx_supply_items_low_stock`: `CREATE INDEX idx_supply_items_low_stock ON public.supply_items USING btree (quantity, reorder_level) WHERE (is_active = true)`
- `idx_supply_items_sku`: `CREATE INDEX idx_supply_items_sku ON public.supply_items USING btree (sku)`
- `idx_supply_items_type`: `CREATE INDEX idx_supply_items_type ON public.supply_items USING btree (item_type)`
- `supply_items_sku_key`: `CREATE UNIQUE INDEX supply_items_sku_key ON public.supply_items USING btree (sku)`

**RLS Policies:**
- `Authenticated can read supply items` (SELECT, permissive, roles: {public})
- `Inventory admins can manage supply items` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `supply_notifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| supply_item_id | uuid | YES |  |  |
| notification_type | text | NO |  |  |
| severity | text | YES | 'warning'::text |  |
| message | text | NO |  |  |
| acknowledged | boolean | YES | false |  |
| acknowledged_by | uuid | YES |  |  |
| acknowledged_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `supply_item_id` -> `supply_items.id` (`supply_notifications_supply_item_id_fkey`)

**RLS Policies:**
- `Inventory admins can manage supply notifications` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `supply_transactions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| supply_item_id | uuid | NO |  |  |
| transaction_type | text | NO |  |  |
| quantity_change | integer | NO |  |  |
| quantity_before | integer | NO |  |  |
| quantity_after | integer | NO |  |  |
| reason | text | YES |  |  |
| reference_id | uuid | YES |  |  |
| reference_type | text | YES |  |  |
| performed_by | uuid | YES |  |  |
| performed_at | timestamptz | YES | now() |  |
| notes | text | YES |  |  |

**Foreign Keys:**
- `supply_item_id` -> `supply_items.id` (`supply_transactions_supply_item_id_fkey`)

**Indexes:**
- `idx_supply_transactions_date`: `CREATE INDEX idx_supply_transactions_date ON public.supply_transactions USING btree (performed_at DESC)`
- `idx_supply_transactions_item`: `CREATE INDEX idx_supply_transactions_item ON public.supply_transactions USING btree (supply_item_id)`

**RLS Policies:**
- `Authenticated can read supply transactions` (SELECT, permissive, roles: {public})
- `Inventory admins can manage supply transactions` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `medications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| generic_name | text | YES |  |  |
| drug_class | text | YES |  |  |
| indications | text | YES |  |  |
| contraindications | text | YES |  |  |
| side_effects | text | YES |  |  |
| dosing | jsonb | YES | '{}'::jsonb |  |
| routes | text[] | YES |  |  |
| notes | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_medications_class`: `CREATE INDEX idx_medications_class ON public.medications USING btree (drug_class)`
- `idx_medications_name`: `CREATE INDEX idx_medications_name ON public.medications USING btree (name)`

### Library

#### `library_checkouts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| library_copy_id | uuid | NO |  |  |
| student_id | uuid | NO |  |  |
| checked_out_by | uuid | YES |  |  |
| checked_out_at | timestamptz | YES | now() |  |
| due_date | date | NO |  |  |
| returned_at | timestamptz | YES |  |  |
| returned_to | uuid | YES |  |  |
| status | text | NO | 'active'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `library_copy_id` -> `library_copies.id` (`library_checkouts_library_copy_id_fkey`)
- `student_id` -> `students.id` (`library_checkouts_student_id_fkey`)

**Indexes:**
- `idx_library_checkouts_copy`: `CREATE INDEX idx_library_checkouts_copy ON public.library_checkouts USING btree (library_copy_id)`
- `idx_library_checkouts_due`: `CREATE INDEX idx_library_checkouts_due ON public.library_checkouts USING btree (due_date) WHERE (status = 'active'::text)`
- `idx_library_checkouts_status`: `CREATE INDEX idx_library_checkouts_status ON public.library_checkouts USING btree (status)`
- `idx_library_checkouts_student`: `CREATE INDEX idx_library_checkouts_student ON public.library_checkouts USING btree (student_id)`

**RLS Policies:**
- `Authenticated can read library checkouts` (SELECT, permissive, roles: {public})
- `Inventory admins can manage library checkouts` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `library_copies`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| library_item_id | uuid | NO |  |  |
| barcode | text | NO |  |  |
| copy_number | integer | NO |  |  |
| status | text | NO | 'available'::text |  |
| condition | text | YES | 'good'::text |  |
| location | text | YES |  |  |
| notes | text | YES |  |  |
| needs_label | boolean | YES | false |  |
| label_printed_at | timestamptz | YES |  |  |
| label_printed_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `library_item_id` -> `library_items.id` (`library_copies_library_item_id_fkey`)

**Unique Constraints:**
- `library_copies_barcode_key`: (barcode)
- `library_copies_library_item_id_copy_number_key`: (copy_number, library_item_id)

**Indexes:**
- `idx_library_copies_barcode`: `CREATE INDEX idx_library_copies_barcode ON public.library_copies USING btree (barcode)`
- `idx_library_copies_item`: `CREATE INDEX idx_library_copies_item ON public.library_copies USING btree (library_item_id)`
- `idx_library_copies_status`: `CREATE INDEX idx_library_copies_status ON public.library_copies USING btree (status)`
- `library_copies_barcode_key`: `CREATE UNIQUE INDEX library_copies_barcode_key ON public.library_copies USING btree (barcode)`
- `library_copies_library_item_id_copy_number_key`: `CREATE UNIQUE INDEX library_copies_library_item_id_copy_number_key ON public.library_copies USING btree (library_item_id, copy_number)`

**RLS Policies:**
- `Authenticated can read library copies` (SELECT, permissive, roles: {public})
- `Inventory admins can manage library copies` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `library_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| isbn | text | YES |  |  |
| title | text | NO |  |  |
| author | text | YES |  |  |
| publisher | text | YES |  |  |
| edition | text | YES |  |  |
| publication_year | integer | YES |  |  |
| subject | text | YES |  |  |
| category | text | YES |  |  |
| cover_image_url | text | YES |  |  |
| description | text | YES |  |  |
| notes | text | YES |  |  |
| total_copies | integer | NO | 0 |  |
| available_copies | integer | NO | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `library_items_isbn_key`: (isbn)

**Indexes:**
- `idx_library_items_isbn`: `CREATE INDEX idx_library_items_isbn ON public.library_items USING btree (isbn)`
- `idx_library_items_title`: `CREATE INDEX idx_library_items_title ON public.library_items USING btree (title)`
- `library_items_isbn_key`: `CREATE UNIQUE INDEX library_items_isbn_key ON public.library_items USING btree (isbn)`

**RLS Policies:**
- `Authenticated can read library items` (SELECT, permissive, roles: {public})
- `Inventory admins can manage library items` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `library_scanning_sessions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| session_type | text | NO |  |  |
| user_id | uuid | NO |  |  |
| started_at | timestamptz | YES | now() |  |
| completed_at | timestamptz | YES |  |  |
| student_id | uuid | YES |  |  |
| due_date | date | YES |  |  |
| scanned_items | jsonb | YES | '[]'::jsonb |  |
| notes | text | YES |  |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`library_scanning_sessions_student_id_fkey`)

**RLS Policies:**
- `Inventory admins can manage scanning sessions` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

### 3D Printing

#### `print_failures`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| request_id | uuid | YES |  |  |
| printer_id | uuid | YES |  |  |
| filament_type_id | uuid | YES |  |  |
| failure_type | text | NO |  |  |
| description | text | NO |  |  |
| waste_grams | numeric | NO | 0 |  |
| waste_cost | numeric | YES |  |  |
| failed_at | timestamptz | YES | now() |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `filament_type_id` -> `filament_types.id` (`print_failures_filament_type_id_fkey`)
- `request_id` -> `print_requests.id` (`print_failures_request_id_fkey`)
- `printer_id` -> `printers.id` (`print_failures_printer_id_fkey`)

**Check Constraints:**
- `print_failures_failure_type_check`: `(failure_type = ANY (ARRAY['adhesion'::text, 'warping'::text, 'stringing'::text, 'layer_shift'::text, 'nozzle_clog'::text, 'power_loss'::text, 'file_error'::text, 'material_issue'::text, 'other'::text]))`

**RLS Policies:**
- `Operators can manage failures` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})
- `Users can view own request failures` (SELECT, permissive, roles: {public})

#### `print_notifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO |  |  |
| request_id | uuid | YES |  |  |
| type | text | NO |  |  |
| title | text | NO |  |  |
| message | text | NO |  |  |
| read_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `request_id` -> `print_requests.id` (`print_notifications_request_id_fkey`)

**Check Constraints:**
- `print_notifications_type_check`: `(type = ANY (ARRAY['status_change'::text, 'mention'::text, 'comment'::text, 'completion'::text]))`

**Indexes:**
- `idx_print_notifications_read_at`: `CREATE INDEX idx_print_notifications_read_at ON public.print_notifications USING btree (read_at) WHERE (read_at IS NULL)`
- `idx_print_notifications_user_id`: `CREATE INDEX idx_print_notifications_user_id ON public.print_notifications USING btree (user_id)`

**RLS Policies:**
- `Superadmins have full access` (ALL, permissive, roles: {public})
- `System can insert notifications` (INSERT, permissive, roles: {public})
- `Users can update own notifications` (UPDATE, permissive, roles: {public})
- `Users can view own notifications` (SELECT, permissive, roles: {public})

#### `print_request_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| request_id | uuid | NO |  |  |
| old_status | text | YES |  |  |
| new_status | text | NO |  |  |
| changed_by | uuid | YES |  |  |
| note | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `request_id` -> `print_requests.id` (`print_request_history_request_id_fkey`)

**Indexes:**
- `idx_print_request_history_request_id`: `CREATE INDEX idx_print_request_history_request_id ON public.print_request_history USING btree (request_id)`

**RLS Policies:**
- `Operators can view all history` (SELECT, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})
- `System can insert history` (INSERT, permissive, roles: {public})
- `Users can view own request history` (SELECT, permissive, roles: {public})

#### `print_request_materials`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| request_id | uuid | NO |  |  |
| filament_type_id | uuid | NO |  |  |
| estimated_grams | numeric | YES |  |  |
| estimated_cost | numeric | YES |  |  |
| actual_grams | numeric | YES |  |  |
| actual_cost | numeric | YES |  |  |
| sort_order | integer | NO | 0 |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `request_id` -> `print_requests.id` (`print_request_materials_request_id_fkey`)
- `filament_type_id` -> `filament_types.id` (`print_request_materials_filament_type_id_fkey`)

**Indexes:**
- `idx_print_request_materials_request_id`: `CREATE INDEX idx_print_request_materials_request_id ON public.print_request_materials USING btree (request_id)`

**RLS Policies:**
- `Operators can manage materials` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})
- `Users can view own request materials` (SELECT, permissive, roles: {public})

#### `print_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO |  |  |
| reorder_of | uuid | YES |  |  |
| title | text | NO |  |  |
| file_link | text | YES |  |  |
| file_url | text | YES |  |  |
| quantity | integer | NO | 1 |  |
| needed_by | date | YES |  |  |
| purpose | text | NO |  |  |
| department | text | NO |  |  |
| material_preference_id | uuid | YES |  |  |
| material_other | text | YES |  |  |
| special_instructions | text | YES |  |  |
| comparable_link | text | YES |  |  |
| comparable_value | numeric | YES |  |  |
| comparable_quantity | integer | YES | 1 |  |
| priority_score | integer | NO | 50 |  |
| status | text | NO | 'submitted'::text |  |
| operator_id | uuid | YES |  |  |
| acknowledged_at | timestamptz | YES |  |  |
| filament_type_id | uuid | YES |  |  |
| filament_grams | numeric | YES |  |  |
| print_cost | numeric | YES |  |  |
| estimated_print_minutes | integer | YES |  |  |
| sliced_at | timestamptz | YES |  |  |
| is_multi_material | boolean | YES | false |  |
| printer_id | uuid | YES |  |  |
| print_started_at | timestamptz | YES |  |  |
| print_eta | timestamptz | YES |  |  |
| quantity_completed | integer | YES |  |  |
| actual_print_minutes | integer | YES |  |  |
| actual_filament_grams | numeric | YES |  |  |
| final_print_cost | numeric | YES |  |  |
| savings | numeric | YES |  |  |
| quality_notes | text | YES |  |  |
| completion_photo_url | text | YES |  |  |
| completed_at | timestamptz | YES |  |  |
| delayed_at | timestamptz | YES |  |  |
| delay_reason | text | YES |  |  |
| total_waste_grams | numeric | YES | 0 |  |
| total_waste_cost | numeric | YES | 0 |  |
| picked_up_at | timestamptz | YES |  |  |
| cancelled_at | timestamptz | YES |  |  |
| cancellation_reason | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| cost_type | text | YES | 'cost_savings'::text |  |

**Foreign Keys:**
- `filament_type_id` -> `filament_types.id` (`print_requests_filament_type_id_fkey`)
- `printer_id` -> `printers.id` (`print_requests_printer_id_fkey`)
- `reorder_of` -> `print_requests.id` (`print_requests_reorder_of_fkey`)
- `material_preference_id` -> `filament_types.id` (`print_requests_material_preference_id_fkey`)

**Check Constraints:**
- `print_requests_purpose_check`: `(purpose = ANY (ARRAY['student'::text, 'administrative'::text]))`
- `print_requests_cost_type_check`: `(cost_type = ANY (ARRAY['cost_savings'::text, 'value_add'::text, 'rd_prototype'::text, 'gift_promotional'::text, 'maintenance_repair'::text]))`

**Indexes:**
- `idx_print_requests_cost_type`: `CREATE INDEX idx_print_requests_cost_type ON public.print_requests USING btree (cost_type)`
- `idx_print_requests_created_at`: `CREATE INDEX idx_print_requests_created_at ON public.print_requests USING btree (created_at DESC)`
- `idx_print_requests_operator_id`: `CREATE INDEX idx_print_requests_operator_id ON public.print_requests USING btree (operator_id)`
- `idx_print_requests_status`: `CREATE INDEX idx_print_requests_status ON public.print_requests USING btree (status)`
- `idx_print_requests_user_id`: `CREATE INDEX idx_print_requests_user_id ON public.print_requests USING btree (user_id)`

**RLS Policies:**
- `Operators can update requests` (UPDATE, permissive, roles: {public})
- `Operators can view all requests` (SELECT, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})
- `Users can create requests` (INSERT, permissive, roles: {public})
- `Users can update own pending requests` (UPDATE, permissive, roles: {public})
- `Users can view own requests` (SELECT, permissive, roles: {public})

#### `printer_hour_adjustments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| printer_id | uuid | NO |  |  |
| adjustment_type | text | NO |  |  |
| hours | numeric | NO |  |  |
| hours_before | numeric | NO |  |  |
| hours_after | numeric | NO |  |  |
| reason | text | NO |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `printer_id` -> `printers.id` (`printer_hour_adjustments_printer_id_fkey`)

**Check Constraints:**
- `printer_hour_adjustments_hours_check`: `(hours > (0)::numeric)`
- `printer_hour_adjustments_adjustment_type_check`: `(adjustment_type = ANY (ARRAY['add'::text, 'remove'::text]))`

**Indexes:**
- `idx_printer_hour_adj_created`: `CREATE INDEX idx_printer_hour_adj_created ON public.printer_hour_adjustments USING btree (created_at)`
- `idx_printer_hour_adj_printer`: `CREATE INDEX idx_printer_hour_adj_printer ON public.printer_hour_adjustments USING btree (printer_id)`

**RLS Policies:**
- `Operators can manage hour adjustments` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `printer_maintenance`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| printer_id | uuid | NO |  |  |
| maintenance_type | text | NO |  |  |
| description | text | NO |  |  |
| parts_replaced | text | YES |  |  |
| cost | numeric | YES |  |  |
| performed_by | text | YES |  |  |
| print_hours_at_service | numeric | YES |  |  |
| maintenance_date | date | NO | CURRENT_DATE |  |
| next_maintenance_due | date | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `printer_id` -> `printers.id` (`printer_maintenance_printer_id_fkey`)

**Check Constraints:**
- `printer_maintenance_maintenance_type_check`: `(maintenance_type = ANY (ARRAY['routine'::text, 'repair'::text, 'calibration'::text, 'cleaning'::text, 'upgrade'::text]))`

**RLS Policies:**
- `Anyone can view maintenance` (SELECT, permissive, roles: {public})
- `Operators can manage maintenance` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `printers`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| model | text | NO |  |  |
| location | text | YES |  |  |
| status | text | NO | 'active'::text |  |
| total_print_hours | numeric | YES | 0 |  |
| last_maintenance_date | timestamptz | YES |  |  |
| next_maintenance_date | timestamptz | YES |  |  |
| maintenance_interval_hours | integer | YES | 500 |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `printers_status_check`: `(status = ANY (ARRAY['active'::text, 'maintenance'::text, 'offline'::text]))`

**RLS Policies:**
- `Anyone can view printers` (SELECT, permissive, roles: {public})
- `Operators can manage printers` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

### Access Control

#### `access_cards`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| card_uid | text | NO |  |  |
| card_type | text | NO | 'standard'::text |  |
| label | text | YES |  |  |
| lab_user_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| visitor_name | text | YES |  |  |
| visitor_organization | text | YES |  |  |
| status | text | NO | 'active'::text |  |
| activated_at | timestamptz | YES | now() |  |
| deactivated_at | timestamptz | YES |  |  |
| expires_at | timestamptz | YES |  |  |
| notes | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`access_cards_student_id_fkey`)
- `lab_user_id` -> `lab_users.id` (`access_cards_lab_user_id_fkey`)

**Unique Constraints:**
- `access_cards_card_uid_key`: (card_uid)

**Check Constraints:**
- `access_cards_type_check`: `(card_type = ANY (ARRAY['standard'::text, 'master'::text, 'visitor'::text, 'temporary'::text]))`
- `access_cards_status_check`: `(status = ANY (ARRAY['active'::text, 'inactive'::text, 'lost'::text, 'revoked'::text]))`
- `access_cards_single_owner`: `(((
CASE
    WHEN (lab_user_id IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN (student_id IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN (visitor_name IS NOT NULL) THEN 1
    ELSE 0
END) <= 1)`

**Indexes:**
- `access_cards_card_uid_key`: `CREATE UNIQUE INDEX access_cards_card_uid_key ON public.access_cards USING btree (card_uid)`
- `idx_access_cards_active`: `CREATE INDEX idx_access_cards_active ON public.access_cards USING btree (is_active) WHERE (is_active = true)`
- `idx_access_cards_lab_user`: `CREATE INDEX idx_access_cards_lab_user ON public.access_cards USING btree (lab_user_id) WHERE (lab_user_id IS NOT NULL)`
- `idx_access_cards_status`: `CREATE INDEX idx_access_cards_status ON public.access_cards USING btree (status)`
- `idx_access_cards_student`: `CREATE INDEX idx_access_cards_student ON public.access_cards USING btree (student_id) WHERE (student_id IS NOT NULL)`
- `idx_access_cards_uid`: `CREATE INDEX idx_access_cards_uid ON public.access_cards USING btree (card_uid)`

**RLS Policies:**
- `Access admins can manage cards` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `access_devices`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| door_id | uuid | NO |  |  |
| device_name | text | NO |  |  |
| hardware_id | text | YES |  |  |
| ip_address | text | YES |  |  |
| firmware_version | text | YES |  |  |
| last_heartbeat_at | timestamptz | YES |  |  |
| last_sync_at | timestamptz | YES |  |  |
| is_online | boolean | YES | false |  |
| config_version | integer | YES | 1 |  |
| force_sync | boolean | YES | false |  |
| notes | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |
| force_restart | boolean | YES | false |  |
| last_restart_requested_at | timestamptz | YES |  |  |
| last_restart_completed_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `door_id` -> `access_doors.id` (`access_devices_door_id_fkey`)

**Unique Constraints:**
- `access_devices_hardware_id_key`: (hardware_id)

**Indexes:**
- `access_devices_hardware_id_key`: `CREATE UNIQUE INDEX access_devices_hardware_id_key ON public.access_devices USING btree (hardware_id)`
- `idx_access_devices_active`: `CREATE INDEX idx_access_devices_active ON public.access_devices USING btree (is_active) WHERE (is_active = true)`
- `idx_access_devices_door`: `CREATE INDEX idx_access_devices_door ON public.access_devices USING btree (door_id)`
- `idx_access_devices_heartbeat`: `CREATE INDEX idx_access_devices_heartbeat ON public.access_devices USING btree (last_heartbeat_at)`
- `idx_access_devices_online`: `CREATE INDEX idx_access_devices_online ON public.access_devices USING btree (is_online)`

**RLS Policies:**
- `Access admins can manage devices` (ALL, permissive, roles: {public})
- `OPS users can view devices` (SELECT, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `access_device_heartbeats`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| access_device_id | uuid | NO |  |  |
| reported_at | timestamptz | NO | now() |  |
| ip_address | text | YES |  |  |
| cpu_temp_c | numeric | YES |  |  |
| memory_used_mb | integer | YES |  |  |
| disk_used_percent | integer | YES |  |  |
| uptime_seconds | bigint | YES |  |  |
| sqlite_record_count | integer | YES |  |  |
| firmware_version | text | YES |  |  |
| wifi_signal_dbm | integer | YES |  |  |

**Foreign Keys:**
- `access_device_id` -> `access_devices.id` (`access_device_heartbeats_access_device_id_fkey`)

**Indexes:**
- `idx_heartbeats_device`: `CREATE INDEX idx_heartbeats_device ON public.access_device_heartbeats USING btree (access_device_id)`
- `idx_heartbeats_time`: `CREATE INDEX idx_heartbeats_time ON public.access_device_heartbeats USING btree (reported_at DESC)`

**RLS Policies:**
- `Access admins can view heartbeats` (SELECT, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `access_doors`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| location | text | YES |  |  |
| location_id | uuid | YES |  |  |
| description | text | YES |  |  |
| status | text | NO | 'active'::text |  |
| unlock_duration_seconds | integer | NO | 5 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `location_id` -> `locations.id` (`access_doors_location_id_fkey`)

**Check Constraints:**
- `access_doors_status_check`: `(status = ANY (ARRAY['active'::text, 'disabled'::text, 'maintenance'::text]))`

**Indexes:**
- `idx_access_doors_active`: `CREATE INDEX idx_access_doors_active ON public.access_doors USING btree (is_active) WHERE (is_active = true)`
- `idx_access_doors_location`: `CREATE INDEX idx_access_doors_location ON public.access_doors USING btree (location_id) WHERE (location_id IS NOT NULL)`
- `idx_access_doors_status`: `CREATE INDEX idx_access_doors_status ON public.access_doors USING btree (status)`

**RLS Policies:**
- `Access admins can manage doors` (ALL, permissive, roles: {public})
- `OPS users can view doors` (SELECT, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `access_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| access_door_id | uuid | YES |  |  |
| access_device_id | uuid | YES |  |  |
| card_uid | text | YES |  |  |
| access_card_id | uuid | YES |  |  |
| result | text | NO |  |  |
| leaf | integer | YES |  |  |
| event_at | timestamptz | NO | now() |  |
| door_unlocked_at | timestamptz | YES |  |  |
| door_locked_at | timestamptz | YES |  |  |
| synced_at | timestamptz | YES |  |  |
| pi_event_id | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `access_door_id` -> `access_doors.id` (`access_logs_access_door_id_fkey`)
- `access_card_id` -> `access_cards.id` (`access_logs_access_card_id_fkey`)
- `access_device_id` -> `access_devices.id` (`access_logs_access_device_id_fkey`)

**Unique Constraints:**
- `access_logs_pi_event_id_key`: (pi_event_id)

**Check Constraints:**
- `access_logs_result_check`: `(result = ANY (ARRAY['granted'::text, 'denied_unknown_card'::text, 'denied_inactive_card'::text, 'denied_no_rule'::text, 'denied_schedule'::text, 'denied_expired'::text, 'denied_door_disabled'::text, 'rex_unlock'::text, 'door_held_open'::text, 'door_forced'::text]))`

**Indexes:**
- `access_logs_pi_event_id_key`: `CREATE UNIQUE INDEX access_logs_pi_event_id_key ON public.access_logs USING btree (pi_event_id)`
- `idx_access_logs_card`: `CREATE INDEX idx_access_logs_card ON public.access_logs USING btree (access_card_id)`
- `idx_access_logs_card_uid`: `CREATE INDEX idx_access_logs_card_uid ON public.access_logs USING btree (card_uid)`
- `idx_access_logs_door`: `CREATE INDEX idx_access_logs_door ON public.access_logs USING btree (access_door_id)`
- `idx_access_logs_event_at`: `CREATE INDEX idx_access_logs_event_at ON public.access_logs USING btree (event_at DESC)`
- `idx_access_logs_pi_event`: `CREATE INDEX idx_access_logs_pi_event ON public.access_logs USING btree (pi_event_id) WHERE (pi_event_id IS NOT NULL)`
- `idx_access_logs_result`: `CREATE INDEX idx_access_logs_result ON public.access_logs USING btree (result)`

**RLS Policies:**
- `Access admins can insert logs` (INSERT, permissive, roles: {public})
- `OPS users can view access logs` (SELECT, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `access_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| email | text | NO |  |  |
| name | text | YES |  |  |
| requested_role | text | YES | 'volunteer_instructor'::text |  |
| reason | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| reviewed_by | text | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |
| denial_reason | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_access_requests_email`: `CREATE INDEX idx_access_requests_email ON public.access_requests USING btree (email)`
- `idx_access_requests_status`: `CREATE INDEX idx_access_requests_status ON public.access_requests USING btree (status)`

**RLS Policies:**
- `Service role full access` (ALL, permissive, roles: {public})

#### `access_rules`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| access_card_id | uuid | NO |  |  |
| access_door_id | uuid | NO |  |  |
| access_schedule_id | uuid | YES |  |  |
| priority | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| valid_from | timestamptz | YES |  |  |
| valid_until | timestamptz | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**Foreign Keys:**
- `access_door_id` -> `access_doors.id` (`access_rules_access_door_id_fkey`)
- `access_schedule_id` -> `access_schedules.id` (`access_rules_access_schedule_id_fkey`)
- `access_card_id` -> `access_cards.id` (`access_rules_access_card_id_fkey`)

**Unique Constraints:**
- `access_rules_access_card_id_access_door_id_key`: (access_card_id, access_door_id)

**Indexes:**
- `access_rules_access_card_id_access_door_id_key`: `CREATE UNIQUE INDEX access_rules_access_card_id_access_door_id_key ON public.access_rules USING btree (access_card_id, access_door_id)`
- `idx_access_rules_active`: `CREATE INDEX idx_access_rules_active ON public.access_rules USING btree (is_active) WHERE (is_active = true)`
- `idx_access_rules_card`: `CREATE INDEX idx_access_rules_card ON public.access_rules USING btree (access_card_id)`
- `idx_access_rules_door`: `CREATE INDEX idx_access_rules_door ON public.access_rules USING btree (access_door_id)`

**RLS Policies:**
- `Access admins can manage rules` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `access_schedules`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| monday | boolean | YES | true |  |
| tuesday | boolean | YES | true |  |
| wednesday | boolean | YES | true |  |
| thursday | boolean | YES | true |  |
| friday | boolean | YES | true |  |
| saturday | boolean | YES | false |  |
| sunday | boolean | YES | false |  |
| start_time | time without time zone | NO | '06:00:00'::time without time zone |  |
| end_time | time without time zone | NO | '22:00:00'::time without time zone |  |
| timezone | text | NO | 'America/Los_Angeles'::text |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |

**RLS Policies:**
- `Access admins can manage schedules` (ALL, permissive, roles: {public})
- `OPS users can view schedules` (SELECT, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `timer_display_tokens`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| token | text | NO | encode(gen_random_bytes(16), 'hex'::text) |  |
| room_name | text | NO |  |  |
| lab_room_id | uuid | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| last_used_at | timestamptz | YES |  |  |
| created_by | uuid | YES |  |  |
| timer_type | text | YES | 'fixed'::text |  |

**Foreign Keys:**
- `created_by` -> `lab_users.id` (`timer_display_tokens_created_by_fkey`)

**Unique Constraints:**
- `timer_display_tokens_token_key`: (token)

**Check Constraints:**
- `timer_display_tokens_timer_type_check`: `(timer_type = ANY (ARRAY['fixed'::text, 'mobile'::text]))`

**Indexes:**
- `idx_timer_display_tokens_active`: `CREATE INDEX idx_timer_display_tokens_active ON public.timer_display_tokens USING btree (is_active)`
- `idx_timer_display_tokens_lab_room`: `CREATE INDEX idx_timer_display_tokens_lab_room ON public.timer_display_tokens USING btree (lab_room_id)`
- `idx_timer_display_tokens_token`: `CREATE INDEX idx_timer_display_tokens_token ON public.timer_display_tokens USING btree (token)`
- `timer_display_tokens_token_key`: `CREATE UNIQUE INDEX timer_display_tokens_token_key ON public.timer_display_tokens USING btree (token)`

**RLS Policies:**
- `Authenticated users can manage timer tokens` (ALL, permissive, roles: {authenticated})
- `Authenticated users can manage tokens` (ALL, permissive, roles: {authenticated})
- `Public read active tokens` (SELECT, permissive, roles: {public})

### Compliance & Certifications

#### `compliance_document_types`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| is_required | boolean | YES | true |  |
| expiration_months | integer | YES |  |  |
| sort_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**RLS Policies:**
- `Allow authenticated read of doc types` (SELECT, permissive, roles: {authenticated})

#### `ce_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| instructor_id | uuid | NO |  |  |
| certification_id | uuid | NO |  |  |
| title | text | NO |  |  |
| provider | text | YES |  |  |
| hours | numeric | NO |  |  |
| category | text | YES |  |  |
| completion_date | date | NO |  |  |
| certificate_image_url | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `instructor_id` -> `lab_users.id` (`ce_records_instructor_id_fkey`)
- `certification_id` -> `instructor_certifications.id` (`ce_records_certification_id_fkey`)

**Indexes:**
- `idx_ce_records_certification`: `CREATE INDEX idx_ce_records_certification ON public.ce_records USING btree (certification_id)`
- `idx_ce_records_instructor`: `CREATE INDEX idx_ce_records_instructor ON public.ce_records USING btree (instructor_id)`

**RLS Policies:**
- `Allow all for ce_records` (ALL, permissive, roles: {public})

#### `ce_requirements`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cert_type | text | NO |  |  |
| display_name | text | NO |  |  |
| issuing_body | text | NO |  |  |
| cycle_years | integer | NO | 2 |  |
| total_hours_required | integer | NO |  |  |
| category_requirements | jsonb | YES |  |  |
| notes | text | YES |  |  |
| source_url | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**RLS Policies:**
- `Allow all for ce_requirements` (ALL, permissive, roles: {public})

#### `cert_notifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| certification_id | uuid | NO |  |  |
| instructor_id | uuid | NO |  |  |
| notification_type | text | NO |  |  |
| sent_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `instructor_id` -> `lab_users.id` (`cert_notifications_instructor_id_fkey`)
- `certification_id` -> `instructor_certifications.id` (`cert_notifications_certification_id_fkey`)

**Unique Constraints:**
- `cert_notifications_certification_id_notification_type_key`: (notification_type, certification_id)

**Indexes:**
- `cert_notifications_certification_id_notification_type_key`: `CREATE UNIQUE INDEX cert_notifications_certification_id_notification_type_key ON public.cert_notifications USING btree (certification_id, notification_type)`
- `idx_cert_notifications_cert`: `CREATE INDEX idx_cert_notifications_cert ON public.cert_notifications USING btree (certification_id)`

**RLS Policies:**
- `Allow all for cert_notifications` (ALL, permissive, roles: {public})

### Agencies & Affiliations

#### `agencies`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| abbreviation | text | YES |  |  |
| type | text | NO |  |  |
| address | text | YES |  |  |
| phone | text | YES |  |  |
| website | text | YES |  |  |
| notes | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| max_students_per_day | integer | YES | 2 |  |
| max_students_per_rotation | integer | YES |  |  |
| capacity_notes | text | YES |  |  |
| updated_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_agencies_capacity`: `CREATE INDEX idx_agencies_capacity ON public.agencies USING btree (max_students_per_day) WHERE (is_active = true)`

**RLS Policies:**
- `Allow all access to agencies` (ALL, permissive, roles: {public})
- `Allow read access to agencies` (SELECT, permissive, roles: {public})

#### `agency_contacts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| agency_id | uuid | YES |  |  |
| name | text | NO |  |  |
| title | text | YES |  |  |
| department | text | YES |  |  |
| email | text | YES |  |  |
| phone | text | YES |  |  |
| is_primary | boolean | YES | false |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `agency_id` -> `agencies.id` (`agency_contacts_agency_id_fkey`)

**RLS Policies:**
- `Authenticated can view contacts` (SELECT, permissive, roles: {public})
- `Service role manages contacts` (ALL, permissive, roles: {public})

#### `alumni`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| name | text | NO |  |  |
| email | text | YES |  |  |
| phone | text | YES |  |  |
| graduation_date | date | YES |  |  |
| program | text | YES |  |  |
| employer | text | YES |  |  |
| job_title | text | YES |  |  |
| employment_status | text | YES |  |  |
| continuing_education | text | YES |  |  |
| notes | text | YES |  |  |
| last_contact_date | date | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| first_name | text | YES |  |  |
| last_name | text | YES |  |  |
| cohort_id | uuid | YES |  |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`alumni_student_id_fkey`)
- `cohort_id` -> `cohorts.id` (`alumni_cohort_id_fkey`)

**Indexes:**
- `idx_alumni_cohort`: `CREATE INDEX idx_alumni_cohort ON public.alumni USING btree (cohort_id)`
- `idx_alumni_program`: `CREATE INDEX idx_alumni_program ON public.alumni USING btree (program)`
- `idx_alumni_status`: `CREATE INDEX idx_alumni_status ON public.alumni USING btree (employment_status)`
- `idx_alumni_student`: `CREATE INDEX idx_alumni_student ON public.alumni USING btree (student_id)`

**RLS Policies:**
- `admin_all_alumni` (ALL, permissive, roles: {authenticated})

#### `affiliation_notifications_log`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| affiliation_id | uuid | NO |  |  |
| notification_type | text | NO |  |  |
| sent_date | date | NO | CURRENT_DATE |  |
| sent_at | timestamptz | YES | now() |  |
| recipients | text[] | YES |  |  |

**Foreign Keys:**
- `affiliation_id` -> `clinical_affiliations.id` (`affiliation_notifications_log_affiliation_id_fkey`)

**Indexes:**
- `idx_affiliation_notif_dedup`: `CREATE UNIQUE INDEX idx_affiliation_notif_dedup ON public.affiliation_notifications_log USING btree (affiliation_id, notification_type, sent_date)`

**RLS Policies:**
- `Authenticated users view notification logs` (ALL, permissive, roles: {public})

### Seating & Classrooms

#### `classrooms`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| name | text | NO |  |  |
| description | text | YES |  |  |
| rows | integer | NO |  |  |
| tables_per_row | integer | NO |  |  |
| seats_per_table | integer | NO |  |  |
| layout_config | jsonb | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**RLS Policies:**
- `Authenticated users can view classrooms` (SELECT, permissive, roles: {public})

#### `seat_assignments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| seating_chart_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| table_number | integer | NO |  |  |
| seat_position | integer | NO |  |  |
| row_number | integer | NO |  |  |
| is_overflow | boolean | YES | false |  |
| is_manual_override | boolean | YES | false |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`seat_assignments_student_id_fkey`)
- `seating_chart_id` -> `seating_charts.id` (`seat_assignments_seating_chart_id_fkey`)

**Unique Constraints:**
- `seat_assignments_seating_chart_id_student_id_key`: (seating_chart_id, student_id)
- `seat_assignments_seating_chart_id_table_number_seat_positio_key`: (seating_chart_id, seat_position, table_number)

**Indexes:**
- `idx_seat_assignments_chart`: `CREATE INDEX idx_seat_assignments_chart ON public.seat_assignments USING btree (seating_chart_id)`
- `idx_seat_assignments_student`: `CREATE INDEX idx_seat_assignments_student ON public.seat_assignments USING btree (student_id)`
- `seat_assignments_seating_chart_id_student_id_key`: `CREATE UNIQUE INDEX seat_assignments_seating_chart_id_student_id_key ON public.seat_assignments USING btree (seating_chart_id, student_id)`
- `seat_assignments_seating_chart_id_table_number_seat_positio_key`: `CREATE UNIQUE INDEX seat_assignments_seating_chart_id_table_number_seat_positio_key ON public.seat_assignments USING btree (seating_chart_id, table_number, seat_position)`

**RLS Policies:**
- `Allow all deletes on seat assignments` (DELETE, permissive, roles: {public})
- `Allow all inserts on seat assignments` (INSERT, permissive, roles: {public})
- `Allow all updates on seat assignments` (UPDATE, permissive, roles: {public})
- `Authenticated users can view seat assignments` (SELECT, permissive, roles: {public})

#### `seating_charts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| cohort_id | uuid | YES |  |  |
| classroom_id | uuid | YES |  |  |
| name | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`seating_charts_cohort_id_fkey`)
- `classroom_id` -> `classrooms.id` (`seating_charts_classroom_id_fkey`)

**Indexes:**
- `idx_seating_charts_cohort`: `CREATE INDEX idx_seating_charts_cohort ON public.seating_charts USING btree (cohort_id)`

**RLS Policies:**
- `Allow all deletes on seating charts` (DELETE, permissive, roles: {public})
- `Allow all inserts on seating charts` (INSERT, permissive, roles: {public})
- `Allow all updates on seating charts` (UPDATE, permissive, roles: {public})
- `Authenticated users can view seating charts` (SELECT, permissive, roles: {public})

#### `seating_preferences`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | uuid_generate_v4() | PK |
| student_id | uuid | YES |  |  |
| other_student_id | uuid | YES |  |  |
| preference_type | text | YES |  |  |
| reason | text | YES |  |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`seating_preferences_student_id_fkey`)
- `other_student_id` -> `students.id` (`seating_preferences_other_student_id_fkey`)

**Unique Constraints:**
- `seating_preferences_student_id_other_student_id_key`: (student_id, other_student_id)

**Check Constraints:**
- `seating_preferences_preference_type_check`: `(preference_type = ANY (ARRAY['avoid'::text, 'prefer_near'::text]))`

**Indexes:**
- `idx_seating_preferences_student`: `CREATE INDEX idx_seating_preferences_student ON public.seating_preferences USING btree (student_id)`
- `seating_preferences_student_id_other_student_id_key`: `CREATE UNIQUE INDEX seating_preferences_student_id_other_student_id_key ON public.seating_preferences USING btree (student_id, other_student_id)`

**RLS Policies:**
- `Allow all deletes on seating_preferences` (DELETE, permissive, roles: {public})
- `Allow all inserts on preferences` (INSERT, permissive, roles: {public})
- `Allow all updates on seating_preferences` (UPDATE, permissive, roles: {public})
- `Authenticated users can view preferences` (SELECT, permissive, roles: {public})

### Facilities & Resources

#### `departments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| abbreviation | text | NO |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `departments_abbreviation_key`: (abbreviation)
- `departments_name_key`: (name)

**Indexes:**
- `departments_abbreviation_key`: `CREATE UNIQUE INDEX departments_abbreviation_key ON public.departments USING btree (abbreviation)`
- `departments_name_key`: `CREATE UNIQUE INDEX departments_name_key ON public.departments USING btree (name)`

#### `bookable_resources`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| resource_type | text | YES |  |  |
| location | text | YES |  |  |
| capacity | integer | YES |  |  |
| requires_approval | boolean | YES | false |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

#### `resource_bookings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| resource_id | uuid | NO |  |  |
| booked_by | text | NO |  |  |
| booking_date | date | NO |  |  |
| start_time | time without time zone | NO |  |  |
| end_time | time without time zone | NO |  |  |
| purpose | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| approved_by | text | YES |  |  |
| approved_at | timestamptz | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `resource_id` -> `bookable_resources.id` (`resource_bookings_resource_id_fkey`)

**Check Constraints:**
- `resource_bookings_status_check`: `(status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]))`

**Indexes:**
- `idx_resource_bookings_date`: `CREATE INDEX idx_resource_bookings_date ON public.resource_bookings USING btree (booking_date)`
- `idx_resource_bookings_resource`: `CREATE INDEX idx_resource_bookings_resource ON public.resource_bookings USING btree (resource_id)`
- `idx_resource_bookings_status`: `CREATE INDEX idx_resource_bookings_status ON public.resource_bookings USING btree (status)`
- `idx_resource_bookings_time`: `CREATE INDEX idx_resource_bookings_time ON public.resource_bookings USING btree (start_time, end_time)`

#### `locations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| parent_id | uuid | YES |  |  |
| name | text | NO |  |  |
| qr_code | text | NO |  |  |
| full_path | text | YES |  |  |
| location_type | text | NO |  |  |
| description | text | YES |  |  |
| sort_order | integer | YES | 0 |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| created_by | uuid | YES |  |  |
| is_lab_room | boolean | YES | false |  |

**Foreign Keys:**
- `parent_id` -> `locations.id` (`locations_parent_id_fkey`)

**Unique Constraints:**
- `locations_qr_code_key`: (qr_code)

**Check Constraints:**
- `locations_location_type_check`: `(location_type = ANY (ARRAY['room'::text, 'cabinet'::text, 'shelf'::text, 'drawer'::text, 'cart'::text, 'bin_location'::text]))`

**Indexes:**
- `locations_qr_code_key`: `CREATE UNIQUE INDEX locations_qr_code_key ON public.locations USING btree (qr_code)`

**RLS Policies:**
- `Authenticated can read locations` (SELECT, permissive, roles: {public})
- `Inventory admins can manage locations` (ALL, permissive, roles: {public})
- `Superadmins have full access` (ALL, permissive, roles: {public})

#### `resources`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO |  |  |
| description | text | YES |  |  |
| category | text | YES |  |  |
| file_url | text | YES |  |  |
| external_url | text | YES |  |  |
| version | integer | YES | 1 |  |
| min_role | text | YES | 'instructor'::text |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| resource_type | text | YES |  |  |
| url | text | YES |  |  |
| file_path | text | YES |  |  |
| file_name | text | YES |  |  |
| file_size | integer | YES |  |  |
| uploaded_by | text | YES |  |  |
| linked_skill_ids | text[] | YES |  |  |
| linked_scenario_ids | text[] | YES |  |  |
| is_active | boolean | YES | true |  |

**Check Constraints:**
- `resources_category_check`: `(category = ANY (ARRAY['protocols'::text, 'skill_sheets'::text, 'policies'::text, 'forms'::text, 'other'::text]))`

**Indexes:**
- `idx_resources_active`: `CREATE INDEX idx_resources_active ON public.resources USING btree (is_active) WHERE (is_active = true)`
- `idx_resources_category`: `CREATE INDEX idx_resources_category ON public.resources USING btree (category)`
- `idx_resources_uploaded_by`: `CREATE INDEX idx_resources_uploaded_by ON public.resources USING btree (uploaded_by)`

**RLS Policies:**
- `Service role can do everything on resources` (ALL, permissive, roles: {public})

#### `resource_versions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| resource_id | uuid | YES |  |  |
| version | integer | YES |  |  |
| file_url | text | YES |  |  |
| uploaded_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| file_path | text | YES |  |  |
| file_name | text | YES |  |  |
| url | text | YES |  |  |
| notes | text | YES |  |  |

**Foreign Keys:**
- `resource_id` -> `resources.id` (`resource_versions_resource_id_fkey`)

**Indexes:**
- `idx_resource_versions_resource`: `CREATE INDEX idx_resource_versions_resource ON public.resource_versions USING btree (resource_id)`

**RLS Policies:**
- `Service role can do everything on resource_versions` (ALL, permissive, roles: {public})

### Evaluation & Assessment

#### `peer_evaluations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| lab_day_id | uuid | NO |  |  |
| evaluator_id | uuid | NO |  |  |
| evaluated_id | uuid | NO |  |  |
| communication_score | integer | YES |  |  |
| teamwork_score | integer | YES |  |  |
| leadership_score | integer | YES |  |  |
| is_self_eval | boolean | YES | false |  |
| comments | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`peer_evaluations_lab_day_id_fkey`)
- `evaluator_id` -> `students.id` (`peer_evaluations_evaluator_id_fkey`)
- `evaluated_id` -> `students.id` (`peer_evaluations_evaluated_id_fkey`)

**Unique Constraints:**
- `peer_evaluations_lab_day_id_evaluator_id_evaluated_id_key`: (evaluator_id, lab_day_id, evaluated_id)

**Check Constraints:**
- `peer_evaluations_teamwork_score_check`: `((teamwork_score >= 1) AND (teamwork_score <= 5))`
- `peer_evaluations_leadership_score_check`: `((leadership_score >= 1) AND (leadership_score <= 5))`
- `peer_evaluations_communication_score_check`: `((communication_score >= 1) AND (communication_score <= 5))`

**Indexes:**
- `idx_peer_evaluations_evaluated`: `CREATE INDEX idx_peer_evaluations_evaluated ON public.peer_evaluations USING btree (evaluated_id)`
- `idx_peer_evaluations_lab_day`: `CREATE INDEX idx_peer_evaluations_lab_day ON public.peer_evaluations USING btree (lab_day_id)`
- `peer_evaluations_lab_day_id_evaluator_id_evaluated_id_key`: `CREATE UNIQUE INDEX peer_evaluations_lab_day_id_evaluator_id_evaluated_id_key ON public.peer_evaluations USING btree (lab_day_id, evaluator_id, evaluated_id)`

#### `summative_evaluation_scores`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| evaluation_id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| leadership_scene_score | integer | YES |  |  |
| patient_assessment_score | integer | YES |  |  |
| patient_management_score | integer | YES |  |  |
| interpersonal_score | integer | YES |  |  |
| integration_score | integer | YES |  |  |
| total_score | integer | YES |  |  |
| critical_criteria_failed | boolean | YES | false |  |
| critical_fails_mandatory | boolean | YES | false |  |
| critical_harmful_intervention | boolean | YES | false |  |
| critical_unprofessional | boolean | YES | false |  |
| critical_criteria_notes | text | YES |  |  |
| passed | boolean | YES |  |  |
| examiner_notes | text | YES |  |  |
| grading_complete | boolean | YES | false |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| start_time | time without time zone | YES |  |  |
| end_time | time without time zone | YES |  |  |
| feedback_provided | text | YES |  |  |
| graded_at | timestamptz | YES |  |  |
| graded_by | uuid | YES |  |  |

**Foreign Keys:**
- `graded_by` -> `lab_users.id` (`summative_evaluation_scores_graded_by_fkey`)
- `evaluation_id` -> `summative_evaluations.id` (`summative_evaluation_scores_evaluation_id_fkey`)
- `student_id` -> `students.id` (`summative_evaluation_scores_student_id_fkey`)

**Unique Constraints:**
- `summative_evaluation_scores_evaluation_id_student_id_key`: (evaluation_id, student_id)

**Indexes:**
- `idx_summative_scores_evaluation`: `CREATE INDEX idx_summative_scores_evaluation ON public.summative_evaluation_scores USING btree (evaluation_id)`
- `idx_summative_scores_student`: `CREATE INDEX idx_summative_scores_student ON public.summative_evaluation_scores USING btree (student_id)`
- `summative_evaluation_scores_evaluation_id_student_id_key`: `CREATE UNIQUE INDEX summative_evaluation_scores_evaluation_id_student_id_key ON public.summative_evaluation_scores USING btree (evaluation_id, student_id)`

**RLS Policies:**
- `Authenticated users can manage summative scores` (ALL, permissive, roles: {authenticated})

#### `summative_evaluations`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| scenario_id | uuid | YES |  |  |
| cohort_id | uuid | YES |  |  |
| internship_id | uuid | YES |  |  |
| evaluation_date | date | NO |  |  |
| start_time | time without time zone | YES |  |  |
| examiner_name | text | NO |  |  |
| examiner_email | text | YES |  |  |
| location | text | YES |  |  |
| status | text | YES | 'in_progress'::text |  |
| notes | text | YES |  |  |
| created_by | uuid | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`summative_evaluations_cohort_id_fkey`)
- `created_by` -> `lab_users.id` (`summative_evaluations_created_by_fkey`)
- `scenario_id` -> `summative_scenarios.id` (`summative_evaluations_scenario_id_fkey`)
- `internship_id` -> `student_internships.id` (`summative_evaluations_internship_id_fkey`)

**Indexes:**
- `idx_summative_evaluations_cohort`: `CREATE INDEX idx_summative_evaluations_cohort ON public.summative_evaluations USING btree (cohort_id)`
- `idx_summative_evaluations_date`: `CREATE INDEX idx_summative_evaluations_date ON public.summative_evaluations USING btree (evaluation_date)`
- `idx_summative_evaluations_internship`: `CREATE INDEX idx_summative_evaluations_internship ON public.summative_evaluations USING btree (internship_id)`

**RLS Policies:**
- `Authenticated users can manage summative evaluations` (ALL, permissive, roles: {authenticated})

#### `summative_scenarios`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| scenario_number | integer | NO |  |  |
| title | text | NO |  |  |
| description | text | YES |  |  |
| patient_presentation | text | YES |  |  |
| expected_interventions | text[] | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| linked_scenario_id | uuid | YES |  |  |

**Foreign Keys:**
- `linked_scenario_id` -> `scenarios.id` (`summative_scenarios_linked_scenario_id_fkey`)

**Indexes:**
- `idx_summative_scenarios_linked`: `CREATE INDEX idx_summative_scenarios_linked ON public.summative_scenarios USING btree (linked_scenario_id)`
- `idx_summative_scenarios_number`: `CREATE UNIQUE INDEX idx_summative_scenarios_number ON public.summative_scenarios USING btree (scenario_number) WHERE (is_active = true)`

**RLS Policies:**
- `Authenticated users can read summative scenarios` (SELECT, permissive, roles: {authenticated})

#### `learning_plan_notes`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| plan_id | uuid | NO |  |  |
| note | text | NO |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `plan_id` -> `learning_plans.id` (`learning_plan_notes_plan_id_fkey`)

**Indexes:**
- `idx_learning_plan_notes_plan`: `CREATE INDEX idx_learning_plan_notes_plan ON public.learning_plan_notes USING btree (plan_id)`

#### `learning_plans`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| goals | text | YES |  |  |
| accommodations | jsonb | YES | '[]'::jsonb |  |
| review_date | date | YES |  |  |
| is_active | boolean | YES | true |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`learning_plans_student_id_fkey`)

**Indexes:**
- `idx_learning_plans_student`: `CREATE INDEX idx_learning_plans_student ON public.learning_plans USING btree (student_id)`

#### `program_outcomes`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cohort_id | uuid | YES |  |  |
| program | text | YES |  |  |
| graduation_rate | numeric | YES |  |  |
| cert_pass_rate | numeric | YES |  |  |
| placement_rate | numeric | YES |  |  |
| avg_time_to_completion | integer | YES |  |  |
| report_date | date | YES | CURRENT_DATE |  |
| notes | text | YES |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| year | integer | YES |  |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`program_outcomes_cohort_id_fkey`)

**Indexes:**
- `idx_program_outcomes_cohort`: `CREATE INDEX idx_program_outcomes_cohort ON public.program_outcomes USING btree (cohort_id)`
- `idx_program_outcomes_year`: `CREATE INDEX idx_program_outcomes_year ON public.program_outcomes USING btree (year)`

#### `program_requirements`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| program | text | NO |  |  |
| requirement_type | text | NO |  |  |
| category | text | YES |  |  |
| required_value | integer | NO | 0 |  |
| version | integer | YES | 1 |  |
| effective_date | date | YES | CURRENT_DATE |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `program_requirements_program_check`: `(program = ANY (ARRAY['paramedic'::text, 'aemt'::text, 'emt'::text]))`
- `program_requirements_requirement_type_check`: `(requirement_type = ANY (ARRAY['clinical_hours'::text, 'skills'::text, 'scenarios'::text]))`

**Indexes:**
- `idx_program_requirements_program`: `CREATE INDEX idx_program_requirements_program ON public.program_requirements USING btree (program)`
- `idx_program_requirements_type`: `CREATE INDEX idx_program_requirements_type ON public.program_requirements USING btree (requirement_type)`

#### `protocol_completions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| protocol_category | text | NO |  |  |
| case_count | integer | YES | 1 |  |
| completed_at | timestamptz | YES | now() |  |
| logged_by | uuid | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`protocol_completions_student_id_fkey`)
- `logged_by` -> `lab_users.id` (`protocol_completions_logged_by_fkey`)

**Check Constraints:**
- `protocol_completions_protocol_category_check`: `(protocol_category = ANY (ARRAY['cardiac'::text, 'respiratory'::text, 'trauma'::text, 'medical'::text, 'pediatric'::text, 'obstetric'::text, 'behavioral'::text, 'other'::text]))`

**Indexes:**
- `idx_protocol_completions_category`: `CREATE INDEX idx_protocol_completions_category ON public.protocol_completions USING btree (protocol_category)`
- `idx_protocol_completions_student`: `CREATE INDEX idx_protocol_completions_student ON public.protocol_completions USING btree (student_id)`

**RLS Policies:**
- `protocol_completions_delete_policy` (DELETE, permissive, roles: {public})
- `protocol_completions_insert_policy` (INSERT, permissive, roles: {public})
- `protocol_completions_select_policy` (SELECT, permissive, roles: {public})
- `protocol_completions_update_policy` (UPDATE, permissive, roles: {public})

#### `ekg_warmup_scores`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | YES |  |  |
| score | integer | NO |  |  |
| max_score | integer | YES | 10 |  |
| is_baseline | boolean | YES | false |  |
| is_self_reported | boolean | YES | false |  |
| missed_rhythms | text[] | YES |  |  |
| logged_by | uuid | YES |  |  |
| date | date | NO | CURRENT_DATE |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `logged_by` -> `lab_users.id` (`ekg_warmup_scores_logged_by_fkey`)
- `student_id` -> `students.id` (`ekg_warmup_scores_student_id_fkey`)

**Indexes:**
- `idx_ekg_scores_baseline`: `CREATE INDEX idx_ekg_scores_baseline ON public.ekg_warmup_scores USING btree (is_baseline) WHERE (is_baseline = true)`
- `idx_ekg_scores_student`: `CREATE INDEX idx_ekg_scores_student ON public.ekg_warmup_scores USING btree (student_id, date DESC)`

**RLS Policies:**
- `ekg_scores_delete_policy` (DELETE, permissive, roles: {public})
- `ekg_scores_insert_policy` (INSERT, permissive, roles: {public})
- `ekg_scores_select_policy` (SELECT, permissive, roles: {public})
- `ekg_scores_update_policy` (UPDATE, permissive, roles: {public})

### Reporting & Analytics

#### `data_export_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| export_type | text | NO |  |  |
| format | text | NO |  |  |
| filters | jsonb | YES |  |  |
| row_count | integer | YES |  |  |
| file_size | integer | YES |  |  |
| exported_by | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_export_history_date`: `CREATE INDEX idx_export_history_date ON public.data_export_history USING btree (created_at DESC)`
- `idx_export_history_user`: `CREATE INDEX idx_export_history_user ON public.data_export_history USING btree (exported_by)`

**RLS Policies:**
- `export_history_insert` (INSERT, permissive, roles: {public})
- `export_history_select` (SELECT, permissive, roles: {public})

#### `feedback_reports`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| report_type | text | NO | 'bug'::text |  |
| description | text | NO |  |  |
| page_url | text | YES |  |  |
| user_email | text | YES |  |  |
| user_agent | text | YES |  |  |
| status | text | YES | 'new'::text |  |
| resolution_notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| resolved_at | timestamptz | YES |  |  |
| resolved_by | text | YES |  |  |
| priority | text | YES | 'medium'::text |  |
| read_at | timestamptz | YES |  |  |
| read_by | text | YES |  |  |
| archived_at | timestamptz | YES |  |  |
| updated_at | timestamptz | YES | now() |  |
| screenshot_url | text | YES |  |  |

**Check Constraints:**
- `feedback_reports_status_check`: `(status = ANY (ARRAY['new'::text, 'read'::text, 'in_progress'::text, 'needs_investigation'::text, 'resolved'::text, 'archived'::text]))`

**Indexes:**
- `idx_feedback_reports_created`: `CREATE INDEX idx_feedback_reports_created ON public.feedback_reports USING btree (created_at DESC)`
- `idx_feedback_reports_status`: `CREATE INDEX idx_feedback_reports_status ON public.feedback_reports USING btree (status)`
- `idx_feedback_reports_type`: `CREATE INDEX idx_feedback_reports_type ON public.feedback_reports USING btree (report_type)`
- `idx_feedback_reports_updated_at`: `CREATE INDEX idx_feedback_reports_updated_at ON public.feedback_reports USING btree (updated_at)`
- `idx_feedback_reports_user`: `CREATE INDEX idx_feedback_reports_user ON public.feedback_reports USING btree (user_email)`

**RLS Policies:**
- `Anyone can create feedback` (INSERT, permissive, roles: {anon,authenticated})
- `Users can update feedback` (UPDATE, permissive, roles: {authenticated})
- `Users can view feedback` (SELECT, permissive, roles: {authenticated})

#### `report_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| data_source | text | NO |  |  |
| columns | text[] | NO |  |  |
| filters | jsonb | YES | '[]'::jsonb |  |
| sort_by | text | YES |  |  |
| sort_order | text | YES | 'asc'::text |  |
| group_by | text | YES |  |  |
| is_scheduled | boolean | YES | false |  |
| schedule_frequency | text | YES |  |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| is_shared | boolean | YES | false |  |

**Indexes:**
- `idx_report_templates_creator`: `CREATE INDEX idx_report_templates_creator ON public.report_templates USING btree (created_by)`
- `idx_report_templates_shared`: `CREATE INDEX idx_report_templates_shared ON public.report_templates USING btree (is_shared)`
- `idx_report_templates_user`: `CREATE INDEX idx_report_templates_user ON public.report_templates USING btree (created_by)`

#### `incidents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| incident_date | date | NO |  |  |
| incident_time | time without time zone | YES |  |  |
| location | text | YES |  |  |
| severity | text | YES |  |  |
| description | text | NO |  |  |
| people_involved | text[] | YES |  |  |
| witnesses | text[] | YES |  |  |
| actions_taken | text | YES |  |  |
| follow_up_required | boolean | YES | false |  |
| follow_up_notes | text | YES |  |  |
| status | text | YES | 'open'::text |  |
| resolved_by | text | YES |  |  |
| resolved_at | timestamptz | YES |  |  |
| osha_reportable | boolean | YES | false |  |
| reported_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `incidents_status_check`: `(status = ANY (ARRAY['open'::text, 'investigating'::text, 'resolved'::text, 'closed'::text]))`
- `incidents_severity_check`: `(severity = ANY (ARRAY['minor'::text, 'moderate'::text, 'severe'::text, 'critical'::text]))`

**Indexes:**
- `idx_incidents_date`: `CREATE INDEX idx_incidents_date ON public.incidents USING btree (incident_date DESC)`
- `idx_incidents_severity`: `CREATE INDEX idx_incidents_severity ON public.incidents USING btree (severity)`
- `idx_incidents_status`: `CREATE INDEX idx_incidents_status ON public.incidents USING btree (status)`

**RLS Policies:**
- `Service role full access to incidents` (ALL, permissive, roles: {public})

#### `teaching_log`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| instructor_id | uuid | NO |  |  |
| certification_id | uuid | YES |  |  |
| course_name | text | NO |  |  |
| course_type | text | YES |  |  |
| date_taught | date | NO |  |  |
| hours | numeric | NO |  |  |
| location | text | YES |  |  |
| student_count | integer | YES |  |  |
| cohort_id | uuid | YES |  |  |
| lab_day_id | uuid | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`teaching_log_cohort_id_fkey`)
- `certification_id` -> `instructor_certifications.id` (`teaching_log_certification_id_fkey`)
- `lab_day_id` -> `lab_days.id` (`teaching_log_lab_day_id_fkey`)
- `instructor_id` -> `lab_users.id` (`teaching_log_instructor_id_fkey`)

**Indexes:**
- `idx_teaching_log_cohort`: `CREATE INDEX idx_teaching_log_cohort ON public.teaching_log USING btree (cohort_id)`
- `idx_teaching_log_date`: `CREATE INDEX idx_teaching_log_date ON public.teaching_log USING btree (date_taught)`
- `idx_teaching_log_instructor`: `CREATE INDEX idx_teaching_log_instructor ON public.teaching_log USING btree (instructor_id)`

**RLS Policies:**
- `Allow all for teaching_log` (ALL, permissive, roles: {public})

#### `mentorship_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| pair_id | uuid | NO |  |  |
| meeting_date | date | NO |  |  |
| duration_minutes | integer | YES |  |  |
| topics | text | YES |  |  |
| notes | text | YES |  |  |
| logged_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `pair_id` -> `mentorship_pairs.id` (`mentorship_logs_pair_id_fkey`)

**Indexes:**
- `idx_mentorship_logs_pair`: `CREATE INDEX idx_mentorship_logs_pair ON public.mentorship_logs USING btree (pair_id)`

#### `mentorship_pairs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| mentor_id | uuid | NO |  |  |
| mentee_id | uuid | NO |  |  |
| goals | text | YES |  |  |
| start_date | date | YES | CURRENT_DATE |  |
| end_date | date | YES |  |  |
| status | text | YES | 'active'::text |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `mentee_id` -> `students.id` (`mentorship_pairs_mentee_id_fkey`)
- `mentor_id` -> `students.id` (`mentorship_pairs_mentor_id_fkey`)

**Check Constraints:**
- `mentorship_pairs_status_check`: `(status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text]))`

**Indexes:**
- `idx_mentorship_pairs_mentee`: `CREATE INDEX idx_mentorship_pairs_mentee ON public.mentorship_pairs USING btree (mentee_id)`
- `idx_mentorship_pairs_mentor`: `CREATE INDEX idx_mentorship_pairs_mentor ON public.mentorship_pairs USING btree (mentor_id)`

### System & Audit

#### `audit_log`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES |  |  |
| user_email | text | YES |  |  |
| user_role | text | YES |  |  |
| action | text | NO |  |  |
| resource_type | text | NO |  |  |
| resource_id | uuid | YES |  |  |
| resource_description | text | YES |  |  |
| ip_address | text | YES |  |  |
| user_agent | text | YES |  |  |
| metadata | jsonb | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `user_id` -> `lab_users.id` (`audit_log_user_id_fkey`)

**Indexes:**
- `idx_audit_log_action`: `CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action)`
- `idx_audit_log_created`: `CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at DESC)`
- `idx_audit_log_created_user`: `CREATE INDEX idx_audit_log_created_user ON public.audit_log USING btree (created_at DESC, user_email)`
- `idx_audit_log_resource`: `CREATE INDEX idx_audit_log_resource ON public.audit_log USING btree (resource_type, resource_id)`
- `idx_audit_log_user`: `CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_email)`
- `idx_audit_log_user_email`: `CREATE INDEX idx_audit_log_user_email ON public.audit_log USING btree (user_email)`
- `idx_audit_log_user_id`: `CREATE INDEX idx_audit_log_user_id ON public.audit_log USING btree (user_id)`

**RLS Policies:**
- `Allow insert audit logs` (INSERT, permissive, roles: {public})
- `Superadmins can view audit logs` (SELECT, permissive, roles: {public})

#### `error_logs`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | text | YES |  |  |
| user_email | text | YES |  |  |
| error_message | text | NO |  |  |
| error_stack | text | YES |  |  |
| page_url | text | YES |  |  |
| component_name | text | YES |  |  |
| metadata | jsonb | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_error_logs_created`: `CREATE INDEX idx_error_logs_created ON public.error_logs USING btree (created_at DESC)`
- `idx_error_logs_user`: `CREATE INDEX idx_error_logs_user ON public.error_logs USING btree (user_id)`

#### `bulk_operations_history`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| operation_type | text | NO |  |  |
| target_table | text | NO |  |  |
| affected_count | integer | YES | 0 |  |
| filters | jsonb | YES |  |  |
| changes | jsonb | YES |  |  |
| rollback_data | jsonb | YES |  |  |
| is_dry_run | boolean | YES | false |  |
| executed_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_bulk_operations_date`: `CREATE INDEX idx_bulk_operations_date ON public.bulk_operations_history USING btree (created_at DESC)`

#### `deletion_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| item_type | text | NO |  |  |
| item_id | text | NO |  |  |
| item_name | text | YES |  |  |
| reason | text | YES |  |  |
| requested_by | uuid | YES |  |  |
| requested_at | timestamptz | YES | now() |  |
| status | text | YES | 'pending'::text |  |
| reviewed_by | uuid | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `reviewed_by` -> `lab_users.id` (`deletion_requests_reviewed_by_fkey`)
- `requested_by` -> `lab_users.id` (`deletion_requests_requested_by_fkey`)

**RLS Policies:**
- `Allow all for deletion_requests` (ALL, permissive, roles: {public})

#### `document_requests`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| document_type | text | NO |  |  |
| requested_by | text | YES |  |  |
| due_date | date | YES |  |  |
| status | text | YES | 'pending'::text |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`document_requests_student_id_fkey`)

**Check Constraints:**
- `document_requests_status_check`: `(status = ANY (ARRAY['pending'::text, 'submitted'::text, 'overdue'::text]))`

**Indexes:**
- `idx_document_requests_student`: `CREATE INDEX idx_document_requests_student ON public.document_requests USING btree (student_id)`

**RLS Policies:**
- `document_requests_service_role` (ALL, permissive, roles: {public})

#### `app_deep_links`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| route_pattern | text | NO |  |  |
| app_scheme | text | YES | 'pmi'::text |  |
| description | text | YES |  |  |
| is_active | boolean | YES | true |  |
| created_at | timestamptz | YES | now() |  |

#### `ai_prompt_templates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO |  |  |
| prompt_text | text | NO |  |  |
| version | integer | YES | 1 |  |
| is_active | boolean | YES | true |  |
| created_by | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Indexes:**
- `idx_ai_prompt_templates_active`: `CREATE INDEX idx_ai_prompt_templates_active ON public.ai_prompt_templates USING btree (is_active) WHERE (is_active = true)`
- `idx_ai_prompt_templates_name_version`: `CREATE UNIQUE INDEX idx_ai_prompt_templates_name_version ON public.ai_prompt_templates USING btree (name, version)`

**RLS Policies:**
- `ai_prompt_templates_service_role` (ALL, permissive, roles: {service_role})

#### `dashboard_layouts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_email | text | NO |  |  |
| layout | jsonb | NO | '[]'::jsonb |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `dashboard_layouts_user_email_key`: (user_email)

**Indexes:**
- `dashboard_layouts_user_email_key`: `CREATE UNIQUE INDEX dashboard_layouts_user_email_key ON public.dashboard_layouts USING btree (user_email)`

#### `dashboard_layout_defaults`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| role | text | NO |  |  |
| layout | jsonb | NO | '[]'::jsonb |  |
| updated_by | text | YES |  |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `dashboard_layout_defaults_role_key`: (role)

**Indexes:**
- `dashboard_layout_defaults_role_key`: `CREATE UNIQUE INDEX dashboard_layout_defaults_role_key ON public.dashboard_layout_defaults USING btree (role)`

#### `employment_verifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| internship_id | uuid | YES |  |  |
| student_name | text | YES |  |  |
| ssn_last4 | text | YES |  |  |
| program | text | YES |  |  |
| phone | text | YES |  |  |
| email | text | YES |  |  |
| address | text | YES |  |  |
| company_name | text | YES |  |  |
| job_title | text | YES |  |  |
| company_address | text | YES |  |  |
| company_email | text | YES |  |  |
| company_phone | text | YES |  |  |
| company_fax | text | YES |  |  |
| start_date | date | YES |  |  |
| salary | text | YES |  |  |
| employment_status | text | YES |  |  |
| verifying_staff | text | YES |  |  |
| is_draft | boolean | YES | true |  |
| submitted_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `internship_id` -> `student_internships.id` (`employment_verifications_internship_id_fkey`)

**Check Constraints:**
- `employment_verifications_employment_status_check`: `(employment_status = ANY (ARRAY['pt'::text, 'ft'::text]))`

**Indexes:**
- `idx_employment_verifications_internship`: `CREATE INDEX idx_employment_verifications_internship ON public.employment_verifications USING btree (internship_id)`

**RLS Policies:**
- `ev_delete` (DELETE, permissive, roles: {public})
- `ev_insert` (INSERT, permissive, roles: {public})
- `ev_select` (SELECT, permissive, roles: {public})
- `ev_update` (UPDATE, permissive, roles: {public})

#### `closeout_documents`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| internship_id | uuid | NO |  |  |
| doc_type | text | NO |  |  |
| file_url | text | YES |  |  |
| uploaded_by | text | YES |  |  |
| uploaded_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `internship_id` -> `student_internships.id` (`closeout_documents_internship_id_fkey`)

**Indexes:**
- `idx_closeout_documents_internship`: `CREATE INDEX idx_closeout_documents_internship ON public.closeout_documents USING btree (internship_id)`

**RLS Policies:**
- `closeout_docs_delete` (DELETE, permissive, roles: {public})
- `closeout_docs_insert` (INSERT, permissive, roles: {public})
- `closeout_docs_select` (SELECT, permissive, roles: {public})

#### `closeout_surveys`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| internship_id | uuid | YES |  |  |
| survey_type | text | NO |  |  |
| preceptor_name | text | YES |  |  |
| agency_name | text | YES |  |  |
| responses | jsonb | NO |  |  |
| submitted_by | text | YES |  |  |
| submitted_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `internship_id` -> `student_internships.id` (`closeout_surveys_internship_id_fkey`)

**Check Constraints:**
- `closeout_surveys_survey_type_check`: `(survey_type = ANY (ARRAY['hospital_preceptor'::text, 'field_preceptor'::text]))`

**Indexes:**
- `idx_closeout_surveys_internship`: `CREATE INDEX idx_closeout_surveys_internship ON public.closeout_surveys USING btree (internship_id)`
- `idx_closeout_surveys_submitted_at`: `CREATE INDEX idx_closeout_surveys_submitted_at ON public.closeout_surveys USING btree (submitted_at DESC)`
- `idx_closeout_surveys_type`: `CREATE INDEX idx_closeout_surveys_type ON public.closeout_surveys USING btree (survey_type)`

**RLS Policies:**
- `surveys_delete` (DELETE, permissive, roles: {public})
- `surveys_insert` (INSERT, permissive, roles: {public})
- `surveys_select` (SELECT, permissive, roles: {public})
- `surveys_update` (UPDATE, permissive, roles: {public})

#### `system_alerts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| alert_type | text | NO |  |  |
| severity | text | NO |  |  |
| title | text | NO |  |  |
| message | text | YES |  |  |
| metadata | jsonb | YES |  |  |
| is_resolved | boolean | YES | false |  |
| resolved_by | text | YES |  |  |
| resolved_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Check Constraints:**
- `system_alerts_severity_check`: `(severity = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text]))`

**Indexes:**
- `idx_system_alerts_date`: `CREATE INDEX idx_system_alerts_date ON public.system_alerts USING btree (created_at DESC)`
- `idx_system_alerts_unresolved`: `CREATE INDEX idx_system_alerts_unresolved ON public.system_alerts USING btree (is_resolved, severity) WHERE (is_resolved = false)`

**RLS Policies:**
- `alerts_insert` (INSERT, permissive, roles: {public})
- `alerts_select` (SELECT, permissive, roles: {public})
- `alerts_update` (UPDATE, permissive, roles: {public})

#### `system_config`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| key | text | NO |  |  |
| value | jsonb | NO |  |  |
| category | text | YES |  |  |
| description | text | YES |  |  |
| updated_by | text | YES |  |  |
| updated_at | timestamptz | YES | now() |  |

**Unique Constraints:**
- `system_config_key_key`: (key)

**Indexes:**
- `idx_system_config_category`: `CREATE INDEX idx_system_config_category ON public.system_config USING btree (category)`
- `idx_system_config_key`: `CREATE INDEX idx_system_config_key ON public.system_config USING btree (key)`
- `system_config_key_key`: `CREATE UNIQUE INDEX system_config_key_key ON public.system_config USING btree (key)`

**RLS Policies:**
- `Service role full access` (ALL, permissive, roles: {public})

#### `system_settings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| key | text | NO |  | PK |
| value | text | YES |  |  |
| updated_at | timestamptz | YES | now() |  |

**RLS Policies:**
- `Allow all for system_settings` (ALL, permissive, roles: {public})

#### `attendance_appeals`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| student_id | uuid | NO |  |  |
| absence_date | date | NO |  |  |
| reason | text | NO |  |  |
| documentation_url | text | YES |  |  |
| status | text | YES | 'pending'::text |  |
| reviewed_by | text | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |
| review_notes | text | YES |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `student_id` -> `students.id` (`attendance_appeals_student_id_fkey`)

**Check Constraints:**
- `attendance_appeals_status_check`: `(status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text]))`

**Indexes:**
- `idx_attendance_appeals_status`: `CREATE INDEX idx_attendance_appeals_status ON public.attendance_appeals USING btree (status)`
- `idx_attendance_appeals_student`: `CREATE INDEX idx_attendance_appeals_student ON public.attendance_appeals USING btree (student_id)`

#### `template_review_comments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| review_item_id | uuid | NO |  |  |
| author_email | text | NO |  |  |
| comment | text | NO |  |  |
| created_at | timestamptz | YES | now() |  |

**Foreign Keys:**
- `review_item_id` -> `template_review_items.id` (`template_review_comments_review_item_id_fkey`)

**Indexes:**
- `idx_template_review_comments_review_item_id`: `CREATE INDEX idx_template_review_comments_review_item_id ON public.template_review_comments USING btree (review_item_id)`

**RLS Policies:**
- `template_review_comments_delete` (DELETE, permissive, roles: {public})
- `template_review_comments_insert` (INSERT, permissive, roles: {public})
- `template_review_comments_select` (SELECT, permissive, roles: {public})
- `template_review_comments_update` (UPDATE, permissive, roles: {public})

#### `template_review_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| review_id | uuid | NO |  |  |
| lab_day_id | uuid | NO |  |  |
| template_id | uuid | YES |  |  |
| disposition | text | NO | 'pending'::text |  |
| revised_data | jsonb | YES |  |  |
| reviewer_notes | text | YES |  |  |
| reviewed_by | text | YES |  |  |
| reviewed_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `lab_day_id` -> `lab_days.id` (`template_review_items_lab_day_id_fkey`)
- `review_id` -> `template_reviews.id` (`template_review_items_review_id_fkey`)

**Check Constraints:**
- `template_review_items_disposition_check`: `(disposition = ANY (ARRAY['pending'::text, 'accept_changes'::text, 'keep_original'::text, 'revised'::text]))`

**Indexes:**
- `idx_template_review_items_disposition`: `CREATE INDEX idx_template_review_items_disposition ON public.template_review_items USING btree (disposition)`
- `idx_template_review_items_lab_day_id`: `CREATE INDEX idx_template_review_items_lab_day_id ON public.template_review_items USING btree (lab_day_id)`
- `idx_template_review_items_review_id`: `CREATE INDEX idx_template_review_items_review_id ON public.template_review_items USING btree (review_id)`

**RLS Policies:**
- `template_review_items_delete` (DELETE, permissive, roles: {public})
- `template_review_items_insert` (INSERT, permissive, roles: {public})
- `template_review_items_select` (SELECT, permissive, roles: {public})
- `template_review_items_update` (UPDATE, permissive, roles: {public})

#### `template_reviews`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| cohort_id | uuid | NO |  |  |
| semester | text | NO |  |  |
| title | text | NO |  |  |
| status | text | NO | 'draft'::text |  |
| created_by | text | NO |  |  |
| reviewers | text[] | YES | '{}'::text[] |  |
| created_at | timestamptz | YES | now() |  |
| updated_at | timestamptz | YES | now() |  |
| completed_at | timestamptz | YES |  |  |

**Foreign Keys:**
- `cohort_id` -> `cohorts.id` (`template_reviews_cohort_id_fkey`)

**Check Constraints:**
- `template_reviews_status_check`: `(status = ANY (ARRAY['draft'::text, 'in_review'::text, 'completed'::text, 'archived'::text]))`

**Indexes:**
- `idx_template_reviews_cohort_id`: `CREATE INDEX idx_template_reviews_cohort_id ON public.template_reviews USING btree (cohort_id)`
- `idx_template_reviews_created_by`: `CREATE INDEX idx_template_reviews_created_by ON public.template_reviews USING btree (created_by)`
- `idx_template_reviews_status`: `CREATE INDEX idx_template_reviews_status ON public.template_reviews USING btree (status)`

**RLS Policies:**
- `template_reviews_delete` (DELETE, permissive, roles: {public})
- `template_reviews_insert` (INSERT, permissive, roles: {public})
- `template_reviews_select` (SELECT, permissive, roles: {public})
- `template_reviews_update` (UPDATE, permissive, roles: {public})

### Database Views

#### `v_access_dashboard`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| door_id | uuid | YES |  |  |
| door_name | text | YES |  |  |
| location | text | YES |  |  |
| door_status | text | YES |  |  |
| unlock_duration_seconds | integer | YES |  |  |
| device_id | uuid | YES |  |  |
| device_name | text | YES |  |  |
| is_online | boolean | YES |  |  |
| last_heartbeat_at | timestamptz | YES |  |  |
| last_sync_at | timestamptz | YES |  |  |
| device_ip | text | YES |  |  |
| firmware_version | text | YES |  |  |
| entries_today | bigint | YES |  |  |
| denials_today | bigint | YES |  |  |
| rex_today | bigint | YES |  |  |

#### `v_access_log_details`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| event_at | timestamptz | YES |  |  |
| result | text | YES |  |  |
| card_uid | text | YES |  |  |
| leaf | integer | YES |  |  |
| pi_event_id | text | YES |  |  |
| synced_at | timestamptz | YES |  |  |
| door_name | text | YES |  |  |
| door_location | text | YES |  |  |
| card_label | text | YES |  |  |
| card_type | text | YES |  |  |
| person_name | text | YES |  |  |
| person_type | text | YES |  |  |

#### `v_active_library_checkouts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| library_copy_id | uuid | YES |  |  |
| copy_barcode | text | YES |  |  |
| library_item_id | uuid | YES |  |  |
| title | text | YES |  |  |
| author | text | YES |  |  |
| isbn | text | YES |  |  |
| student_id | uuid | YES |  |  |
| student_name | text | YES |  |  |
| student_number | text | YES |  |  |
| checked_out_at | timestamptz | YES |  |  |
| due_date | date | YES |  |  |
| is_overdue | boolean | YES |  |  |
| days_overdue | integer | YES |  |  |

#### `v_bins_with_details`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| name | text | YES |  |  |
| barcode | text | YES |  |  |
| bin_type | text | YES |  |  |
| color | text | YES |  |  |
| notes | text | YES |  |  |
| is_active | boolean | YES |  |  |
| created_at | timestamptz | YES |  |  |
| location_id | uuid | YES |  |  |
| location_name | text | YES |  |  |
| location_path | text | YES |  |  |
| location_qr_code | text | YES |  |  |
| inventory_item_id | uuid | YES |  |  |
| item_name | text | YES |  |  |
| item_sku | text | YES |  |  |
| item_quantity | integer | YES |  |  |
| item_type | text | YES |  |  |
| content_count | bigint | YES |  |  |
| total_quantity | bigint | YES |  |  |

#### `v_equipment_summary`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| name | text | YES |  |  |
| asset_tag | text | YES |  |  |
| serial_number | text | YES |  |  |
| status | text | YES |  |  |
| condition | text | YES |  |  |
| category_name | text | YES |  |  |
| location_name | text | YES |  |  |
| location_path | text | YES |  |  |
| assigned_to | text | YES |  |  |
| assigned_at | timestamptz | YES |  |  |
| last_maintenance_date | date | YES |  |  |
| next_maintenance_due | date | YES |  |  |
| maintenance_overdue | boolean | YES |  |  |

#### `v_locations_with_counts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| parent_id | uuid | YES |  |  |
| name | text | YES |  |  |
| qr_code | text | YES |  |  |
| full_path | text | YES |  |  |
| location_type | text | YES |  |  |
| description | text | YES |  |  |
| sort_order | integer | YES |  |  |
| is_active | boolean | YES |  |  |
| created_at | timestamptz | YES |  |  |
| updated_at | timestamptz | YES |  |  |
| created_by | uuid | YES |  |  |
| bin_count | bigint | YES |  |  |
| child_count | bigint | YES |  |  |

#### `v_supply_alerts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| name | text | YES |  |  |
| sku | text | YES |  |  |
| quantity | integer | YES |  |  |
| reorder_level | integer | YES |  |  |
| item_type | text | YES |  |  |
| category_name | text | YES |  |  |
| expiration_date | date | YES |  |  |
| lot_number | text | YES |  |  |
| expiration_status | text | YES |  |  |
| is_low_stock | boolean | YES |  |  |

### Backup Tables

#### `_backup_checkouts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| student_id | uuid | YES |  |  |
| library_item_id | uuid | YES |  |  |
| checked_out_at | timestamptz | YES |  |  |
| due_date | date | YES |  |  |
| checked_in_at | timestamptz | YES |  |  |
| checked_out_by | uuid | YES |  |  |
| checked_in_by | uuid | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES |  |  |

#### `_backup_inventory_adjustments`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| item_id | uuid | YES |  |  |
| adjusted_by | uuid | YES |  |  |
| old_quantity | integer | YES |  |  |
| new_quantity | integer | YES |  |  |
| reason | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES |  |  |

#### `_backup_inventory_barcodes`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| item_id | uuid | YES |  |  |
| barcode | text | YES |  |  |
| barcode_type | text | YES |  |  |
| created_at | timestamptz | YES |  |  |

#### `_backup_inventory_categories`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| name | text | YES |  |  |
| parent_category_id | uuid | YES |  |  |
| description | text | YES |  |  |
| created_at | timestamptz | YES |  |  |
| updated_at | timestamptz | YES |  |  |
| item_type | text | YES |  |  |
| sort_order | integer | YES |  |  |

#### `_backup_inventory_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| name | text | YES |  |  |
| sku | text | YES |  |  |
| category_id | uuid | YES |  |  |
| description | text | YES |  |  |
| manufacturer | text | YES |  |  |
| model_number | text | YES |  |  |
| total_quantity | integer | YES |  |  |
| available_quantity | integer | YES |  |  |
| reorder_point | integer | YES |  |  |
| reorder_quantity | integer | YES |  |  |
| unit_of_measure | text | YES |  |  |
| unit_cost | numeric | YES |  |  |
| tracks_expiration | boolean | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES |  |  |
| updated_at | timestamptz | YES |  |  |
| isbn | text | YES |  |  |
| author | text | YES |  |  |
| publisher | text | YES |  |  |
| publication_year | integer | YES |  |  |
| edition | text | YES |  |  |
| page_count | integer | YES |  |  |
| cover_image_url | text | YES |  |  |
| is_library_item | boolean | YES |  |  |
| item_type | text | YES |  |  |
| is_active | boolean | YES |  |  |
| created_by | uuid | YES |  |  |
| updated_by | uuid | YES |  |  |

#### `_backup_inventory_notifications`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| item_id | uuid | YES |  |  |
| notification_type | text | YES |  |  |
| message | text | YES |  |  |
| read_at | timestamptz | YES |  |  |
| created_at | timestamptz | YES |  |  |

#### `_backup_library_items`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | YES |  |  |
| isbn | text | YES |  |  |
| title | text | YES |  |  |
| author | text | YES |  |  |
| publisher | text | YES |  |  |
| edition | text | YES |  |  |
| publication_year | integer | YES |  |  |
| total_copies | integer | YES |  |  |
| available_copies | integer | YES |  |  |
| category | text | YES |  |  |
| subject | text | YES |  |  |
| cover_image_url | text | YES |  |  |
| description | text | YES |  |  |
| notes | text | YES |  |  |
| created_at | timestamptz | YES |  |  |
| updated_at | timestamptz | YES |  |  |
| barcode | text | YES |  |  |
| item_number | integer | YES |  |  |
| status | text | YES |  |  |
| condition | text | YES |  |  |
| location | text | YES |  |  |
| needs_label | boolean | YES |  |  |
| label_printed_at | timestamptz | YES |  |  |
| label_printed_by | uuid | YES |  |  |
| inventory_item_id | uuid | YES |  |  |

---

## Entity Relationship Summary

Key foreign key relationships across the schema:

| Source Table | Target Table | Column Mapping | Constraint |
|-------------|-------------|----------------|------------|
| access_cards | students | student_id -> id | access_cards_student_id_fkey |
| access_cards | lab_users | lab_user_id -> id | access_cards_lab_user_id_fkey |
| access_device_heartbeats | access_devices | access_device_id -> id | access_device_heartbeats_access_device_id_fkey |
| access_devices | access_doors | door_id -> id | access_devices_door_id_fkey |
| access_doors | locations | location_id -> id | access_doors_location_id_fkey |
| access_logs | access_doors | access_door_id -> id | access_logs_access_door_id_fkey |
| access_logs | access_cards | access_card_id -> id | access_logs_access_card_id_fkey |
| access_logs | access_devices | access_device_id -> id | access_logs_access_device_id_fkey |
| access_rules | access_doors | access_door_id -> id | access_rules_access_door_id_fkey |
| access_rules | access_schedules | access_schedule_id -> id | access_rules_access_schedule_id_fkey |
| access_rules | access_cards | access_card_id -> id | access_rules_access_card_id_fkey |
| aemt_student_tracking | students | student_id -> id | aemt_student_tracking_student_id_fkey |
| aemt_student_tracking | cohorts | cohort_id -> id | aemt_student_tracking_cohort_id_fkey |
| affiliation_notifications_log | clinical_affiliations | affiliation_id -> id | affiliation_notifications_log_affiliation_id_fkey |
| agency_contacts | agencies | agency_id -> id | agency_contacts_agency_id_fkey |
| alumni | students | student_id -> id | alumni_student_id_fkey |
| alumni | cohorts | cohort_id -> id | alumni_cohort_id_fkey |
| announcement_reads | announcements | announcement_id -> id | announcement_reads_announcement_id_fkey |
| attendance_appeals | students | student_id -> id | attendance_appeals_student_id_fkey |
| audit_log | lab_users | user_id -> id | audit_log_user_id_fkey |
| bin_contents | inventory_bins | bin_id -> id | bin_contents_bin_id_fkey |
| case_analytics | case_studies | case_id -> id | case_analytics_case_id_fkey |
| case_assignments | cohorts | cohort_id -> id | case_assignments_cohort_id_fkey |
| case_assignments | lab_users | assigned_by -> id | case_assignments_assigned_by_fkey |
| case_assignments | case_studies | case_id -> id | case_assignments_case_id_fkey |
| case_briefs | case_studies | generated_case_id -> id | case_briefs_generated_case_id_fkey |
| case_flags | lab_users | flagged_by -> id | case_flags_flagged_by_fkey |
| case_flags | lab_users | reviewed_by -> id | case_flags_reviewed_by_fkey |
| case_flags | case_studies | case_id -> id | case_flags_case_id_fkey |
| case_practice_progress | case_studies | case_id -> id | case_practice_progress_case_id_fkey |
| case_practice_progress | students | student_id -> id | case_practice_progress_student_id_fkey |
| case_responses | case_sessions | session_id -> id | case_responses_session_id_fkey |
| case_responses | students | student_id -> id | case_responses_student_id_fkey |
| case_responses | case_studies | case_id -> id | case_responses_case_id_fkey |
| case_reviews | lab_users | reviewed_by -> id | case_reviews_reviewed_by_fkey |
| case_reviews | case_studies | case_id -> id | case_reviews_case_id_fkey |
| case_sessions | cohorts | cohort_id -> id | case_sessions_cohort_id_fkey |
| case_sessions | case_studies | case_id -> id | case_sessions_case_id_fkey |
| case_studies | lab_users | created_by -> id | case_studies_created_by_fkey |
| case_studies | case_briefs | generation_brief_id -> id | case_studies_generation_brief_id_fkey |
| ce_records | lab_users | instructor_id -> id | ce_records_instructor_id_fkey |
| ce_records | instructor_certifications | certification_id -> id | ce_records_certification_id_fkey |
| cert_notifications | lab_users | instructor_id -> id | cert_notifications_instructor_id_fkey |
| cert_notifications | instructor_certifications | certification_id -> id | cert_notifications_certification_id_fkey |
| clinical_rotations | students | student_id -> id | clinical_rotations_student_id_fkey |
| clinical_rotations | clinical_sites | site_id -> id | clinical_rotations_site_id_fkey |
| clinical_site_departments | clinical_sites | site_id -> id | clinical_site_departments_site_id_fkey |
| clinical_site_schedules | clinical_sites | clinical_site_id -> id | clinical_site_schedules_clinical_site_id_fkey |
| clinical_site_visits | agencies | agency_id -> id | clinical_site_visits_agency_id_fkey |
| clinical_site_visits | clinical_sites | site_id -> id | clinical_site_visits_site_id_fkey |
| clinical_site_visits | lab_users | visitor_id -> id | clinical_site_visits_visitor_id_fkey |
| clinical_site_visits | cohorts | cohort_id -> id | clinical_site_visits_cohort_id_fkey |
| clinical_task_definitions | clinical_task_templates | template_id -> id | clinical_task_definitions_template_id_fkey |
| clinical_task_templates | lab_users | created_by -> id | clinical_task_templates_created_by_fkey |
| clinical_visit_students | clinical_site_visits | visit_id -> id | clinical_visit_students_visit_id_fkey |
| clinical_visit_students | students | student_id -> id | clinical_visit_students_student_id_fkey |
| closeout_documents | student_internships | internship_id -> id | closeout_documents_internship_id_fkey |
| closeout_surveys | student_internships | internship_id -> id | closeout_surveys_internship_id_fkey |
| cohort_key_dates | cohorts | cohort_id -> id | cohort_key_dates_cohort_id_fkey |
| cohort_milestones | cohorts | cohort_id -> id | cohort_milestones_cohort_id_fkey |
| cohort_scenario_completions | lab_stations | station_id -> id | cohort_scenario_completions_station_id_fkey |
| cohort_scenario_completions | cohorts | cohort_id -> id | cohort_scenario_completions_cohort_id_fkey |
| cohort_scenario_completions | lab_days | lab_day_id -> id | cohort_scenario_completions_lab_day_id_fkey |
| cohort_scenario_completions | scenarios | scenario_id -> id | cohort_scenario_completions_scenario_id_fkey |
| cohort_skill_completions | cohorts | cohort_id -> id | cohort_skill_completions_cohort_id_fkey |
| cohort_skill_completions | lab_stations | station_id -> id | cohort_skill_completions_station_id_fkey |
| cohort_skill_completions | skills | skill_id -> id | cohort_skill_completions_skill_id_fkey |
| cohort_skill_completions | lab_days | lab_day_id -> id | cohort_skill_completions_lab_day_id_fkey |
| cohort_tasks | clinical_task_definitions | task_definition_id -> id | cohort_tasks_task_definition_id_fkey |
| cohort_tasks | cohorts | cohort_id -> id | cohort_tasks_cohort_id_fkey |
| cohort_tasks | clinical_task_templates | template_id -> id | cohort_tasks_template_id_fkey |
| cohorts | programs | program_id -> id | cohorts_program_id_fkey |
| custody_checkout_items | custody_checkouts | custody_checkout_id -> id | custody_checkout_items_custody_checkout_id_fkey |
| custody_checkouts | students | student_id -> id | custody_checkouts_student_id_fkey |
| custom_skills | lab_stations | station_id -> id | custom_skills_station_id_fkey |
| deletion_requests | lab_users | reviewed_by -> id | deletion_requests_reviewed_by_fkey |
| deletion_requests | lab_users | requested_by -> id | deletion_requests_requested_by_fkey |
| document_requests | students | student_id -> id | document_requests_student_id_fkey |
| ekg_warmup_scores | lab_users | logged_by -> id | ekg_warmup_scores_logged_by_fkey |
| ekg_warmup_scores | students | student_id -> id | ekg_warmup_scores_student_id_fkey |
| email_log | lab_users | user_id -> id | email_log_user_id_fkey |
| email_queue | lab_users | user_id -> id | email_queue_user_id_fkey |
| employment_verifications | student_internships | internship_id -> id | employment_verifications_internship_id_fkey |
| emt_student_tracking | students | student_id -> id | emt_student_tracking_student_id_fkey |
| emt_student_tracking | cohorts | cohort_id -> id | emt_student_tracking_cohort_id_fkey |
| equipment_assignments | equipment_items | equipment_item_id -> id | equipment_assignments_equipment_item_id_fkey |
| equipment_categories | equipment_categories | parent_category_id -> id | equipment_categories_parent_category_id_fkey |
| equipment_checkouts | lab_days | lab_day_id -> id | equipment_checkouts_lab_day_id_fkey |
| equipment_checkouts | equipment | equipment_id -> id | equipment_checkouts_equipment_id_fkey |
| equipment_items | locations | location_id -> id | equipment_items_location_id_fkey |
| equipment_items | equipment_categories | category_id -> id | equipment_items_category_id_fkey |
| equipment_maintenance | equipment_items | equipment_item_id -> id | equipment_maintenance_equipment_item_id_fkey |
| field_preceptors | agencies | agency_id -> id | field_preceptors_agency_id_fkey |
| field_ride_requests | lab_users | reviewed_by -> id | field_ride_requests_reviewed_by_fkey |
| field_trip_attendance | students | student_id -> id | field_trip_attendance_student_id_fkey |
| field_trip_attendance | field_trips | field_trip_id -> id | field_trip_attendance_field_trip_id_fkey |
| field_trips | cohorts | cohort_id -> id | field_trips_cohort_id_fkey |
| field_trips | lab_users | created_by -> id | field_trips_created_by_fkey |
| filament_adjustments | filament_types | filament_type_id -> id | filament_adjustments_filament_type_id_fkey |
| filament_purchases | filament_types | filament_type_id -> id | filament_purchases_filament_type_id_fkey |
| guest_access | lab_days | lab_day_id -> id | guest_access_lab_day_id_fkey |
| guest_access | lab_users | created_by -> id | guest_access_created_by_fkey |
| instructor_availability | lab_users | instructor_id -> id | instructor_availability_instructor_id_fkey |
| instructor_certifications | ce_requirements | ce_requirement_id -> id | fk_ce_requirement |
| instructor_certifications | lab_users | instructor_id -> id | instructor_certifications_instructor_id_fkey |
| instructor_daily_notes | lab_users | instructor_id -> id | instructor_daily_notes_instructor_id_fkey |
| instructor_tasks | lab_users | assigned_to -> id | instructor_tasks_assigned_to_fkey |
| instructor_tasks | lab_users | created_by -> id | instructor_tasks_created_by_fkey |
| instructor_tasks | lab_users | assigned_by -> id | instructor_tasks_assigned_by_fkey |
| instructor_time_entries | lab_days | lab_day_id -> id | instructor_time_entries_lab_day_id_fkey |
| internship_meetings | lab_users | created_by -> id | internship_meetings_created_by_fkey |
| internship_meetings | student_internships | student_internship_id -> id | internship_meetings_student_internship_id_fkey |
| internship_meetings | students | student_id -> id | internship_meetings_student_id_fkey |
| inventory_bin_contents | inventory_bins | bin_id -> id | inventory_bin_contents_bin_id_fkey |
| inventory_bin_transactions | inventory_bin_contents | bin_content_id -> id | inventory_bin_transactions_bin_content_id_fkey |
| inventory_bins | inventory_locations | location_id -> id | inventory_bins_location_id_fkey |
| inventory_containers | inventory_rooms | room_id -> id | inventory_containers_room_id_fkey |
| inventory_positions | inventory_containers | container_id -> id | inventory_positions_container_id_fkey |
| lab_day_attendance | lab_days | lab_day_id -> id | lab_day_attendance_lab_day_id_fkey |
| lab_day_attendance | students | student_id -> id | lab_day_attendance_student_id_fkey |
| lab_day_checklist_items | lab_users | completed_by -> id | lab_day_checklist_items_completed_by_fkey |
| lab_day_checklist_items | lab_days | lab_day_id -> id | lab_day_checklist_items_lab_day_id_fkey |
| lab_day_checklists | lab_days | lab_day_id -> id | lab_day_checklists_lab_day_id_fkey |
| lab_day_costs | lab_days | lab_day_id -> id | lab_day_costs_lab_day_id_fkey |
| lab_day_debriefs | lab_days | lab_day_id -> id | lab_day_debriefs_lab_day_id_fkey |
| lab_day_equipment | lab_days | lab_day_id -> id | lab_day_equipment_lab_day_id_fkey |
| lab_day_roles | lab_days | lab_day_id -> id | lab_day_roles_lab_day_id_fkey |
| lab_day_roles | lab_users | instructor_id -> id | lab_day_roles_instructor_id_fkey |
| lab_day_signups | lab_days | lab_day_id -> id | lab_day_signups_lab_day_id_fkey |
| lab_day_signups | students | student_id -> id | lab_day_signups_student_id_fkey |
| lab_days | lab_users | created_by -> id | lab_days_created_by_fkey |
| lab_days | lab_day_templates | source_template_id -> id | lab_days_source_template_id_fkey |
| lab_days | cohorts | cohort_id -> id | lab_days_cohort_id_fkey |
| lab_days | timer_display_tokens | assigned_timer_id -> id | lab_days_assigned_timer_id_fkey |
| lab_equipment_items | lab_stations | station_id -> id | lab_equipment_items_station_id_fkey |
| lab_equipment_items | lab_users | checked_out_by -> id | lab_equipment_items_checked_out_by_fkey |
| lab_equipment_items | lab_users | returned_by -> id | lab_equipment_items_returned_by_fkey |
| lab_equipment_items | lab_days | lab_day_id -> id | lab_equipment_items_lab_day_id_fkey |
| lab_equipment_tracking | lab_stations | station_id -> id | lab_equipment_tracking_station_id_fkey |
| lab_equipment_tracking | lab_days | lab_day_id -> id | lab_equipment_tracking_lab_day_id_fkey |
| lab_group_assignment_history | students | student_id -> id | lab_group_assignment_history_student_id_fkey |
| lab_group_assignment_history | lab_groups | group_id -> id | lab_group_assignment_history_group_id_fkey |
| lab_group_history | lab_groups | from_group_id -> id | lab_group_history_from_group_id_fkey |
| lab_group_history | lab_groups | to_group_id -> id | lab_group_history_to_group_id_fkey |
| lab_group_history | students | student_id -> id | lab_group_history_student_id_fkey |
| lab_group_members | students | student_id -> id | lab_group_members_student_id_fkey |
| lab_group_members | lab_groups | lab_group_id -> id | lab_group_members_lab_group_id_fkey |
| lab_groups | cohorts | cohort_id -> id | lab_groups_cohort_id_fkey |
| lab_stations | scenarios | scenario_id -> id | lab_stations_scenario_id_fkey |
| lab_stations | lab_users | instructor_id -> id | lab_stations_instructor_id_fkey |
| lab_stations | lab_users | additional_instructor_id -> id | lab_stations_additional_instructor_id_fkey |
| lab_stations | lab_days | lab_day_id -> id | lab_stations_lab_day_id_fkey |
| lab_template_stations | lab_day_templates | template_id -> id | lab_template_stations_template_id_fkey |
| lab_template_versions | lab_day_templates | template_id -> id | lab_template_versions_template_id_fkey |
| lab_template_versions | lab_days | source_lab_day_id -> id | lab_template_versions_source_lab_day_id_fkey |
| lab_timer_ready_status | lab_stations | station_id -> id | lab_timer_ready_status_station_id_fkey |
| lab_timer_ready_status | lab_days | lab_day_id -> id | lab_timer_ready_status_lab_day_id_fkey |
| lab_timer_state | lab_days | lab_day_id -> id | lab_timer_state_lab_day_id_fkey |
| lab_users | departments | department_id -> id | lab_users_department_id_fkey |
| lab_week_templates | programs | program_id -> id | lab_week_templates_program_id_fkey |
| learning_plan_notes | learning_plans | plan_id -> id | learning_plan_notes_plan_id_fkey |
| learning_plans | students | student_id -> id | learning_plans_student_id_fkey |
| library_checkouts | library_copies | library_copy_id -> id | library_checkouts_library_copy_id_fkey |
| library_checkouts | students | student_id -> id | library_checkouts_student_id_fkey |
| library_copies | library_items | library_item_id -> id | library_copies_library_item_id_fkey |
| library_scanning_sessions | students | student_id -> id | library_scanning_sessions_student_id_fkey |
| locations | locations | parent_id -> id | locations_parent_id_fkey |
| mentorship_logs | mentorship_pairs | pair_id -> id | mentorship_logs_pair_id_fkey |
| mentorship_pairs | students | mentee_id -> id | mentorship_pairs_mentee_id_fkey |
| mentorship_pairs | students | mentor_id -> id | mentorship_pairs_mentor_id_fkey |
| notifications_log | polls | poll_id -> id | notifications_log_poll_id_fkey |
| onboarding_assignments | onboarding_templates | template_id -> id | onboarding_assignments_template_id_fkey |
| onboarding_events | onboarding_assignments | assignment_id -> id | onboarding_events_assignment_id_fkey |
| onboarding_events | onboarding_tasks | task_id -> id | onboarding_events_task_id_fkey |
| onboarding_events | onboarding_phases | phase_id -> id | onboarding_events_phase_id_fkey |
| onboarding_evidence | onboarding_task_progress | task_progress_id -> id | onboarding_evidence_task_progress_id_fkey |
| onboarding_phase_progress | onboarding_assignments | assignment_id -> id | onboarding_phase_progress_assignment_id_fkey |
| onboarding_phase_progress | onboarding_phases | phase_id -> id | onboarding_phase_progress_phase_id_fkey |
| onboarding_phases | onboarding_templates | template_id -> id | onboarding_phases_template_id_fkey |
| onboarding_task_dependencies | onboarding_tasks | depends_on_task_id -> id | onboarding_task_dependencies_depends_on_task_id_fkey |
| onboarding_task_dependencies | onboarding_tasks | task_id -> id | onboarding_task_dependencies_task_id_fkey |
| onboarding_task_progress | onboarding_tasks | task_id -> id | onboarding_task_progress_task_id_fkey |
| onboarding_task_progress | onboarding_assignments | assignment_id -> id | onboarding_task_progress_assignment_id_fkey |
| onboarding_tasks | onboarding_phases | phase_id -> id | onboarding_tasks_phase_id_fkey |
| open_shifts | lab_days | lab_day_id -> id | open_shifts_lab_day_id_fkey |
| open_shifts | lab_users | created_by -> id | open_shifts_created_by_fkey |
| osce_observer_blocks | osce_observers | observer_id -> id | osce_observer_blocks_observer_id_fkey |
| osce_observer_blocks | osce_time_blocks | block_id -> id | osce_observer_blocks_block_id_fkey |
| osce_observers | osce_events | event_id -> id | osce_observers_event_id_fkey |
| osce_student_agencies | osce_events | event_id -> id | osce_student_agencies_event_id_fkey |
| osce_student_schedule | osce_events | event_id -> id | osce_student_schedule_event_id_fkey |
| osce_student_schedule | osce_time_blocks | time_block_id -> id | osce_student_schedule_time_block_id_fkey |
| osce_time_blocks | osce_events | event_id -> id | osce_time_blocks_event_id_fkey |
| peer_evaluations | lab_days | lab_day_id -> id | peer_evaluations_lab_day_id_fkey |
| peer_evaluations | students | evaluator_id -> id | peer_evaluations_evaluator_id_fkey |
| peer_evaluations | students | evaluated_id -> id | peer_evaluations_evaluated_id_fkey |
| preceptor_eval_tokens | students | student_id -> id | preceptor_eval_tokens_student_id_fkey |
| preceptor_eval_tokens | student_internships | internship_id -> id | preceptor_eval_tokens_internship_id_fkey |
| preceptor_feedback | student_internships | internship_id -> id | preceptor_feedback_internship_id_fkey |
| preceptor_feedback | students | student_id -> id | preceptor_feedback_student_id_fkey |
| print_failures | filament_types | filament_type_id -> id | print_failures_filament_type_id_fkey |
| print_failures | print_requests | request_id -> id | print_failures_request_id_fkey |
| print_failures | printers | printer_id -> id | print_failures_printer_id_fkey |
| print_notifications | print_requests | request_id -> id | print_notifications_request_id_fkey |
| print_request_history | print_requests | request_id -> id | print_request_history_request_id_fkey |
| print_request_materials | print_requests | request_id -> id | print_request_materials_request_id_fkey |
| print_request_materials | filament_types | filament_type_id -> id | print_request_materials_filament_type_id_fkey |
| print_requests | filament_types | filament_type_id -> id | print_requests_filament_type_id_fkey |
| print_requests | filament_types | material_preference_id -> id | print_requests_material_preference_id_fkey |
| print_requests | printers | printer_id -> id | print_requests_printer_id_fkey |
| print_requests | print_requests | reorder_of -> id | print_requests_reorder_of_fkey |
| printer_hour_adjustments | printers | printer_id -> id | printer_hour_adjustments_printer_id_fkey |
| printer_maintenance | printers | printer_id -> id | printer_maintenance_printer_id_fkey |
| program_outcomes | cohorts | cohort_id -> id | program_outcomes_cohort_id_fkey |
| programs | departments | department_id -> id | programs_department_id_fkey |
| protocol_completions | students | student_id -> id | protocol_completions_student_id_fkey |
| protocol_completions | lab_users | logged_by -> id | protocol_completions_logged_by_fkey |
| resource_bookings | bookable_resources | resource_id -> id | resource_bookings_resource_id_fkey |
| resource_versions | resources | resource_id -> id | resource_versions_resource_id_fkey |
| rubric_criteria | assessment_rubrics | rubric_id -> id | rubric_criteria_rubric_id_fkey |
| rubric_scenario_assignments | scenarios | scenario_id -> id | rubric_scenario_assignments_scenario_id_fkey |
| rubric_scenario_assignments | assessment_rubrics | rubric_id -> id | rubric_scenario_assignments_rubric_id_fkey |
| scenario_assessments | cohorts | cohort_id -> id | scenario_assessments_cohort_id_fkey |
| scenario_assessments | lab_groups | lab_group_id -> id | scenario_assessments_lab_group_id_fkey |
| scenario_assessments | students | team_lead_id -> id | scenario_assessments_team_lead_id_fkey |
| scenario_assessments | lab_stations | lab_station_id -> id | scenario_assessments_lab_station_id_fkey |
| scenario_assessments | lab_stations | station_id -> id | scenario_assessments_station_id_fkey |
| scenario_assessments | lab_days | lab_day_id -> id | scenario_assessments_lab_day_id_fkey |
| scenario_assessments | lab_users | graded_by -> id | scenario_assessments_graded_by_fkey |
| scenario_favorites | scenarios | scenario_id -> id | scenario_favorites_scenario_id_fkey |
| scenario_participation | lab_days | lab_day_id -> id | scenario_participation_lab_day_fkey |
| scenario_participation | lab_users | created_by_id -> id | scenario_participation_created_by_id_fkey |
| scenario_participation | lab_users | instructor_id -> id | scenario_participation_instructor_id_fkey |
| scenario_participation | students | student_id -> id | scenario_participation_student_id_fkey |
| scenario_participation | scenarios | scenario_id -> id | scenario_participation_scenario_id_fkey |
| scenario_ratings | scenarios | scenario_id -> id | scenario_ratings_scenario_id_fkey |
| scenario_tags | scenarios | scenario_id -> id | scenario_tags_scenario_id_fkey |
| scenario_versions | scenarios | scenario_id -> id | scenario_versions_scenario_id_fkey |
| scenarios | lab_users | created_by -> id | scenarios_created_by_fkey |
| seat_assignments | students | student_id -> id | seat_assignments_student_id_fkey |
| seat_assignments | seating_charts | seating_chart_id -> id | seat_assignments_seating_chart_id_fkey |
| seating_charts | cohorts | cohort_id -> id | seating_charts_cohort_id_fkey |
| seating_charts | classrooms | classroom_id -> id | seating_charts_classroom_id_fkey |
| seating_preferences | students | student_id -> id | seating_preferences_student_id_fkey |
| seating_preferences | students | other_student_id -> id | seating_preferences_other_student_id_fkey |
| shift_signups | lab_users | instructor_id -> id | shift_signups_instructor_id_fkey |
| shift_signups | lab_users | confirmed_by -> id | shift_signups_confirmed_by_fkey |
| shift_signups | open_shifts | shift_id -> id | shift_signups_shift_id_fkey |
| shift_swap_interest | shift_trade_requests | swap_request_id -> id | shift_swap_interest_swap_request_id_fkey |
| shift_trade_requests | open_shifts | requester_shift_id -> id | shift_trade_requests_requester_shift_id_fkey |
| shift_trade_requests | open_shifts | target_shift_id -> id | shift_trade_requests_target_shift_id_fkey |
| shift_trade_requests | lab_users | approved_by -> id | shift_trade_requests_approved_by_fkey |
| shift_trade_requests | lab_users | target_user_id -> id | shift_trade_requests_target_user_id_fkey |
| shift_trade_requests | lab_users | requester_id -> id | shift_trade_requests_requester_id_fkey |
| shift_trades | open_shifts | original_shift_id -> id | shift_trades_original_shift_id_fkey |
| skill_assessments | cohorts | cohort_id -> id | skill_assessments_cohort_id_fkey |
| skill_assessments | lab_stations | lab_station_id -> id | skill_assessments_lab_station_id_fkey |
| skill_assessments | lab_days | lab_day_id -> id | skill_assessments_lab_day_id_fkey |
| skill_assessments | students | student_id -> id | skill_assessments_student_id_fkey |
| skill_assessments | lab_users | graded_by -> id | skill_assessments_graded_by_fkey |
| skill_competencies | students | student_id -> id | skill_competencies_student_id_fkey |
| skill_competencies | skills | skill_id -> id | skill_competencies_skill_id_fkey |
| skill_documents | skills | skill_id -> id | skill_documents_skill_id_fkey |
| skill_documents | skill_drills | drill_id -> id | skill_documents_drill_id_fkey |
| skill_drill_cases | skill_drills | skill_drill_id -> id | skill_drill_cases_skill_drill_id_fkey |
| skill_sheet_assignments | skill_sheets | skill_sheet_id -> id | skill_sheet_assignments_skill_sheet_id_fkey |
| skill_sheet_steps | skill_sheets | skill_sheet_id -> id | skill_sheet_steps_skill_sheet_id_fkey |
| skill_sheets | canonical_skills | canonical_skill_id -> id | skill_sheets_canonical_skill_id_fkey |
| skill_signoffs | students | student_id -> id | skill_signoffs_student_id_fkey |
| skill_signoffs | lab_days | lab_day_id -> id | skill_signoffs_lab_day_id_fkey |
| skill_signoffs | skills | skill_id -> id | skill_signoffs_skill_id_fkey |
| station_completions | station_pool | station_id -> id | station_completions_station_id_fkey |
| station_completions | students | student_id -> id | station_completions_student_id_fkey |
| station_completions | lab_users | logged_by -> id | station_completions_logged_by_fkey |
| station_completions | lab_days | lab_day_id -> id | station_completions_lab_day_id_fkey |
| station_instructors | lab_users | user_id -> id | station_instructors_user_id_fkey |
| station_instructors | lab_stations | station_id -> id | station_instructors_station_id_fkey |
| station_pool | lab_users | created_by -> id | station_pool_created_by_fkey |
| station_pool | cohorts | cohort_id -> id | station_pool_cohort_id_fkey |
| station_skills | skills | skill_id -> id | station_skills_skill_id_fkey |
| station_skills | lab_stations | station_id -> id | station_skills_station_id_fkey |
| student_achievements | students | student_id -> id | student_achievements_student_id_fkey |
| student_case_stats | students | student_id -> id | student_case_stats_student_id_fkey |
| student_case_stats | cohorts | cohort_id -> id | student_case_stats_cohort_id_fkey |
| student_clinical_hours | cohorts | cohort_id -> id | student_clinical_hours_cohort_id_fkey |
| student_clinical_hours | students | student_id -> id | student_clinical_hours_student_id_fkey |
| student_communications | students | student_id -> id | student_communications_student_id_fkey |
| student_compliance_docs | cohorts | cohort_id -> id | student_compliance_docs_cohort_id_fkey |
| student_compliance_docs | students | student_id -> id | student_compliance_docs_student_id_fkey |
| student_compliance_records | students | student_id -> id | student_compliance_records_student_id_fkey |
| student_compliance_records | compliance_document_types | doc_type_id -> id | student_compliance_records_doc_type_id_fkey |
| student_documents | students | student_id -> id | student_documents_student_id_fkey |
| student_field_rides | cohorts | cohort_id -> id | student_field_rides_cohort_id_fkey |
| student_field_rides | students | student_id -> id | student_field_rides_student_id_fkey |
| student_group_assignments | students | student_id -> id | student_group_assignments_student_id_fkey |
| student_group_assignments | student_groups | group_id -> id | student_group_assignments_group_id_fkey |
| student_groups | cohorts | cohort_id -> id | student_groups_cohort_id_fkey |
| student_import_history | cohorts | cohort_id -> id | student_import_history_cohort_id_fkey |
| student_individual_tasks | students | student_id -> id | student_individual_tasks_student_id_fkey |
| student_individual_tasks | cohorts | cohort_id -> id | student_individual_tasks_cohort_id_fkey |
| student_individual_tasks | lab_users | completed_by -> id | student_individual_tasks_completed_by_fkey |
| student_individual_tasks | lab_users | assigned_by -> id | student_individual_tasks_assigned_by_fkey |
| student_internships | field_preceptors | preceptor_id -> id | student_internships_preceptor_id_fkey |
| student_internships | students | student_id -> id | student_internships_student_id_fkey |
| student_internships | agencies | agency_id -> id | student_internships_agency_id_fkey |
| student_internships | cohorts | cohort_id -> id | student_internships_cohort_id_fkey |
| student_lab_ratings | lab_days | lab_day_id -> id | student_lab_ratings_lab_day_id_fkey |
| student_lab_ratings | students | student_id -> id | student_lab_ratings_student_id_fkey |
| student_lab_signups | lab_days | lab_day_id -> id | student_lab_signups_lab_day_id_fkey |
| student_lab_signups | students | student_id -> id | student_lab_signups_student_id_fkey |
| student_learning_styles | students | student_id -> id | student_learning_styles_student_id_fkey |
| student_mce_clearance | students | student_id -> id | student_mce_clearance_student_id_fkey |
| student_mce_modules | students | student_id -> id | student_mce_modules_student_id_fkey |
| student_mce_modules | cohorts | cohort_id -> id | student_mce_modules_cohort_id_fkey |
| student_milestones | students | student_id -> id | student_milestones_student_id_fkey |
| student_notes | students | student_id -> id | student_notes_student_id_fkey |
| student_notes | lab_users | author_id -> id | student_notes_author_id_fkey |
| student_preceptor_assignments | student_internships | internship_id -> id | student_preceptor_assignments_internship_id_fkey |
| student_preceptor_assignments | field_preceptors | preceptor_id -> id | student_preceptor_assignments_preceptor_id_fkey |
| student_skill_evaluations | lab_days | lab_day_id -> id | student_skill_evaluations_lab_day_id_fkey |
| student_skill_evaluations | lab_users | evaluator_id -> id | student_skill_evaluations_evaluator_id_fkey |
| student_skill_evaluations | students | student_id -> id | student_skill_evaluations_student_id_fkey |
| student_skill_evaluations | skill_sheets | skill_sheet_id -> id | student_skill_evaluations_skill_sheet_id_fkey |
| student_task_status | cohort_tasks | cohort_task_id -> id | student_task_status_cohort_task_id_fkey |
| student_task_status | lab_users | completed_by -> id | student_task_status_completed_by_fkey |
| student_task_status | students | student_id -> id | student_task_status_student_id_fkey |
| students | cohorts | cohort_id -> id | students_cohort_id_fkey |
| submissions | polls | poll_id -> id | submissions_poll_id_fkey |
| substitute_requests | lab_days | lab_day_id -> id | substitute_requests_lab_day_id_fkey |
| summative_evaluation_scores | lab_users | graded_by -> id | summative_evaluation_scores_graded_by_fkey |
| summative_evaluation_scores | summative_evaluations | evaluation_id -> id | summative_evaluation_scores_evaluation_id_fkey |
| summative_evaluation_scores | students | student_id -> id | summative_evaluation_scores_student_id_fkey |
| summative_evaluations | cohorts | cohort_id -> id | summative_evaluations_cohort_id_fkey |
| summative_evaluations | lab_users | created_by -> id | summative_evaluations_created_by_fkey |
| summative_evaluations | summative_scenarios | scenario_id -> id | summative_evaluations_scenario_id_fkey |
| summative_evaluations | student_internships | internship_id -> id | summative_evaluations_internship_id_fkey |
| summative_scenarios | scenarios | linked_scenario_id -> id | summative_scenarios_linked_scenario_id_fkey |
| supply_barcodes | supply_items | supply_item_id -> id | supply_barcodes_supply_item_id_fkey |
| supply_categories | supply_categories | parent_category_id -> id | supply_categories_parent_category_id_fkey |
| supply_items | locations | location_id -> id | supply_items_location_id_fkey |
| supply_items | inventory_bins | bin_id -> id | supply_items_bin_id_fkey |
| supply_items | supply_categories | category_id -> id | supply_items_category_id_fkey |
| supply_notifications | supply_items | supply_item_id -> id | supply_notifications_supply_item_id_fkey |
| supply_transactions | supply_items | supply_item_id -> id | supply_transactions_supply_item_id_fkey |
| task_assignees | lab_users | assignee_id -> id | task_assignees_assignee_id_fkey |
| task_assignees | instructor_tasks | task_id -> id | task_assignees_task_id_fkey |
| task_comments | lab_users | author_id -> id | task_comments_author_id_fkey |
| task_comments | instructor_tasks | task_id -> id | task_comments_task_id_fkey |
| teaching_log | cohorts | cohort_id -> id | teaching_log_cohort_id_fkey |
| teaching_log | instructor_certifications | certification_id -> id | teaching_log_certification_id_fkey |
| teaching_log | lab_days | lab_day_id -> id | teaching_log_lab_day_id_fkey |
| teaching_log | lab_users | instructor_id -> id | teaching_log_instructor_id_fkey |
| team_lead_log | scenario_assessments | scenario_assessment_id -> id | team_lead_log_scenario_assessment_id_fkey |
| team_lead_log | scenarios | scenario_id -> id | team_lead_log_scenario_id_fkey |
| team_lead_log | lab_stations | lab_station_id -> id | team_lead_log_lab_station_id_fkey |
| team_lead_log | cohorts | cohort_id -> id | team_lead_log_cohort_id_fkey |
| team_lead_log | lab_days | lab_day_id -> id | team_lead_log_lab_day_id_fkey |
| team_lead_log | students | student_id -> id | team_lead_log_student_id_fkey |
| template_review_comments | template_review_items | review_item_id -> id | template_review_comments_review_item_id_fkey |
| template_review_items | lab_days | lab_day_id -> id | template_review_items_lab_day_id_fkey |
| template_review_items | template_reviews | review_id -> id | template_review_items_review_id_fkey |
| template_reviews | cohorts | cohort_id -> id | template_reviews_cohort_id_fkey |
| timer_display_tokens | lab_users | created_by -> id | timer_display_tokens_created_by_fkey |
| user_departments | lab_users | user_id -> id | user_departments_user_id_fkey |
| user_departments | departments | department_id -> id | user_departments_department_id_fkey |
| user_endorsements | lab_users | user_id -> id | user_endorsements_user_id_fkey |
| user_endorsements | departments | department_id -> id | user_endorsements_department_id_fkey |
| user_roles | lab_users | user_id -> id | user_roles_user_id_fkey |
| webhook_deliveries | webhooks | webhook_id -> id | webhook_deliveries_webhook_id_fkey |

