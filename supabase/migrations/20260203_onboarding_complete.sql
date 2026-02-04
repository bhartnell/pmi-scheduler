-- =============================================
-- PMI Paramedic Tools - Complete Onboarding System
-- Run this FIRST - it creates all tables, then enhancements, then seed data
-- =============================================

-- =============================================
-- PART 1: CORE TABLES
-- =============================================

-- Templates define the structure for different instructor types
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  instructor_type TEXT NOT NULL DEFAULT 'all'
    CHECK (instructor_type IN ('full_time', 'part_time', 'lab_only', 'adjunct', 'all')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON onboarding_templates(instructor_type);

-- Phases are the major sections within a template
CREATE TABLE IF NOT EXISTS onboarding_phases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  target_days_start INTEGER DEFAULT 0,
  target_days_end INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phases_template ON onboarding_phases(template_id);

-- Tasks are individual items within a phase
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id UUID NOT NULL REFERENCES onboarding_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'checklist'
    CHECK (task_type IN ('checklist', 'document', 'video', 'form', 'observation', 'sign_off')),
  resource_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  estimated_minutes INTEGER,
  requires_sign_off BOOLEAN DEFAULT false,
  sign_off_role TEXT CHECK (sign_off_role IN ('mentor', 'program_director', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_phase ON onboarding_tasks(phase_id);

-- Assignments link an instructor to a template
CREATE TABLE IF NOT EXISTS onboarding_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES onboarding_templates(id),
  instructor_email TEXT NOT NULL,
  instructor_type TEXT NOT NULL DEFAULT 'full_time'
    CHECK (instructor_type IN ('full_time', 'part_time', 'lab_only', 'adjunct')),
  mentor_email TEXT,
  assigned_by TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_instructor ON onboarding_assignments(instructor_email);
CREATE INDEX IF NOT EXISTS idx_assignments_mentor ON onboarding_assignments(mentor_email);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON onboarding_assignments(status);

-- Task progress tracks each instructor's progress on each task
CREATE TABLE IF NOT EXISTS onboarding_task_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES onboarding_assignments(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'waived')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  signed_off_by TEXT,
  signed_off_at TIMESTAMPTZ,
  time_spent_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_assignment ON onboarding_task_progress(assignment_id);
CREATE INDEX IF NOT EXISTS idx_progress_task ON onboarding_task_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_progress_status ON onboarding_task_progress(status);

-- Event log for audit trail
CREATE TABLE IF NOT EXISTS onboarding_event_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES onboarding_assignments(id) ON DELETE SET NULL,
  task_progress_id UUID REFERENCES onboarding_task_progress(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  triggered_by TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_log_assignment ON onboarding_event_log(assignment_id);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON onboarding_event_log(created_at);


-- =============================================
-- PART 2: ROW LEVEL SECURITY
-- =============================================

ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_task_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_event_log ENABLE ROW LEVEL SECURITY;

-- Templates: everyone can read, admins can write
CREATE POLICY "anyone_reads_templates" ON onboarding_templates FOR SELECT USING (true);
CREATE POLICY "admins_manage_templates" ON onboarding_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);

-- Phases: everyone can read
CREATE POLICY "anyone_reads_phases" ON onboarding_phases FOR SELECT USING (true);
CREATE POLICY "admins_manage_phases" ON onboarding_phases FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);

-- Tasks: everyone can read
CREATE POLICY "anyone_reads_tasks" ON onboarding_tasks FOR SELECT USING (true);
CREATE POLICY "admins_manage_tasks" ON onboarding_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);

-- Assignments: instructors see their own, mentors see mentees, admins see all
CREATE POLICY "instructors_read_own_assignments" ON onboarding_assignments
  FOR SELECT USING (instructor_email = auth.jwt() ->> 'email');
CREATE POLICY "mentors_read_mentee_assignments" ON onboarding_assignments
  FOR SELECT USING (mentor_email = auth.jwt() ->> 'email');
CREATE POLICY "admins_manage_assignments" ON onboarding_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);

