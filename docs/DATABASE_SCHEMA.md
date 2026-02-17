# PMI EMS Scheduler - Database Schema

## Overview

The PMI EMS Scheduler database is built on PostgreSQL via Supabase. It uses:
- Row Level Security (RLS) for access control
- JSONB columns for flexible data structures
- Soft deletes via status fields
- Comprehensive audit logging

---

## Core System Tables

### lab_users (Primary User Table)

```sql
CREATE TABLE lab_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('superadmin', 'admin', 'lead_instructor', 'instructor', 'guest', 'pending')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:** email, role, is_active

### user_preferences

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT UNIQUE,
  dashboard_widgets JSONB DEFAULT '["overview", "myLabs", "notifications"]',
  quick_links JSONB DEFAULT '[]',
  notification_settings JSONB DEFAULT '{"enabled": true, "categories": {...}}',
  email_preferences JSONB DEFAULT '{"enabled": false, "mode": "immediate", "categories": {...}}',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_notifications

```sql
CREATE TABLE user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT CHECK (type IN ('lab_assignment', 'lab_reminder', 'feedback_new', 'feedback_resolved', 'task_assigned', 'general')),
  category TEXT CHECK (category IN ('tasks', 'labs', 'scheduling', 'feedback', 'clinical', 'system')),
  link_url TEXT,
  is_read BOOLEAN DEFAULT false,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:** user_email, is_read, created_at DESC

### user_endorsements

```sql
CREATE TABLE user_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES lab_users(id),
  endorsement_type TEXT CHECK (type IN ('director', 'mentor', 'preceptor')),
  title TEXT,
  department_id UUID REFERENCES departments(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);
```

---

## Program & Cohort Tables

### programs

```sql
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT,
  abbreviation TEXT,  -- EMT, AEMT, PM, PMD
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### departments

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  abbreviation TEXT,
  program_id UUID REFERENCES programs(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### cohorts

```sql
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id),
  cohort_number INTEGER NOT NULL,
  semester TEXT,
  current_semester INTEGER,  -- 1-4 for PM program phases
  start_date DATE,
  end_date DATE,
  expected_end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Unique:** (program_id, cohort_number)

---

## Student Tables

### students

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  cohort_id UUID REFERENCES cohorts(id),
  photo_url TEXT,
  status TEXT CHECK (status IN ('active', 'graduated', 'withdrawn', 'on_hold')) DEFAULT 'active',
  agency TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:** cohort_id, status, (first_name, last_name)

### student_compliance_docs

Wide table for tracking compliance requirements:

```sql
CREATE TABLE student_compliance_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE REFERENCES students(id),
  mmr_complete BOOLEAN DEFAULT false,
  vzv_complete BOOLEAN DEFAULT false,
  hep_b_complete BOOLEAN DEFAULT false,
  tdap_complete BOOLEAN DEFAULT false,
  covid_complete BOOLEAN DEFAULT false,
  tb_test_1_complete BOOLEAN DEFAULT false,
  physical_complete BOOLEAN DEFAULT false,
  health_insurance_complete BOOLEAN DEFAULT false,
  bls_complete BOOLEAN DEFAULT false,
  flu_shot_complete BOOLEAN DEFAULT false,
  hospital_orientation_complete BOOLEAN DEFAULT false,
  background_check_complete BOOLEAN DEFAULT false,
  drug_test_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### emt_student_tracking / aemt_student_tracking

Program-specific requirement tracking tables with similar structure.

---

## Lab Management Tables

### scenarios

Master scenario library with comprehensive patient data:

```sql
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  applicable_programs TEXT[],  -- GIN indexed
  category TEXT,
  subcategory TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),

  -- Dispatch
  dispatch_time TEXT,
  dispatch_location TEXT,
  chief_complaint TEXT,
  dispatch_notes TEXT,

  -- Patient Demographics
  patient_name TEXT,
  patient_age INTEGER,
  patient_sex TEXT,
  patient_weight TEXT,
  medical_history TEXT[],
  medications TEXT[],
  allergies TEXT,

  -- Assessment (XABCDE)
  assessment_x TEXT,  -- Hemorrhage Control
  assessment_a TEXT,  -- Airway
  assessment_b TEXT,  -- Breathing
  assessment_c TEXT,  -- Circulation
  assessment_d TEXT,  -- Disability
  assessment_e TEXT,  -- Expose
  avpu TEXT,
  gcs TEXT,
  pupils TEXT,

  -- JSONB Fields
  initial_vitals JSONB,      -- {time, bp, pulse, resp, spo2, etco2, temp, glucose, gcs, pupils, skin}
  sample_history JSONB,      -- {signs_symptoms, allergies, medications, past_history, last_oral_intake, events}
  opqrst JSONB,              -- {onset, provocation, quality, radiation, severity, time_onset}
  secondary_survey JSONB,
  ekg_findings JSONB,
  phases JSONB[],            -- Array of scenario phases

  -- Educational
  learning_objectives TEXT[],
  critical_actions TEXT[],
  debrief_points TEXT[],
  equipment_needed TEXT[],
  medications_to_administer TEXT[],
  estimated_duration INTEGER,

  -- Grading
  documentation_required BOOLEAN DEFAULT false,
  platinum_required BOOLEAN DEFAULT false,

  created_by TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### lab_days

