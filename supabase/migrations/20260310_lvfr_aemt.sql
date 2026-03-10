-- Migration: LVFR AEMT Module — Database Schema + Role Updates
-- Created: 2026-03-10
-- Purpose: Create all LVFR AEMT-specific tables, add agency_liaison/agency_observer
--          roles, and add agency_affiliation/agency_scope columns to lab_users.
--          Foundation for Tasks 104-107.

-- ============================================
-- Part A: Role & lab_users changes
-- ============================================

-- 1. Update role CHECK constraint to include new agency roles
ALTER TABLE lab_users DROP CONSTRAINT IF EXISTS lab_users_role_check;
ALTER TABLE lab_users ADD CONSTRAINT lab_users_role_check CHECK (
  role IN (
    'superadmin',
    'admin',
    'lead_instructor',
    'agency_liaison',
    'instructor',
    'program_director',
    'volunteer_instructor',
    'agency_observer',
    'student',
    'guest',
    'pending'
  )
);

COMMENT ON COLUMN lab_users.role IS 'User role: superadmin, admin, lead_instructor, agency_liaison, instructor, program_director, volunteer_instructor, agency_observer, student, guest, or pending';

-- 2. Add agency columns to lab_users
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS agency_affiliation TEXT;
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS agency_scope TEXT[] DEFAULT '{}';

COMMENT ON COLUMN lab_users.agency_affiliation IS 'Agency name (e.g., LVFR, AMR) for agency_liaison/agency_observer roles';
COMMENT ON COLUMN lab_users.agency_scope IS 'Program scopes this user can access (e.g., {lvfr_aemt})';

-- ============================================
-- Part B: LVFR AEMT Tables
-- ============================================

-- 1. Course structure: Modules
CREATE TABLE IF NOT EXISTS lvfr_aemt_modules (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  chapters TEXT[],
  exam_day INTEGER,
  week_range TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Course structure: Course Days
CREATE TABLE IF NOT EXISTS lvfr_aemt_course_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  module_id TEXT REFERENCES lvfr_aemt_modules(id),
  day_type TEXT NOT NULL CHECK (day_type IN (
    'new_content', 'lab_day', 'lab_review', 'exam_and_content',
    'content_and_exam', 'final_exam', 'supplementary'
  )),
  title TEXT,
  chapters_covered TEXT[],
  has_lab BOOLEAN DEFAULT false,
  lab_name TEXT,
  has_exam BOOLEAN DEFAULT false,
  exam_name TEXT,
  exam_module TEXT,
  has_quiz BOOLEAN DEFAULT false,
  quiz_chapters TEXT[],
  time_blocks JSONB,
  reinforcement_activities JSONB,
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'completed', 'modified', 'cancelled'
  )),
  completion_notes TEXT,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Course structure: Chapters
CREATE TABLE IF NOT EXISTS lvfr_aemt_chapters (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  module_id TEXT REFERENCES lvfr_aemt_modules(id),
  teaching_day JSONB,
  estimated_lecture_min INTEGER DEFAULT 0,
  estimated_lab_min INTEGER DEFAULT 0,
  key_topics TEXT[],
  note TEXT,
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'completed'
  )),
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Supplementary Days (Monday sessions, etc.)
CREATE TABLE IF NOT EXISTS lvfr_aemt_supplementary_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER UNIQUE,
  date DATE NOT NULL,
  day_of_week TEXT,
  week_number INTEGER,
  title TEXT,
  description TEXT,
  time_start TEXT,
  time_end TEXT,
  type TEXT DEFAULT 'supplementary' CHECK (type IN (
    'supplementary', 'ride_along', 'testing', 'graduation'
  )),
  instructor TEXT,
  instructor_id UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Medications
CREATE TABLE IF NOT EXISTS lvfr_aemt_medications (
  id TEXT PRIMARY KEY,
  generic_name TEXT NOT NULL,
  brand_names TEXT[],
  drug_class TEXT,
  mechanism_of_action TEXT,
  indications TEXT[],
  contraindications TEXT[],
  dose_adult TEXT,
  dose_pediatric TEXT,
  route TEXT[],
  onset TEXT,
  duration TEXT,
  side_effects TEXT[],
  special_considerations TEXT,
  snhd_formulary BOOLEAN DEFAULT false,
  checkpoint_blanks TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Pharmacology Checkpoints (student results)
CREATE TABLE IF NOT EXISTS lvfr_aemt_pharm_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  practitioner_email TEXT,
  checkpoint_date DATE,
  difficulty_level INTEGER CHECK (difficulty_level IN (1, 2, 3)),
  medications_tested TEXT[],
  responses JSONB,
  score_percent DECIMAL,
  passed BOOLEAN,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Skills
CREATE TABLE IF NOT EXISTS lvfr_aemt_skills (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  nremt_tested BOOLEAN DEFAULT false,
  introduced_day INTEGER,
  practice_days INTEGER[],
  evaluation_day INTEGER,
  min_practice_attempts INTEGER DEFAULT 1,
  equipment_needed TEXT[],
  safety_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Skill Attempts (individual practice/eval records)
CREATE TABLE IF NOT EXISTS lvfr_aemt_skill_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  skill_id TEXT REFERENCES lvfr_aemt_skills(id),
  attempt_number INTEGER DEFAULT 1,
  date DATE,
  evaluator_id UUID REFERENCES lab_users(id),
  result TEXT CHECK (result IN ('pass', 'fail')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Skill Status (per-student per-skill aggregate)
CREATE TABLE IF NOT EXISTS lvfr_aemt_skill_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  skill_id TEXT REFERENCES lvfr_aemt_skills(id),
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'satisfactory', 'needs_remediation', 'failed'
  )),
  total_attempts INTEGER DEFAULT 0,
  last_attempt_date DATE,
  completed_date DATE,
  UNIQUE(student_id, skill_id)
);

