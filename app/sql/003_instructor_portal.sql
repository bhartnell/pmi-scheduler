-- Instructor Portal Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- CE REQUIREMENTS TABLE (Reference data)
-- ============================================
CREATE TABLE IF NOT EXISTS ce_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_type TEXT NOT NULL,           -- e.g., 'ems_instructor', 'acls_instructor'
  display_name TEXT NOT NULL,        -- e.g., 'EMS Instructor (PMI)'
  issuing_body TEXT NOT NULL,        -- e.g., 'Pima Medical Institute'
  cycle_years INTEGER DEFAULT 2,     -- Recertification cycle length
  total_hours_required INTEGER DEFAULT 0,
  category_requirements JSONB,       -- e.g., {"professional": 2, "instructional": 6}
  notes TEXT,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed PMI instructor requirements
INSERT INTO ce_requirements (cert_type, display_name, issuing_body, cycle_years, total_hours_required, category_requirements, notes)
VALUES
  ('pmi_ems_instructor', 'EMS Instructor (PMI)', 'Pima Medical Institute', 2, 8,
   '{"professional": 2, "instructional": 6}',
   '2 professional development + 6 instructional units per 2-year cycle')
ON CONFLICT DO NOTHING;

-- ============================================
-- INSTRUCTOR CERTIFICATIONS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS instructor_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  cert_name TEXT NOT NULL,
  cert_number TEXT,
  issuing_body TEXT,
  issue_date DATE,
  expiration_date DATE NOT NULL,
  card_image_url TEXT,
  ce_requirement_id UUID REFERENCES ce_requirements(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_instructor_certs_instructor ON instructor_certifications(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_certs_expiration ON instructor_certifications(expiration_date);

-- ============================================
-- CE RECORDS TABLE (Track individual CE activities)
-- ============================================
CREATE TABLE IF NOT EXISTS ce_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  certification_id UUID REFERENCES instructor_certifications(id) ON DELETE SET NULL,
  title TEXT NOT NULL,               -- Course/activity name
  provider TEXT,                     -- Who provided the CE
  hours DECIMAL(5,2) NOT NULL,       -- CE hours earned
  category TEXT,                     -- e.g., 'professional', 'instructional', 'clinical'
  completion_date DATE NOT NULL,
  certificate_image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ce_records_instructor ON ce_records(instructor_id);
CREATE INDEX IF NOT EXISTS idx_ce_records_certification ON ce_records(certification_id);
CREATE INDEX IF NOT EXISTS idx_ce_records_date ON ce_records(completion_date);

-- ============================================
-- TEACHING LOG TABLE (Track teaching activities)
-- ============================================
CREATE TABLE IF NOT EXISTS teaching_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  certification_id UUID REFERENCES instructor_certifications(id) ON DELETE SET NULL,
  course_name TEXT NOT NULL,
  course_type TEXT,                  -- e.g., 'EMT', 'Paramedic', 'ACLS'
  date_taught DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  location TEXT,
  student_count INTEGER,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teaching_log_instructor ON teaching_log(instructor_id);
CREATE INDEX IF NOT EXISTS idx_teaching_log_date ON teaching_log(date_taught);
CREATE INDEX IF NOT EXISTS idx_teaching_log_cohort ON teaching_log(cohort_id);

-- ============================================
-- CERT NOTIFICATIONS TABLE (Track sent notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS cert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id UUID NOT NULL REFERENCES instructor_certifications(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,   -- e.g., '90_day', '30_day', 'expired_week_1'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate notifications
  UNIQUE(certification_id, notification_type)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_cert_notifications_cert ON cert_notifications(certification_id);

-- ============================================
-- SYSTEM SETTINGS TABLE (For cron tracking, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize last cron run
INSERT INTO system_settings (key, value)
VALUES ('last_cron_run', NOW()::TEXT)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- INSTRUCTOR DASHBOARD VIEW
-- Summary stats for each instructor
-- ============================================
CREATE OR REPLACE VIEW instructor_dashboard_stats AS
SELECT
  u.id as instructor_id,
  u.name as instructor_name,
  u.email,
  u.role,
  -- Certification stats
  COUNT(DISTINCT ic.id) as total_certs,
  COUNT(DISTINCT CASE WHEN ic.expiration_date < CURRENT_DATE THEN ic.id END) as expired_certs,
  COUNT(DISTINCT CASE WHEN ic.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN ic.id END) as expiring_soon,
  MIN(ic.expiration_date) FILTER (WHERE ic.expiration_date >= CURRENT_DATE) as next_expiration,
  -- CE stats (current year)
  COALESCE(SUM(ce.hours) FILTER (WHERE ce.completion_date >= DATE_TRUNC('year', CURRENT_DATE)), 0) as ce_hours_this_year,
  -- Teaching stats (current year)
  COUNT(DISTINCT tl.id) FILTER (WHERE tl.date_taught >= DATE_TRUNC('year', CURRENT_DATE)) as classes_this_year,
  COALESCE(SUM(tl.hours) FILTER (WHERE tl.date_taught >= DATE_TRUNC('year', CURRENT_DATE)), 0) as teaching_hours_this_year
FROM lab_users u
LEFT JOIN instructor_certifications ic ON u.id = ic.instructor_id
LEFT JOIN ce_records ce ON u.id = ce.instructor_id
LEFT JOIN teaching_log tl ON u.id = tl.instructor_id
WHERE u.role IN ('instructor', 'admin', 'lead_instructor')
  AND u.is_active = true
GROUP BY u.id, u.name, u.email, u.role;

-- ============================================
-- UPCOMING LABS VIEW
-- Labs an instructor is assigned to
-- ============================================
CREATE OR REPLACE VIEW instructor_upcoming_labs AS
SELECT
  ls.instructor_id,
  ls.additional_instructor_id,
  ld.id as lab_day_id,
  ld.date as lab_date,
  ld.week_number,
  ld.day_number,
  ls.id as station_id,
  ls.station_number,
  ls.station_type,
  ls.custom_title,
  s.title as scenario_title,
  c.cohort_number,
  p.abbreviation as program
FROM lab_stations ls
JOIN lab_days ld ON ls.lab_day_id = ld.id
JOIN cohorts c ON ld.cohort_id = c.id
JOIN programs p ON c.program_id = p.id
LEFT JOIN scenarios s ON ls.scenario_id = s.id
WHERE ld.date >= CURRENT_DATE
  AND (ls.instructor_id IS NOT NULL OR ls.additional_instructor_id IS NOT NULL)
ORDER BY ld.date, ls.station_number;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE ce_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ce_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now - can be restricted later)
CREATE POLICY "Allow all for ce_requirements" ON ce_requirements FOR ALL USING (true);
CREATE POLICY "Allow all for instructor_certifications" ON instructor_certifications FOR ALL USING (true);
CREATE POLICY "Allow all for ce_records" ON ce_records FOR ALL USING (true);
CREATE POLICY "Allow all for teaching_log" ON teaching_log FOR ALL USING (true);
CREATE POLICY "Allow all for cert_notifications" ON cert_notifications FOR ALL USING (true);
CREATE POLICY "Allow all for system_settings" ON system_settings FOR ALL USING (true);

-- ============================================
-- DONE!
-- ============================================