```sql
CREATE TABLE lab_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  cohort_id UUID REFERENCES cohorts(id),
  semester INTEGER,
  week_number INTEGER,
  day_number INTEGER,
  title VARCHAR(255),
  num_rotations INTEGER DEFAULT 4,
  rotation_duration INTEGER DEFAULT 45,  -- minutes
  assigned_timer_id UUID REFERENCES timer_display_tokens(id),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### lab_stations

```sql
CREATE TABLE lab_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE,
  station_number INTEGER,
  station_type TEXT CHECK (type IN ('scenario', 'skill', 'documentation', 'lecture', 'testing')),
  scenario_id UUID REFERENCES scenarios(id),
  skill_name TEXT,
  custom_title VARCHAR(255),
  station_details TEXT,
  instructor_id UUID REFERENCES lab_users(id),
  additional_instructor_id UUID REFERENCES lab_users(id),
  location TEXT,
  equipment_needed TEXT,
  station_notes TEXT,
  skill_sheet_url TEXT,
  instructions_url TEXT,
  documentation_required BOOLEAN DEFAULT false,
  platinum_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### skills

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skill_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT CHECK (type IN ('skill_sheet', 'checkoff', 'reference', 'protocol')),
  file_type TEXT,
  file_size_bytes INTEGER,
  display_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Assessment Tables

```sql
CREATE TABLE scenario_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_station_id UUID REFERENCES lab_stations(id),
  lab_day_id UUID REFERENCES lab_days(id),
  cohort_id UUID REFERENCES cohorts(id),
  rotation_number INTEGER,

  -- Scoring (0-4 scale)
  assessment_score INTEGER,
  treatment_score INTEGER,
  communication_score INTEGER,

  -- Team Lead
  team_lead_id UUID REFERENCES students(id),
  team_lead_issues TEXT,

  -- Performance
  skills_performed TEXT[],
  comments TEXT,

  -- Flagging
  issue_level TEXT CHECK (level IN ('none', 'minor', 'needs_followup')),
  flag_categories TEXT[],
  flagged_for_review BOOLEAN DEFAULT false,
  flag_resolved BOOLEAN DEFAULT false,
  flag_resolution_notes TEXT,
  flag_resolved_by UUID REFERENCES lab_users(id),
  flag_resolved_at TIMESTAMPTZ,

  graded_by UUID REFERENCES lab_users(id),
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_station_id UUID REFERENCES lab_stations(id),
  lab_day_id UUID REFERENCES lab_days(id),
  skill_name TEXT,
  student_id UUID REFERENCES students(id),
  cohort_id UUID REFERENCES cohorts(id),

  -- Scoring (1-5 scale)
  preparation_safety INTEGER,
  technical_performance INTEGER,
  critical_thinking INTEGER,
  time_management INTEGER,
  overall_competency INTEGER,

  narrative_feedback TEXT,
  graded_by UUID REFERENCES lab_users(id),
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Timer System

```sql
CREATE TABLE lab_timer_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID UNIQUE REFERENCES lab_days(id) ON DELETE CASCADE,
  rotation_number INTEGER DEFAULT 1,
  status TEXT CHECK (status IN ('running', 'paused', 'stopped')),
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  elapsed_when_paused INTEGER,  -- seconds
  duration_seconds INTEGER,
  debrief_seconds INTEGER DEFAULT 300,
  mode TEXT CHECK (mode IN ('countdown', 'countup')),
  rotation_acknowledged BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE timer_display_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  room_name TEXT,
  lab_room_id UUID REFERENCES locations(id),
  timer_type TEXT CHECK (type IN ('fixed', 'mobile')),
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);
```

---

## Clinical & Internship Tables

### agencies

```sql
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT,
  type TEXT CHECK (type IN ('ems', 'hospital')),
  address TEXT,
  phone TEXT,
  website TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### field_preceptors