-- Task Progress: instructors can update their own, mentors can update mentees
CREATE POLICY "instructors_manage_own_progress" ON onboarding_task_progress FOR ALL USING (
  EXISTS (
    SELECT 1 FROM onboarding_assignments a
    WHERE a.id = onboarding_task_progress.assignment_id
    AND a.instructor_email = auth.jwt() ->> 'email'
  )
);
CREATE POLICY "mentors_manage_mentee_progress" ON onboarding_task_progress FOR ALL USING (
  EXISTS (
    SELECT 1 FROM onboarding_assignments a
    WHERE a.id = onboarding_task_progress.assignment_id
    AND a.mentor_email = auth.jwt() ->> 'email'
  )
);
CREATE POLICY "admins_manage_all_progress" ON onboarding_task_progress FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);

-- Event Log: read own, admins read all
CREATE POLICY "users_read_own_events" ON onboarding_event_log FOR SELECT USING (
  triggered_by = auth.jwt() ->> 'email' OR
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "anyone_inserts_events" ON onboarding_event_log FOR INSERT WITH CHECK (true);


-- =============================================
-- PART 3: ANALYTICS VIEWS
-- =============================================

-- Assignment Summary View
CREATE OR REPLACE VIEW onboarding_assignment_summary AS
SELECT
  a.id AS assignment_id,
  a.instructor_email,
  lu.name AS instructor_name,
  a.instructor_type,
  a.mentor_email,
  mentor.name AS mentor_name,
  a.status,
  a.start_date,
  a.target_completion_date,
  COUNT(tp.id) AS total_tasks,
  COUNT(tp.id) FILTER (WHERE tp.status = 'completed') AS completed_tasks,
  COUNT(tp.id) FILTER (WHERE tp.status = 'in_progress') AS in_progress_tasks,
  COUNT(tp.id) FILTER (WHERE tp.status = 'blocked') AS blocked_tasks,
  ROUND(
    COUNT(tp.id) FILTER (WHERE tp.status IN ('completed', 'waived'))::NUMERIC
    / NULLIF(COUNT(tp.id), 0) * 100, 0
  ) AS progress_percent,
  COALESCE(SUM(tp.time_spent_minutes), 0) AS total_minutes_spent,
  MAX(tp.updated_at) AS last_activity
FROM onboarding_assignments a
LEFT JOIN onboarding_task_progress tp ON a.id = tp.assignment_id
LEFT JOIN lab_users lu ON a.instructor_email = lu.email
LEFT JOIN lab_users mentor ON a.mentor_email = mentor.email
GROUP BY a.id, a.instructor_email, lu.name, a.instructor_type,
         a.mentor_email, mentor.name, a.status, a.start_date, a.target_completion_date;


-- =============================================
-- PART 4: V3 ENHANCEMENTS - Lanes, Dependencies, Evidence
-- =============================================

-- Task Lanes
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS lane TEXT DEFAULT 'operational'
    CHECK (lane IN ('institutional', 'operational', 'mentorship'));

-- Instructor type filtering
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS applicable_types TEXT[] DEFAULT '{full_time,part_time,lab_only,adjunct}';

-- Evidence tracking flag
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS requires_evidence BOOLEAN DEFAULT false;


-- Task Dependencies Table
CREATE TABLE IF NOT EXISTS onboarding_task_dependencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL DEFAULT 'hard' CHECK (gate_type IN ('hard', 'soft')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE onboarding_task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_reads_dependencies" ON onboarding_task_dependencies FOR SELECT USING (true);
CREATE POLICY "admins_manage_dependencies" ON onboarding_task_dependencies FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);


-- Evidence Upload Table
CREATE TABLE IF NOT EXISTS onboarding_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_progress_id UUID NOT NULL REFERENCES onboarding_task_progress(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  storage_path TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_evidence_progress ON onboarding_evidence(task_progress_id);

ALTER TABLE onboarding_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_evidence" ON onboarding_evidence FOR ALL USING (
  EXISTS (SELECT 1 FROM lab_users WHERE email = auth.jwt() ->> 'email' AND role IN ('admin', 'superadmin'))
);
CREATE POLICY "users_manage_own_evidence" ON onboarding_evidence FOR ALL USING (
  uploaded_by = auth.jwt() ->> 'email'
);
CREATE POLICY "mentors_view_mentee_evidence" ON onboarding_evidence FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM onboarding_task_progress tp
    JOIN onboarding_assignments a ON tp.assignment_id = a.id
    WHERE tp.id = onboarding_evidence.task_progress_id
    AND a.mentor_email = auth.jwt() ->> 'email'
  )
);


