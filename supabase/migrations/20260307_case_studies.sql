-- Case Study Practice App — Full Schema
-- Task 81: Database tables, indexes, and RLS policies

-- 1. case_studies — Main case library
CREATE TABLE IF NOT EXISTS case_studies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  chief_complaint TEXT,
  category TEXT,
  subcategory TEXT,
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  applicable_programs TEXT[] DEFAULT '{"Paramedic"}',
  estimated_duration_minutes INTEGER DEFAULT 30,

  -- Patient info
  patient_age TEXT,
  patient_sex TEXT,
  patient_weight TEXT,
  patient_medical_history TEXT[],
  patient_medications TEXT[],
  patient_allergies TEXT,

  -- Structured data
  dispatch_info JSONB DEFAULT '{}',
  scene_info JSONB DEFAULT '{}',
  phases JSONB NOT NULL DEFAULT '[]',
  variables JSONB DEFAULT '{}',

  -- Educational
  learning_objectives TEXT[] DEFAULT '{}',
  critical_actions TEXT[] DEFAULT '{}',
  common_errors TEXT[] DEFAULT '{}',
  debrief_points TEXT[] DEFAULT '{}',
  equipment_needed TEXT[] DEFAULT '{}',

  -- Authorship
  author TEXT,
  created_by UUID REFERENCES lab_users(id),
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'program', 'community', 'official')),
  is_verified BOOLEAN DEFAULT false,
  flag_count INTEGER DEFAULT 0,
  community_rating NUMERIC(3,2) DEFAULT 0,
  usage_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,

  -- AI generation metadata
  generated_by_ai BOOLEAN DEFAULT false,
  generation_prompt TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. case_sessions — Classroom session tracking
CREATE TABLE IF NOT EXISTS case_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL UNIQUE,
  instructor_email TEXT NOT NULL,
  cohort_id UUID REFERENCES cohorts(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'completed', 'cancelled')),
  current_phase INTEGER DEFAULT 0,
  current_question INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{"show_leaderboard": true, "show_results_live": false, "anonymous": false, "time_limit": null, "allow_hints": true, "speed_bonus": false}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. case_responses — Student answers (both practice and session modes)
CREATE TABLE IF NOT EXISTS case_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES case_sessions(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  student_email TEXT,
  student_name TEXT,
  student_initials TEXT,
  phase_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  response JSONB,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  time_taken_seconds INTEGER,
  hints_used INTEGER DEFAULT 0,
  attempt_number INTEGER DEFAULT 1,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. case_practice_progress — Practice mode progress tracking
CREATE TABLE IF NOT EXISTS case_practice_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  variant_seed TEXT,
  current_phase INTEGER DEFAULT 0,
  current_question INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  max_points INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  responses JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, case_id, attempt_number)
);

-- 5. student_achievements — Badges and achievements
CREATE TABLE IF NOT EXISTS student_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 6. student_case_stats — Aggregated stats per student per cohort
CREATE TABLE IF NOT EXISTS student_case_stats (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  cases_completed INTEGER DEFAULT 0,
  cases_attempted INTEGER DEFAULT 0,
  total_points_earned INTEGER DEFAULT 0,
  total_points_possible INTEGER DEFAULT 0,
  average_score NUMERIC(5,2) DEFAULT 0,
  best_score NUMERIC(5,2) DEFAULT 0,
  badges_earned INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, cohort_id)
);

-- 7. case_assignments — Gradebook integration
CREATE TABLE IF NOT EXISTS case_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES lab_users(id),
  due_date TIMESTAMPTZ,
  min_score_threshold NUMERIC(5,2),
  grading_mode TEXT DEFAULT 'best_attempt' CHECK (grading_mode IN ('best_attempt', 'latest_attempt', 'average')),
  gradebook_category TEXT DEFAULT 'Case Studies',
  points_possible INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. case_flags — Content moderation
CREATE TABLE IF NOT EXISTS case_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES lab_users(id),
  reason TEXT NOT NULL CHECK (reason IN ('inaccurate', 'inappropriate', 'duplicate', 'outdated', 'other')),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES lab_users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. case_reviews — Review/approval records
CREATE TABLE IF NOT EXISTS case_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  reviewed_by UUID NOT NULL REFERENCES lab_users(id),
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'revision_needed')),
  notes TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. case_analytics — Per-question analytics
CREATE TABLE IF NOT EXISTS case_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  phase_id TEXT,
  total_attempts INTEGER DEFAULT 0,
  correct_attempts INTEGER DEFAULT 0,
  avg_time_seconds NUMERIC(8,2) DEFAULT 0,
  answer_distribution JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(case_id, question_id)
);

-- ============ INDEXES ============

-- case_studies
CREATE INDEX IF NOT EXISTS idx_case_studies_category ON case_studies(category);
CREATE INDEX IF NOT EXISTS idx_case_studies_difficulty ON case_studies(difficulty);
CREATE INDEX IF NOT EXISTS idx_case_studies_visibility ON case_studies(visibility);
CREATE INDEX IF NOT EXISTS idx_case_studies_is_active ON case_studies(is_active);
CREATE INDEX IF NOT EXISTS idx_case_studies_created_by ON case_studies(created_by);
CREATE INDEX IF NOT EXISTS idx_case_studies_published ON case_studies(is_published, is_active);

-- case_sessions
CREATE INDEX IF NOT EXISTS idx_case_sessions_case_id ON case_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_case_sessions_status ON case_sessions(status);

-- case_responses
CREATE INDEX IF NOT EXISTS idx_case_responses_session_id ON case_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_case_responses_student_id ON case_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_case_responses_case_id ON case_responses(case_id);
CREATE INDEX IF NOT EXISTS idx_case_responses_case_student ON case_responses(case_id, student_id);

-- case_practice_progress
CREATE INDEX IF NOT EXISTS idx_case_practice_student ON case_practice_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_case_practice_case ON case_practice_progress(case_id);
CREATE INDEX IF NOT EXISTS idx_case_practice_status ON case_practice_progress(status);

-- student_achievements
CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_id);

-- case_assignments
CREATE INDEX IF NOT EXISTS idx_case_assignments_cohort ON case_assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_case ON case_assignments(case_id);

-- case_analytics
CREATE INDEX IF NOT EXISTS idx_case_analytics_case ON case_analytics(case_id);

-- ============ RLS POLICIES ============

-- case_studies
ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read published cases" ON case_studies FOR SELECT USING (
  is_active = true AND (is_published = true OR visibility IN ('official', 'community'))
);
CREATE POLICY "Service role full access to case_studies" ON case_studies FOR ALL USING (true);

-- case_sessions
ALTER TABLE case_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to case_sessions" ON case_sessions FOR ALL USING (true);

-- case_responses
ALTER TABLE case_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to case_responses" ON case_responses FOR ALL USING (true);

-- case_practice_progress
ALTER TABLE case_practice_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to case_practice_progress" ON case_practice_progress FOR ALL USING (true);

-- student_achievements
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to student_achievements" ON student_achievements FOR ALL USING (true);

-- student_case_stats
ALTER TABLE student_case_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to student_case_stats" ON student_case_stats FOR ALL USING (true);

-- case_assignments
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to case_assignments" ON case_assignments FOR ALL USING (true);

-- case_flags
ALTER TABLE case_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to case_flags" ON case_flags FOR ALL USING (true);

-- case_reviews
ALTER TABLE case_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to case_reviews" ON case_reviews FOR ALL USING (true);

-- case_analytics
ALTER TABLE case_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to case_analytics" ON case_analytics FOR ALL USING (true);