```sql
CREATE TABLE field_preceptors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  agency_id UUID REFERENCES agencies(id),
  agency_name TEXT,
  station TEXT,
  normal_schedule TEXT,
  snhd_trained_date DATE,
  snhd_cert_expires DATE,
  max_students INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### student_internships

Comprehensive internship tracking:

```sql
CREATE TABLE student_internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  cohort_id UUID REFERENCES cohorts(id),

  -- Assignment
  preceptor_id UUID REFERENCES field_preceptors(id),
  agency_id UUID REFERENCES agencies(id),
  agency_name TEXT,
  shift_type TEXT,

  -- Key Dates
  placement_date DATE,
  orientation_date DATE,
  orientation_completed BOOLEAN DEFAULT false,
  internship_start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,

  -- Phase Tracking
  current_phase TEXT CHECK (phase IN ('pre_internship', 'phase_1_mentorship', 'phase_2_evaluation', 'completed', 'extended')),
  phase_1_start_date DATE,
  phase_1_end_date DATE,
  phase_1_eval_completed BOOLEAN DEFAULT false,
  phase_1_meeting_poll_id TEXT,
  phase_1_meeting_scheduled DATE,

  phase_2_start_date DATE,
  phase_2_end_date DATE,
  phase_2_eval_completed BOOLEAN DEFAULT false,
  phase_2_meeting_poll_id TEXT,
  phase_2_meeting_scheduled DATE,

  -- Exams
  written_exam_date DATE,
  written_exam_passed BOOLEAN,
  psychomotor_exam_date DATE,
  psychomotor_exam_passed BOOLEAN,
  final_exam_poll_id TEXT,
  final_exam_scheduled DATE,

  -- Closeout
  internship_completion_date DATE,
  snhd_submitted BOOLEAN DEFAULT false,
  snhd_submitted_date DATE,
  nremt_clearance_date DATE,
  closeout_completed BOOLEAN DEFAULT false,

  -- Extension
  is_extended BOOLEAN DEFAULT false,
  extension_reason TEXT,
  original_expected_end_date DATE,

  -- Pre-Placement Clearance (booleans)
  liability_form_completed BOOLEAN DEFAULT false,
  background_check_completed BOOLEAN DEFAULT false,
  drug_screen_completed BOOLEAN DEFAULT false,
  immunizations_verified BOOLEAN DEFAULT false,
  cpr_card_verified BOOLEAN DEFAULT false,
  uniform_issued BOOLEAN DEFAULT false,
  badge_issued BOOLEAN DEFAULT false,

  -- NREMT
  cleared_for_nremt BOOLEAN DEFAULT false,
  ryan_notified BOOLEAN DEFAULT false,

  status TEXT CHECK (status IN ('not_started', 'in_progress', 'on_track', 'at_risk', 'extended', 'completed', 'withdrawn')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### student_preceptor_assignments

```sql
CREATE TABLE student_preceptor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID REFERENCES student_internships(id),
  preceptor_id UUID REFERENCES field_preceptors(id),
  role TEXT CHECK (role IN ('primary', 'secondary', 'tertiary')),
  assigned_date DATE,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  assigned_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(internship_id, preceptor_id, role)
);
```

### clinical_site_visits

```sql
CREATE TABLE clinical_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT,
  system TEXT,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clinical_site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES clinical_sites(id),
  agency_id UUID REFERENCES agencies(id),
  departments TEXT[],
  visitor_id UUID REFERENCES lab_users(id),
  visitor_name TEXT,
  visit_date DATE NOT NULL,
  visit_time TIME,
  cohort_id UUID REFERENCES cohorts(id),
  entire_class BOOLEAN DEFAULT false,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  CHECK (site_id IS NOT NULL OR agency_id IS NOT NULL)
);

CREATE TABLE clinical_visit_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES clinical_site_visits(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(visit_id, student_id)
);
```

### student_clinical_hours

```sql
CREATE TABLE student_clinical_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE REFERENCES students(id),

  -- Hours by rotation type
  psych_hours NUMERIC DEFAULT 0,
  psych_shifts INTEGER DEFAULT 0,
  ed_hours NUMERIC DEFAULT 0,
  ed_shifts INTEGER DEFAULT 0,
  icu_hours NUMERIC DEFAULT 0,
  icu_shifts INTEGER DEFAULT 0,
  ob_hours NUMERIC DEFAULT 0,
  ob_shifts INTEGER DEFAULT 0,
  or_hours NUMERIC DEFAULT 0,
  or_shifts INTEGER DEFAULT 0,
  peds_ed_hours NUMERIC DEFAULT 0,
  peds_ed_shifts INTEGER DEFAULT 0,
  peds_icu_hours NUMERIC DEFAULT 0,
  peds_icu_shifts INTEGER DEFAULT 0,
  ems_field_hours NUMERIC DEFAULT 0,
  ems_field_shifts INTEGER DEFAULT 0,
  cardiology_hours NUMERIC DEFAULT 0,
  cardiology_shifts INTEGER DEFAULT 0,
  ems_ridealong_hours NUMERIC DEFAULT 0,
  ems_ridealong_shifts INTEGER DEFAULT 0,

  -- Generated totals
  total_hours NUMERIC GENERATED ALWAYS AS (...) STORED,
  total_shifts INTEGER GENERATED ALWAYS AS (...) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Scheduling Tables

### polls

```sql
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES lab_users(id),
  cohort_id UUID REFERENCES cohorts(id),
  poll_type TEXT CHECK (type IN ('event', 'availability')),
  event_date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  event_description TEXT,
  available_slots JSONB DEFAULT '[]',  -- GIN indexed
  status TEXT CHECK (status IN ('active', 'closed', 'archived')),
  closes_at TIMESTAMPTZ,
  responses_visible BOOLEAN DEFAULT true,
  allow_comments BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id),
  respondent_name TEXT,
  respondent_email TEXT,
  respondent_role VARCHAR(50),
  selected_slots JSONB,
  comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Shift Scheduling