-- Lane Progress View (uses 'name' not 'full_name')
CREATE OR REPLACE VIEW onboarding_lane_progress AS
SELECT
  a.id AS assignment_id,
  a.instructor_email,
  lu.name AS instructor_name,
  t.lane,
  COUNT(tp.id) AS total_tasks,
  COUNT(tp.id) FILTER (WHERE tp.status = 'completed') AS completed_tasks,
  COUNT(tp.id) FILTER (WHERE tp.status = 'in_progress') AS in_progress_tasks,
  COUNT(tp.id) FILTER (WHERE tp.status = 'blocked') AS blocked_tasks,
  ROUND(
    COUNT(tp.id) FILTER (WHERE tp.status IN ('completed', 'waived'))::NUMERIC
    / NULLIF(COUNT(tp.id), 0) * 100, 0
  ) AS progress_pct,
  COALESCE(SUM(tp.time_spent_minutes), 0) AS total_minutes_spent
FROM onboarding_assignments a
JOIN onboarding_task_progress tp ON a.id = tp.assignment_id
JOIN onboarding_tasks t ON tp.task_id = t.id
LEFT JOIN lab_users lu ON a.instructor_email = lu.email
GROUP BY a.id, a.instructor_email, lu.name, t.lane;


-- =============================================
-- PART 5: SEED DATA - Template, Phases, Tasks
-- =============================================

-- Clear any existing seed data
DELETE FROM onboarding_tasks WHERE phase_id IN (
  SELECT id FROM onboarding_phases WHERE template_id = 'a0000000-0000-0000-0000-000000000001'
);
DELETE FROM onboarding_phases WHERE template_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM onboarding_templates WHERE id = 'a0000000-0000-0000-0000-000000000001';


-- TEMPLATE
INSERT INTO onboarding_templates (id, name, description, instructor_type, created_by)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Paramedic Instructor Onboarding',
  'Comprehensive onboarding for new paramedic program instructors. Integrates Faculty Fundamentals (Modules 1-4) competencies with program-specific readiness across a structured 4-week ramp-up and 6-month completion timeline.',
  'all',
  'admin@pmi.edu'
);


-- PHASE 1: Week 1
INSERT INTO onboarding_phases (id, template_id, name, description, sort_order, target_days_start, target_days_end)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Week 1: Orientation & Foundations',
  'Campus orientation, system access, policy review, first shadows, and Faculty Fundamentals Module 1 kickoff. Goal: 60% of required training complete by end of week.',
  1, 0, 7
);

