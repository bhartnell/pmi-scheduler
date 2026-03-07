-- mCE Clearance Tracker: replaces per-module tracking with clearance-focused tracking
-- Each student gets one clearance record tracking overall mCE completion

CREATE TABLE IF NOT EXISTS student_mce_clearance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mce_provider TEXT DEFAULT 'Platinum Planner',
  modules_required INTEGER DEFAULT 0,
  modules_completed INTEGER DEFAULT 0,
  clearance_status TEXT DEFAULT 'not_started' CHECK (clearance_status IN ('not_started', 'in_progress', 'submitted', 'cleared')),
  clearance_date TIMESTAMPTZ,
  cleared_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id)
);

ALTER TABLE student_mce_clearance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mce clearance"
  ON student_mce_clearance FOR SELECT USING (true);

CREATE POLICY "Service role can manage mce clearance"
  ON student_mce_clearance FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_mce_clearance_student ON student_mce_clearance(student_id);
CREATE INDEX IF NOT EXISTS idx_mce_clearance_status ON student_mce_clearance(clearance_status);