```sql
CREATE TABLE instructor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES lab_users(id),
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  notes TEXT,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instructor_id, date, start_time)
);

CREATE TABLE open_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  department TEXT,
  created_by UUID REFERENCES lab_users(id),
  min_instructors INTEGER DEFAULT 1,
  max_instructors INTEGER,
  is_filled BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shift_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES open_shifts(id),
  instructor_id UUID REFERENCES lab_users(id),
  signup_start_time TIME,
  signup_end_time TIME,
  is_partial BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'declined', 'withdrawn')),
  confirmed_by UUID REFERENCES lab_users(id),
  confirmed_at TIMESTAMPTZ,
  declined_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, instructor_id)
);
```

---

## Task System

```sql
CREATE TABLE instructor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_by UUID REFERENCES lab_users(id),
  assigned_to UUID REFERENCES lab_users(id),  -- Legacy single assignee
  due_date DATE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  related_link TEXT,
  completion_mode TEXT CHECK (mode IN ('single', 'any', 'all')) DEFAULT 'single',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES instructor_tasks(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES lab_users(id),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, assignee_id)
);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES instructor_tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES lab_users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Onboarding System

```sql
CREATE TABLE onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  instructor_type TEXT,
  created_by TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  target_days_start INTEGER,
  target_days_end INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID REFERENCES onboarding_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT CHECK (type IN ('checklist', 'document', 'video', 'form', 'observation', 'sign_off')),
  resource_url TEXT,
  sort_order INTEGER,
  is_required BOOLEAN DEFAULT true,
  estimated_minutes INTEGER,
  requires_sign_off BOOLEAN DEFAULT false,
  sign_off_role TEXT,
  lane TEXT CHECK (lane IN ('institutional', 'operational', 'mentorship')),
  applicable_types TEXT[],
  requires_evidence BOOLEAN DEFAULT false,
  requires_director BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES onboarding_templates(id),
  instructor_email TEXT NOT NULL,
  instructor_type TEXT,
  mentor_email TEXT,
  assigned_by TEXT,
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  status TEXT CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE onboarding_task_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES onboarding_assignments(id) ON DELETE CASCADE,
  task_id UUID REFERENCES onboarding_tasks(id),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'waived')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  signed_off_by TEXT,
  signed_off_at TIMESTAMPTZ,
  time_spent_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, task_id)
);
```

---

## Notification & Email System

```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES lab_users(id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  template_data JSONB,
  status TEXT CHECK (status IN ('pending', 'processing', 'sent', 'failed')) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES lab_users(id),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT CHECK (status IN ('sent', 'failed')),
  resend_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
```

---

## Audit & Compliance

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES lab_users(id),
  user_email TEXT,
  user_role TEXT,
  action TEXT CHECK (action IN ('view', 'create', 'update', 'delete', 'export', 'login', 'logout', 'access_denied')),
  resource_type TEXT,
  resource_id UUID,
  resource_description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:** user_id, user_email, action, resource_type, created_at DESC

---

## Feedback System

```sql
CREATE TABLE feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT CHECK (type IN ('bug', 'feature', 'other')),
  description TEXT NOT NULL,
  page_url TEXT,
  user_email TEXT,
  user_agent TEXT,
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT CHECK (status IN ('new', 'read', 'in_progress', 'needs_investigation', 'resolved', 'archived')),
  resolution_notes TEXT,
  read_at TIMESTAMPTZ,
  read_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key JSONB Structures

### initial_vitals (Scenario)
```json
{
  "time": "00:00",
  "bp": "120/80",
  "pulse": 72,
  "resp": 16,
  "spo2": 98,
  "etco2": 38,
  "temp": "98.6F",
  "glucose": 90,
  "gcs": 15,
  "pupils": "PERRL",
  "skin": "warm, dry"
}
```

### email_preferences (User Preferences)
```json
{
  "enabled": true,
  "mode": "immediate",  // immediate, daily_digest
  "digest_time": "08:00",
  "categories": {
    "tasks": true,
    "labs": true,
    "scheduling": true,
    "feedback": false,
    "clinical": true,
    "system": true
  }
}
```

### dashboard_widgets (User Preferences)
```json
["overview", "myLabs", "notifications", "quickLinks", "recentFeedback"]
```

---

## RLS Policies Summary

| Table | Policy | Access |
|-------|--------|--------|
| lab_users | authenticated_read | All authenticated can read |
| user_notifications | user_own | Users access own notifications |
| user_preferences | user_own | Users access own preferences |
| students | authenticated_read | All authenticated can read |
| scenarios | authenticated_read | All authenticated can read |
| audit_log | superadmin_only | Only superadmins can read |

---

## Migration Files

Located in `supabase/migrations/`:
- `20260201_initial_schema.sql`
- `20260205_clinical_tracking.sql`
- `20260210_task_system.sql`
- `20260215_onboarding.sql`
- `20260217_email_notifications.sql`
- `20260217_multi_assign_tasks.sql`
- ... and more

---

*Generated: 2026-02-17*
