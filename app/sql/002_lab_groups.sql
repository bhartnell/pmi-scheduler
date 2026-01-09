-- Lab Groups Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- LAB GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lab_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Group A", "Team 1", etc.
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lab_groups_cohort ON lab_groups(cohort_id);

-- ============================================
-- LAB GROUP MEMBERS (Current Assignments)
-- ============================================
CREATE TABLE IF NOT EXISTS lab_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lab_group_id UUID NOT NULL REFERENCES lab_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by TEXT,  -- Email of person who made assignment
  
  -- Ensure student can only be in one group at a time
  UNIQUE(student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lab_group_members_group ON lab_group_members(lab_group_id);
CREATE INDEX IF NOT EXISTS idx_lab_group_members_student ON lab_group_members(student_id);

-- ============================================
-- LAB GROUP HISTORY (Change Log)
-- ============================================
CREATE TABLE IF NOT EXISTS lab_group_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_group_id UUID REFERENCES lab_groups(id) ON DELETE SET NULL,
  to_group_id UUID REFERENCES lab_groups(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by TEXT,  -- Email of person who made change
  reason TEXT  -- Optional reason for change
);

-- Index for student history lookups
CREATE INDEX IF NOT EXISTS idx_lab_group_history_student ON lab_group_history(student_id);
CREATE INDEX IF NOT EXISTS idx_lab_group_history_date ON lab_group_history(changed_at);

-- ============================================
-- UPDATE SCENARIO_ASSESSMENTS TABLE
-- Add lab_group_id for group grading
-- ============================================
ALTER TABLE scenario_assessments 
ADD COLUMN IF NOT EXISTS lab_group_id UUID REFERENCES lab_groups(id) ON DELETE SET NULL;

-- Index for group assessments
CREATE INDEX IF NOT EXISTS idx_scenario_assessments_group ON scenario_assessments(lab_group_id);

-- ============================================
-- HELPER VIEW: Current Group Assignments with Details
-- ============================================
CREATE OR REPLACE VIEW lab_group_roster AS
SELECT 
  lg.id as group_id,
  lg.name as group_name,
  lg.cohort_id,
  c.cohort_number,
  p.abbreviation as program,
  s.id as student_id,
  s.first_name,
  s.last_name,
  s.photo_url,
  lgm.assigned_at
FROM lab_groups lg
JOIN cohorts c ON lg.cohort_id = c.id
JOIN programs p ON c.program_id = p.id
LEFT JOIN lab_group_members lgm ON lg.id = lgm.lab_group_id
LEFT JOIN students s ON lgm.student_id = s.id
WHERE lg.is_active = true
ORDER BY lg.display_order, lg.name, s.last_name, s.first_name;

-- ============================================
-- HELPER VIEW: Ungrouped Students by Cohort
-- ============================================
CREATE OR REPLACE VIEW ungrouped_students AS
SELECT 
  s.id as student_id,
  s.first_name,
  s.last_name,
  s.photo_url,
  s.cohort_id,
  c.cohort_number,
  p.abbreviation as program
FROM students s
JOIN cohorts c ON s.cohort_id = c.id
JOIN programs p ON c.program_id = p.id
WHERE s.status = 'active'
  AND s.id NOT IN (SELECT student_id FROM lab_group_members)
ORDER BY s.last_name, s.first_name;

-- ============================================
-- FUNCTION: Move Student to Group (with history)
-- ============================================
CREATE OR REPLACE FUNCTION move_student_to_group(
  p_student_id UUID,
  p_new_group_id UUID,
  p_changed_by TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_group_id UUID;
BEGIN
  -- Get current group (if any)
  SELECT lab_group_id INTO v_old_group_id
  FROM lab_group_members
  WHERE student_id = p_student_id;
  
  -- Log the change
  INSERT INTO lab_group_history (student_id, from_group_id, to_group_id, changed_by, reason)
  VALUES (p_student_id, v_old_group_id, p_new_group_id, p_changed_by, p_reason);
  
  -- Remove from old group (if any)
  DELETE FROM lab_group_members WHERE student_id = p_student_id;
  
  -- Add to new group (if not null - null means unassign)
  IF p_new_group_id IS NOT NULL THEN
    INSERT INTO lab_group_members (lab_group_id, student_id, assigned_by)
    VALUES (p_new_group_id, p_student_id, p_changed_by);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE lab_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_group_history ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for authenticated users for now)
CREATE POLICY "Allow all for lab_groups" ON lab_groups FOR ALL USING (true);
CREATE POLICY "Allow all for lab_group_members" ON lab_group_members FOR ALL USING (true);
CREATE POLICY "Allow all for lab_group_history" ON lab_group_history FOR ALL USING (true);

-- ============================================
-- DONE!
-- ============================================
