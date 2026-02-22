-- Performance indexes for frequently queried columns
-- Addresses slow queries identified in Supabase egress audit
-- Uses IF NOT EXISTS to be idempotent

-- ============================================================================
-- CRITICAL: lab_users.email (used in EVERY authenticated API route - 70+ calls)
-- Every request does: .from('lab_users').select('role').eq('email', ...)
-- No index existed, causing full table scan on every auth check
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lab_users_email ON lab_users(email);
CREATE INDEX IF NOT EXISTS idx_lab_users_email_lower ON lab_users(LOWER(email));

-- ============================================================================
-- HIGH PRIORITY: user_notifications (polled every 60 seconds per user)
-- Query: .eq('user_email', email).order('created_at', desc).eq('is_read', false)
-- Existing: individual indexes on user_email, is_read (partial), created_at, type
-- Missing: composite index covering the full query pattern
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_notifications_email_created
  ON user_notifications(user_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_email_read_created
  ON user_notifications(user_email, is_read, created_at DESC);

-- ============================================================================
-- lab_days (date, cohort_id) - Lab schedule queries
-- Query: .eq('cohort_id', id).gte('date', start).lte('date', end).order('date')
-- Existing: only semester and assigned_timer_id indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lab_days_date ON lab_days(date);
CREATE INDEX IF NOT EXISTS idx_lab_days_cohort_id ON lab_days(cohort_id);
CREATE INDEX IF NOT EXISTS idx_lab_days_date_cohort ON lab_days(date, cohort_id);

-- ============================================================================
-- lab_stations (lab_day_id) - Loaded with every lab day query
-- Query: .from('lab_stations').eq('lab_day_id', id)
-- No index existed, causing full table scan on joins
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lab_stations_lab_day_id ON lab_stations(lab_day_id);

-- ============================================================================
-- instructor_tasks (assigned_to, status, due_date) - Tasks page
-- Query: .eq('assigned_to', id).eq('status', s).order('due_date')
-- Existing: individual indexes on assigned_to, status, due_date
-- Missing: composite index for the common "my open tasks" query
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assignee_status_due
  ON instructor_tasks(assigned_to, status, due_date);

-- ============================================================================
-- students (cohort_id, status) - Student list queries
-- Query: .eq('cohort_id', id).eq('status', s).order('last_name')
-- No indexes existed on students table
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_cohort_id ON students(cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_cohort_status ON students(cohort_id, status);

-- ============================================================================
-- scenarios (is_active, category, difficulty) - Scenario list queries
-- Query: .eq('is_active', true).eq('category', c).eq('difficulty', d)
-- No indexes existed on scenarios for these columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_scenarios_active ON scenarios(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scenarios_category ON scenarios(category);
CREATE INDEX IF NOT EXISTS idx_scenarios_difficulty ON scenarios(difficulty);
CREATE INDEX IF NOT EXISTS idx_scenarios_active_category ON scenarios(is_active, category);

-- ============================================================================
-- audit_log (created_at, user_email) - Audit log queries
-- Query: .gte('created_at', date).ilike('user_email', pattern).order('created_at', desc)
-- Existing: individual indexes on user_email, created_at, action
-- Missing: composite for filtered date-range queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_created_user
  ON audit_log(created_at DESC, user_email);

-- ============================================================================
-- team_lead_log (student_id) - Loaded in student list for count aggregation
-- Query: .from('team_lead_log').select('student_id').in('student_id', ids)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_team_lead_log_student ON team_lead_log(student_id);

-- ============================================================================
-- submissions - Frequently queried for feedback and poll responses
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_submissions_poll_id ON submissions(poll_id);

-- ============================================================================
-- clinical_hours - Clinical tracking queries
-- Query: .eq('student_id', id).eq('cohort_id', id)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clinical_hours_student ON clinical_hours(student_id);
CREATE INDEX IF NOT EXISTS idx_clinical_hours_cohort ON clinical_hours(cohort_id);

-- ============================================================================
-- ANALYZE tables to update statistics for query planner
-- ============================================================================
ANALYZE lab_users;
ANALYZE user_notifications;
ANALYZE lab_days;
ANALYZE lab_stations;
ANALYZE instructor_tasks;
ANALYZE students;
ANALYZE scenarios;
ANALYZE audit_log;
ANALYZE team_lead_log;
ANALYZE clinical_hours;