-- 10. Assessments (quiz/exam definitions)
CREATE TABLE IF NOT EXISTS lvfr_aemt_assessments (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  day_number INTEGER,
  date DATE,
  title TEXT NOT NULL,
  question_count INTEGER,
  chapters TEXT[],
  pass_score INTEGER DEFAULT 80,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Grades (student assessment results)
CREATE TABLE IF NOT EXISTS lvfr_aemt_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  assessment_id TEXT REFERENCES lvfr_aemt_assessments(id),
  date_taken DATE,
  score_percent DECIMAL,
  passed BOOLEAN,
  questions_correct INTEGER,
  questions_total INTEGER,
  source TEXT DEFAULT 'manual' CHECK (source IN (
    'emstesting_import', 'manual', 'webapp'
  )),
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, assessment_id)
);

-- 12. Shift Patterns (instructor availability patterns)
CREATE TABLE IF NOT EXISTS lvfr_aemt_shift_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID REFERENCES lab_users(id),
  pattern_type TEXT CHECK (pattern_type IN (
    '48_96', 'weekly', 'custom', 'conditional'
  )),
  pattern_config JSONB,
  effective_start DATE,
  effective_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Instructor Availability (per-date per-instructor)
CREATE TABLE IF NOT EXISTS lvfr_aemt_instructor_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID REFERENCES lab_users(id),
  date DATE NOT NULL,
  am1_available BOOLEAN DEFAULT false,
  mid_available BOOLEAN DEFAULT false,
  pm1_available BOOLEAN DEFAULT false,
  pm2_available BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'available' CHECK (status IN (
    'available', 'partial', 'conflict', 'on_shift', 'coming_off'
  )),
  notes TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN (
    'shift_calc', 'manual_override', 'imported'
  )),
  UNIQUE(instructor_id, date)
);

-- 14. Instructor Assignments (per-day)
CREATE TABLE IF NOT EXISTS lvfr_aemt_instructor_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE,
  date DATE NOT NULL,
  primary_instructor_id UUID REFERENCES lab_users(id),
  secondary_instructor_id UUID REFERENCES lab_users(id),
  additional_instructors UUID[],
  min_instructors INTEGER DEFAULT 1,
  notes TEXT
);

-- 15. File Sharing
CREATE TABLE IF NOT EXISTS lvfr_aemt_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  module_id TEXT,
  chapter_id TEXT,
  day_number INTEGER,
  uploaded_by UUID REFERENCES lab_users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  visible_to_students BOOLEAN DEFAULT true
);

-- ============================================
-- Part C: Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE lvfr_aemt_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_course_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_supplementary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_pharm_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_skill_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_skill_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_shift_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_instructor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_instructor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_aemt_files ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (standard Supabase pattern for API routes)
DO $$ BEGIN
  -- Reference/config tables: service_role full access
  CREATE POLICY service_role_lvfr_modules ON lvfr_aemt_modules FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_course_days ON lvfr_aemt_course_days FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_chapters ON lvfr_aemt_chapters FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_supplementary ON lvfr_aemt_supplementary_days FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_medications ON lvfr_aemt_medications FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_pharm_ck ON lvfr_aemt_pharm_checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_skills ON lvfr_aemt_skills FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_skill_att ON lvfr_aemt_skill_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_skill_status ON lvfr_aemt_skill_status FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_assessments ON lvfr_aemt_assessments FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_grades ON lvfr_aemt_grades FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_shift ON lvfr_aemt_shift_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_avail ON lvfr_aemt_instructor_availability FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_assign ON lvfr_aemt_instructor_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_lvfr_files ON lvfr_aemt_files FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Part D: Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_lvfr_course_days_module ON lvfr_aemt_course_days(module_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_course_days_date ON lvfr_aemt_course_days(date);
CREATE INDEX IF NOT EXISTS idx_lvfr_chapters_module ON lvfr_aemt_chapters(module_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_pharm_ck_student ON lvfr_aemt_pharm_checkpoints(student_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_att_student ON lvfr_aemt_skill_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_att_skill ON lvfr_aemt_skill_attempts(skill_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_status_student ON lvfr_aemt_skill_status(student_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_skill_status_skill ON lvfr_aemt_skill_status(skill_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_grades_student ON lvfr_aemt_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_grades_assessment ON lvfr_aemt_grades(assessment_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_avail_instructor ON lvfr_aemt_instructor_availability(instructor_id);
CREATE INDEX IF NOT EXISTS idx_lvfr_avail_date ON lvfr_aemt_instructor_availability(date);
CREATE INDEX IF NOT EXISTS idx_lvfr_assignments_date ON lvfr_aemt_instructor_assignments(date);
CREATE INDEX IF NOT EXISTS idx_lvfr_files_module ON lvfr_aemt_files(module_id);
CREATE INDEX IF NOT EXISTS idx_lab_users_agency ON lab_users(agency_affiliation) WHERE agency_affiliation IS NOT NULL;
