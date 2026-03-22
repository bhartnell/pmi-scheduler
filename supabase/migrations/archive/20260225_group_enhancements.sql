-- 3. Group Enhancements
ALTER TABLE lab_groups ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE lab_groups ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE lab_groups ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lab_group_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES lab_groups(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('added', 'removed', 'moved')),
  from_group_id UUID,
  to_group_id UUID,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_history_group ON lab_group_assignment_history(group_id);
CREATE INDEX IF NOT EXISTS idx_group_history_student ON lab_group_assignment_history(student_id);
