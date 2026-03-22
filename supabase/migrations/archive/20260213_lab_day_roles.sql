-- Lab Day Roles: Lab Lead, Roamer, Observer
-- These are special assignments that don't rotate with stations

CREATE TABLE IF NOT EXISTS lab_day_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES lab_users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('lab_lead', 'roamer', 'observer')) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lab_day_id, instructor_id, role)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_lab_day_roles_lab ON lab_day_roles(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_roles_instructor ON lab_day_roles(instructor_id);

-- Enable RLS
ALTER TABLE lab_day_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all roles
CREATE POLICY "lab_day_roles_select_policy" ON lab_day_roles
  FOR SELECT USING (true);

-- Policy: Instructors with lab management access can insert/update/delete
CREATE POLICY "lab_day_roles_insert_policy" ON lab_day_roles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "lab_day_roles_update_policy" ON lab_day_roles
  FOR UPDATE USING (true);

CREATE POLICY "lab_day_roles_delete_policy" ON lab_day_roles
  FOR DELETE USING (true);