INSERT INTO onboarding_tasks (phase_id, title, description, task_type, resource_url, sort_order, is_required, estimated_minutes, requires_sign_off, sign_off_role) VALUES
('b0000000-0000-0000-0000-000000000001', 'Campus Tour & Office Setup', 'Guided tour of campus, sim lab, supply rooms, emergency equipment. Set up workstation/desk. Meet & greet with program faculty.', 'checklist', NULL, 1, true, 120, true, 'mentor'),
('b0000000-0000-0000-0000-000000000001', 'System Access: PMI Email, Portal, Dashboard', 'Verify access to PMI email, Faculty Portal, and Dashboard. Test login credentials.', 'checklist', NULL, 2, true, 15, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'System Access: Blackboard LMS', 'Verify Blackboard access. Navigate to assigned course shells.', 'checklist', NULL, 3, true, 15, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'System Access: UKG (HR Platform)', 'Log into UKG. Complete any outstanding HR documents. Verify faculty file is current.', 'checklist', NULL, 4, true, 15, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'System Access: PMI Paramedic Tools', 'Log into pmiparamedic.tools. Familiarize with lab scheduling, scenarios, and grading.', 'checklist', NULL, 5, true, 15, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'System Access: Faculty Resource Center', 'Verify access to Faculty Resource Center website.', 'checklist', NULL, 6, true, 10, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'System Access: Publisher Resources', 'Ensure access to publisher resources for assigned class textbooks.', 'checklist', NULL, 7, true, 15, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: PMI Academic Catalog', 'Read and identify key sections of the Academic Catalog relevant to your program.', 'document', NULL, 8, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: PMI Faculty Handbook', 'Read the Faculty Handbook. Note attendance policies, grading standards, and faculty expectations.', 'document', NULL, 9, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: PMI Policies & Procedures Manual', 'Review the P&P Manual. Identify policies you will reference most frequently.', 'document', NULL, 10, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: Student Handbook & PPS', 'Review the Student Handbook and Program Policies & Procedures (PPS) for your program.', 'document', NULL, 11, true, 30, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: Program Outline & Course Syllabi', 'Review the full program outline, course syllabi, and course outlines for all assigned courses.', 'document', NULL, 12, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: Existing Lesson Plans & Course Calendars', 'Review sample lesson plans and course calendars. Note format, level of detail, and PMI Policy 045 compliance.', 'document', NULL, 13, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: Program Grading & Skills/Competencies', 'Review grading expectations, skills checklists, and competency requirements for your program.', 'document', NULL, 14, true, 30, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Review: Textbooks for Assigned Courses', 'Receive and review textbooks for all assigned courses.', 'document', NULL, 15, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Meet Mentor & Program Director', 'Introductory meeting: communication cadence, expectations, onboarding timeline, and Q&A.', 'sign_off', NULL, 16, true, 30, true, 'program_director'),
('b0000000-0000-0000-0000-000000000001', 'Shadow: Program Faculty Session #1', 'Observe a full class session with an experienced program instructor. Take notes on classroom management, pacing, engagement, and content delivery.', 'observation', NULL, 17, true, 120, true, 'mentor'),
('b0000000-0000-0000-0000-000000000001', 'Shadow: Program Faculty Session #2', 'Second observation session (different instructor or class if possible). Compare approaches.', 'observation', NULL, 18, true, 120, true, 'mentor'),
('b0000000-0000-0000-0000-000000000001', 'Best Practices Discussion with Program Faculty', 'Informal discussion with experienced faculty about effective and ineffective teaching strategies.', 'checklist', NULL, 19, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Begin Faculty Fundamentals Module 1', 'Start Module 1: Introduction to PMI & Teaching Fundamentals. Complete Section 1 resources: PMI History, PMI DNA Podcast, Policies & Procedures: Why They Matter.', 'video', NULL, 20, true, 90, false, NULL),
('b0000000-0000-0000-0000-000000000001', 'Week 1 Wrap-Up & Debrief with PD', 'End-of-week debrief with Program Director. Review progress, address questions, confirm Week 2 plan. Target: 60% of required training complete.', 'sign_off', NULL, 21, true, 30, true, 'program_director');


-- PHASE 2: Week 2
INSERT INTO onboarding_phases (id, template_id, name, description, sort_order, target_days_start, target_days_end)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Week 2: Guided Practice & Setup',
  'Blackboard training, create sample materials, DE training, visit clinical sites, observe open lab. Continue Faculty Fundamentals Module 1 competencies. Goal: 100% of required training complete.',
  2, 8, 14
);

INSERT INTO onboarding_tasks (phase_id, title, description, task_type, resource_url, sort_order, is_required, estimated_minutes, requires_sign_off, sign_off_role) VALUES
('b0000000-0000-0000-0000-000000000002', 'Blackboard Training', 'Formal Blackboard LMS training. Learn to navigate course shells, post content, manage gradebook, and communicate with students.', 'video', NULL, 1, true, 180, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'DE Training (if applicable)', 'Distance Education training for any online or hybrid course components.', 'video', NULL, 2, false, 120, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'Publisher Account Setup', 'Set up accounts with textbook publishers. Access instructor resources, test banks, and supplementary materials.', 'checklist', NULL, 3, true, 30, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'Create: Sample Course Calendar', 'Develop a sample course calendar for one assigned course. Must meet PMI Policy 045 requirements. Review with PD.', 'form', NULL, 4, true, 90, true, 'program_director'),
('b0000000-0000-0000-0000-000000000002', 'Create: Sample Lesson Plan', 'Develop a sample lesson plan including objectives, anticipatory set, materials list, expected outcomes, modifications, and assessments. Review with PD.', 'form', NULL, 5, true, 90, true, 'program_director'),
('b0000000-0000-0000-0000-000000000002', 'Create: Sample Course Assignments', 'Develop sample assignments for one assigned course. Review with PD.', 'form', NULL, 6, true, 60, true, 'program_director'),
('b0000000-0000-0000-0000-000000000002', 'Review Blackboard Course Shells', 'Review and familiarize with all assigned Blackboard course shells. Identify content gaps or questions.', 'checklist', NULL, 7, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'Observe: Open Lab Session', 'Observe an open lab session to understand lab expectations, student interactions, and skills instruction flow.', 'observation', NULL, 8, true, 60, true, 'mentor'),
('b0000000-0000-0000-0000-000000000002', 'Observe: Tutoring Session', 'Observe a tutoring session to understand student support practices.', 'observation', NULL, 9, false, 60, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'Visit Clinical Sites', 'Visit assigned clinical sites. Meet site contacts and understand clinical rotation logistics.', 'checklist', NULL, 10, true, 120, true, 'mentor'),
('b0000000-0000-0000-0000-000000000002', 'FF Module 1: New Faculty Checklist', 'Faculty Fundamentals Module 1, Section 1 deliverable. Complete the New Faculty Checklist.', 'form', NULL, 11, true, 30, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'FF Module 1: PMI Policies & Procedures Competency (Quiz)', 'Faculty Fundamentals Module 1, Section 1 assessment. Demonstrate knowledge of PMI policies and procedures.', 'form', NULL, 12, true, 30, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'FF Module 1: Classroom Expectations Competency', 'Faculty Fundamentals Module 1, Section 2 assessment. Demonstrate ability to set, communicate, and document classroom expectations. Resources: The Classroom Experience, Setting the Stage, Promoting Professionalism Podcast, PPS Video, Day One Checklist.', 'form', NULL, 13, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000002', 'Week 2 Wrap-Up & Debrief with PD', 'End-of-week debrief. Review sample materials, address concerns, confirm Week 3 readiness. Target: 100% of required training complete.', 'sign_off', NULL, 14, true, 30, true, 'program_director');


-- PHASE 3: Weeks 3-4
INSERT INTO onboarding_phases (id, template_id, name, description, sort_order, target_days_start, target_days_end)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'Weeks 3–4: Supervised Instruction',
  'Begin course instruction with PD observation, faculty assistance, and observation. Week 4 transitions to normal schedule. Complete Faculty Fundamentals Module 1 competencies.',
  3, 15, 28
);

INSERT INTO onboarding_tasks (phase_id, title, description, task_type, resource_url, sort_order, is_required, estimated_minutes, requires_sign_off, sign_off_role) VALUES
('b0000000-0000-0000-0000-000000000003', 'First Solo Instruction Session (PD Observed)', 'Deliver your first course instruction session. Program Director observes and provides feedback.', 'observation', NULL, 1, true, 180, true, 'program_director'),
('b0000000-0000-0000-0000-000000000003', 'Instruction with Faculty Assistance', 'Teach with an experienced faculty member available for support and co-teaching as needed.', 'observation', NULL, 2, true, 180, true, 'mentor'),
('b0000000-0000-0000-0000-000000000003', 'Faculty Observation of Your Teaching', 'Experienced program faculty observes your instruction and provides written feedback.', 'observation', NULL, 3, true, 180, true, 'mentor'),
('b0000000-0000-0000-0000-000000000003', 'Open Lab or Tutoring Session (Lead)', 'Lead an open lab or tutoring session independently.', 'observation', NULL, 4, true, 120, true, 'mentor'),
('b0000000-0000-0000-0000-000000000003', 'Non-Student Contact Time Planning', 'Use non-student contact time blocks for lesson prep, grading, and course development.', 'checklist', NULL, 5, true, 240, false, NULL),
('b0000000-0000-0000-0000-000000000003', 'FF Module 1: Course Schedule Competency', 'Faculty Fundamentals Module 1, Section 3 assessment. Develop a comprehensive course calendar (weekly schedule) meeting PMI Policy 045. Resources: Basics of Classroom Success Podcast, Lay the Foundation templates.', 'form', NULL, 6, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000003', 'FF Module 1: Lesson Plan Competency', 'Faculty Fundamentals Module 1, Section 3 assessment. Develop a comprehensive lesson plan with objectives, anticipatory set, materials, outcomes, modifications, and assessments. Resources: Lesson Planning Podcast, How to Create an Effective Lesson Plan Video.', 'form', NULL, 7, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000003', 'FF Module 1: Diverse Classroom Competency', 'Faculty Fundamentals Module 1, Section 4 assessment. Demonstrate understanding of the adult learner and differentiated instruction. Resources: Adult Learner Podcast, Impact of Diversity on Instructional Methods Video.', 'form', NULL, 8, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000003', 'FF Module 1: Online Library Competency', 'Faculty Fundamentals Module 1, Section 4 assessment. Navigate, evaluate, and utilize the Online Library effectively.', 'form', NULL, 9, true, 30, false, NULL),
('b0000000-0000-0000-0000-000000000003', 'FF Module 1: Teaching Aids (PPT) Competency', 'Faculty Fundamentals Module 1, Section 4 assessment. Develop interactive and engaging PowerPoint presentations. Resources: Engaging Students Through Technology, PPT Tips Infographic.', 'form', NULL, 10, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000003', 'Week 3 Goals & Expectations Meeting with PD', 'Meet with Program Director to discuss instruction goals, expectations, and any concerns from first teaching sessions.', 'sign_off', NULL, 11, true, 30, true, 'program_director'),
('b0000000-0000-0000-0000-000000000003', 'Week 4: Begin Normal Schedule', 'Transition to full normal teaching schedule. Confirm autonomous performance of position responsibilities.', 'sign_off', NULL, 12, true, 15, true, 'program_director');


-- PHASE 4: Months 2-3
INSERT INTO onboarding_phases (id, template_id, name, description, sort_order, target_days_start, target_days_end)
VALUES (
  'b0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000001',
  'Months 2–3: Independent Instruction & Module 2',
  'Full independent instruction. Complete Faculty Fundamentals Module 2 competencies and the 30-day Faculty Observation. Grading calibration and Blackboard optimization.',
  4, 29, 90
);

INSERT INTO onboarding_tasks (phase_id, title, description, task_type, resource_url, sort_order, is_required, estimated_minutes, requires_sign_off, sign_off_role) VALUES
('b0000000-0000-0000-0000-000000000004', '30-Day Faculty Observation', 'Formal classroom observation by Program Director. Objective: effectively deliver a lesson by actively engaging students. Must be completed and uploaded BEFORE proceeding to Module 3.', 'sign_off', NULL, 1, true, 60, true, 'program_director'),
('b0000000-0000-0000-0000-000000000004', 'FF Module 2: Blackboard Set-Up Competency', 'Faculty Fundamentals Module 2, Section 1 assessment. Configure and structure a Blackboard course shell for easy access to resources and support materials.', 'form', NULL, 2, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000004', 'FF Module 2: Collaboration Project Competency', 'Faculty Fundamentals Module 2, Section 2 assessment. Design learner-centered instruction that encourages peer-to-peer learning and promotes metacognition.', 'form', NULL, 3, true, 90, false, NULL),
('b0000000-0000-0000-0000-000000000004', 'FF Module 2: Student Support Competency', 'Faculty Fundamentals Module 2, Section 3 assessment. Identify students requiring assistance and develop an action plan addressing areas of concern.', 'form', NULL, 4, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000004', 'FF Module 2: Cultural Competence Competency', 'Faculty Fundamentals Module 2, Section 3 assessment. Incorporate cultural sensitivity into classroom management.', 'form', NULL, 5, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000004', 'Grading & Assessment Calibration', 'Calibration exercise with mentor using sample student work. Ensure grading is aligned with program standards and rubrics.', 'form', NULL, 6, true, 90, true, 'mentor'),
('b0000000-0000-0000-0000-000000000004', 'Lab Skills Demonstration', 'Demonstrate competency in program-specific lab skills to mentor.', 'sign_off', NULL, 7, true, 120, true, 'mentor'),
('b0000000-0000-0000-0000-000000000004', 'Submit Complete Course Calendars', 'Submit final course calendars for all assigned courses. Must meet PMI Policy 045.', 'form', NULL, 8, true, 60, true, 'admin'),
('b0000000-0000-0000-0000-000000000004', '30-Day Mentor Check-in', 'Comprehensive progress review with mentor. Discuss classroom management, student engagement, grading consistency.', 'sign_off', NULL, 9, true, 45, true, 'mentor'),
('b0000000-0000-0000-0000-000000000004', '60-Day Mentor Check-in', 'Follow-up progress review. Discuss growth since 30-day check-in, Module 2 completion status, and preparation for Module 3.', 'sign_off', NULL, 10, true, 45, true, 'mentor');


-- PHASE 5: Months 4-5
INSERT INTO onboarding_phases (id, template_id, name, description, sort_order, target_days_start, target_days_end)
VALUES (
  'b0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000001',
  'Months 4–5: Refinement & Module 3',
  'Refine instructional practice. Complete Faculty Fundamentals Module 3 focused on assessments, grading, and student communication.',
  5, 91, 150
);

INSERT INTO onboarding_tasks (phase_id, title, description, task_type, resource_url, sort_order, is_required, estimated_minutes, requires_sign_off, sign_off_role) VALUES
('b0000000-0000-0000-0000-000000000005', 'FF Module 3: Effective Feedback Competency', 'Faculty Fundamentals Module 3, Section 1 assessment. Provide meaningful and substantive feedback to students emphasizing clarity, specificity, and constructive guidance.', 'form', NULL, 1, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000005', 'FF Module 3: Grading Rubric Competency', 'Faculty Fundamentals Module 3, Section 1 assessment. Create grading rubrics that provide objectivity, consistency, and transparency in grading student work.', 'form', NULL, 2, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000005', 'FF Module 3: Student Communication Competency', 'Faculty Fundamentals Module 3, Section 1 assessment. Demonstrate understanding of best practices for documenting student communication.', 'form', NULL, 3, true, 45, false, NULL),
('b0000000-0000-0000-0000-000000000005', 'Student Communication Documentation Review', 'Review your student communication documentation practices with your mentor. Ensure proper logging in Portal.', 'document', NULL, 4, true, 30, true, 'mentor'),
('b0000000-0000-0000-0000-000000000005', 'Month 4 Mentor Check-in', 'Progress review. Discuss Module 3 completion, grading rubric effectiveness, and student feedback quality.', 'sign_off', NULL, 5, true, 30, true, 'mentor');


-- PHASE 6: Month 6
INSERT INTO onboarding_phases (id, template_id, name, description, sort_order, target_days_start, target_days_end)
VALUES (
  'b0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000001',
  'Month 6: Advanced Techniques & Completion',
  'Complete Faculty Fundamentals Module 4, grade analysis, self-reflection, and all final sign-offs. Transition to fully independent instructor status.',
  6, 151, 180
);

INSERT INTO onboarding_tasks (phase_id, title, description, task_type, resource_url, sort_order, is_required, estimated_minutes, requires_sign_off, sign_off_role) VALUES
('b0000000-0000-0000-0000-000000000006', 'FF Module 4: Advanced Instructional Technique Competency', 'Faculty Fundamentals Module 4, Section 1 assessment. Utilize best practices in instructional design to create an engaging educational experience.', 'form', NULL, 1, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000006', 'FF Module 4: Grade Analysis Competency', 'Faculty Fundamentals Module 4, Section 1 assessment. Analyze grade distributions, understand the meaning behind different grade values, and use data to improve instruction.', 'form', NULL, 2, true, 60, false, NULL),
('b0000000-0000-0000-0000-000000000006', 'Grade Analysis Review with Mentor', 'Review your grade analysis findings with your mentor. Discuss distributions, trends, and any adjustments needed.', 'form', NULL, 3, true, 45, true, 'mentor'),
('b0000000-0000-0000-0000-000000000006', 'FF Module 4: Self-Reflection', 'Faculty Fundamentals Module 4, Section 2 — End of Training Competency. Complete a comprehensive self-reflection encompassing personal teaching philosophies, strengths, areas for growth, and strategies for continuous improvement. Must be uploaded to be officially complete.', 'form', NULL, 4, true, 90, false, NULL),
('b0000000-0000-0000-0000-000000000006', 'Final Mentor Sign-Off', 'Mentor confirms all competencies met, reviews self-reflection, and provides final feedback on instructional growth.', 'sign_off', NULL, 5, true, 30, true, 'mentor'),
('b0000000-0000-0000-0000-000000000006', 'Program Director Final Review', 'Program Director reviews all deliverables: Faculty Fundamentals completion, observation records, course materials, and self-reflection. Confirms transition to fully independent instructor status.', 'sign_off', NULL, 6, true, 30, true, 'program_director');


-- =============================================
-- PART 6: UPDATE TASK LANES AND FLAGS
-- =============================================

-- Tag FF tasks as institutional lane
UPDATE onboarding_tasks SET lane = 'institutional'
WHERE title LIKE 'FF Module%'
   OR title LIKE 'Begin Faculty Fundamentals%'
   OR title = '30-Day Faculty Observation';

-- Tag mentor/observation tasks as mentorship lane
UPDATE onboarding_tasks SET lane = 'mentorship'
WHERE title LIKE '%Mentor Check-in%'
   OR title LIKE '%Mentor Sign-Off%'
   OR title LIKE '%Final Mentor%'
   OR title LIKE '%Program Director%'
   OR title LIKE '%Wrap-Up%Debrief%'
   OR title LIKE '%Shadow%'
   OR title LIKE '%Observation%'
   OR title LIKE 'Instruction with Faculty Assistance'
   OR title LIKE 'Faculty Observation of Your Teaching'
   OR title LIKE '%Best Practices Discussion%'
   OR title LIKE 'Meet Mentor%';

-- Mark tasks that require evidence
UPDATE onboarding_tasks SET requires_evidence = true
WHERE title IN (
  '30-Day Faculty Observation',
  'FF Module 4: Self-Reflection',
  'FF Module 1: Lesson Plan Competency',
  'FF Module 1: Course Schedule Competency',
  'FF Module 3: Grading Rubric Competency',
  'Create: Sample Course Calendar',
  'Create: Sample Lesson Plan',
  'Create: Sample Course Assignments'
);

-- Mark advanced tasks as not applicable to lab_only instructors
UPDATE onboarding_tasks SET applicable_types = '{full_time,part_time}'
WHERE title LIKE 'FF Module 3:%'
   OR title LIKE 'FF Module 4: Advanced Instructional Technique%'
   OR title LIKE 'FF Module 4: Self-Reflection'
   OR title = 'DE Training (if applicable)';


-- =============================================
-- PART 7: TASK DEPENDENCIES
-- =============================================

-- Gate 1: 30-Day Observation → unlocks Module 3 (HARD)
INSERT INTO onboarding_task_dependencies (task_id, depends_on_task_id, gate_type)
SELECT m3.id, obs.id, 'hard'
FROM onboarding_tasks m3, onboarding_tasks obs
WHERE m3.title LIKE 'FF Module 3:%'
  AND obs.title = '30-Day Faculty Observation'
ON CONFLICT DO NOTHING;

-- Gate 2: Self-Reflection → required before final sign-offs (HARD)
INSERT INTO onboarding_task_dependencies (task_id, depends_on_task_id, gate_type)
SELECT signoff.id, reflection.id, 'hard'
FROM onboarding_tasks signoff, onboarding_tasks reflection
WHERE signoff.title IN ('Final Mentor Sign-Off', 'Program Director Final Review')
  AND reflection.title = 'FF Module 4: Self-Reflection'
ON CONFLICT DO NOTHING;

-- Gate 3: Module 1 should be done before Module 2 (SOFT)
INSERT INTO onboarding_task_dependencies (task_id, depends_on_task_id, gate_type)
SELECT m2.id, m1_last.id, 'soft'
FROM onboarding_tasks m2, onboarding_tasks m1_last
WHERE m2.title LIKE 'FF Module 2:%'
  AND m1_last.title = 'FF Module 1: Teaching Aids (PPT) Competency'
ON CONFLICT DO NOTHING;


-- =============================================
-- DONE!
-- =============================================
