-- Group enhancements: lock/unlock support and assignment history

-- Add lock fields to student_groups if they don't already exist
ALTER TABLE student_groups
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by_name TEXT;

-- Group assignment history table
CREATE TABLE IF NOT EXISTS group_assignment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('added', 'removed', 'moved')),
  from_group_id UUID,
  to_group_id UUID,
  changed_by UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_group_history_group ON group_assignment_history(group_id);
CREATE INDEX IF NOT EXISTS idx_group_history_student ON group_assignment_history(student_id);
CREATE INDEX IF NOT EXISTS idx_group_history_changed_at ON group_assignment_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_history_lab_day ON group_assignment_history(lab_day_id);

ALTER TABLE group_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read group history" ON group_assignment_history
  FOR SELECT USING (true);

CREATE POLICY "Manage group history" ON group_assignment_history
  FOR ALL USING (true);
