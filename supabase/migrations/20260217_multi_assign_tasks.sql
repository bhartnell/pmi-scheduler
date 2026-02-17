-- Multi-Assign Tasks
-- Allows assigning tasks to multiple people with two modes:
-- 'any' = anyone can complete (shared task)
-- 'all' = each person must complete individually

-- Add completion_mode to instructor_tasks
ALTER TABLE instructor_tasks
ADD COLUMN IF NOT EXISTS completion_mode TEXT DEFAULT 'single'
  CHECK (completion_mode IN ('single', 'any', 'all'));

-- Task assignees junction table for multi-assign
CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES instructor_tasks(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, assignee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_assignee_id ON task_assignees(assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_status ON task_assignees(status);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view task assignees" ON task_assignees;
CREATE POLICY "Users can view task assignees"
  ON task_assignees FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create task assignees" ON task_assignees;
CREATE POLICY "Users can create task assignees"
  ON task_assignees FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update task assignees" ON task_assignees;
CREATE POLICY "Users can update task assignees"
  ON task_assignees FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Users can delete task assignees" ON task_assignees;
CREATE POLICY "Users can delete task assignees"
  ON task_assignees FOR DELETE
  USING (true);

-- Migrate existing tasks to use task_assignees
-- This copies the assigned_to into task_assignees for existing tasks
INSERT INTO task_assignees (task_id, assignee_id, status, completed_at, completion_notes)
SELECT
  id,
  assigned_to,
  status,
  completed_at,
  completion_notes
FROM instructor_tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, assignee_id) DO NOTHING;

-- Function to check if task is completed based on completion_mode
CREATE OR REPLACE FUNCTION update_task_status_from_assignees()
RETURNS TRIGGER AS $$
DECLARE
  task_mode TEXT;
  all_completed BOOLEAN;
  any_completed BOOLEAN;
BEGIN
  -- Get the completion mode
  SELECT completion_mode INTO task_mode
  FROM instructor_tasks
  WHERE id = NEW.task_id;

  -- For 'any' mode: task is completed when anyone completes
  IF task_mode = 'any' THEN
    SELECT EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_id = NEW.task_id AND status = 'completed'
    ) INTO any_completed;

    IF any_completed THEN
      UPDATE instructor_tasks
      SET status = 'completed', completed_at = NOW()
      WHERE id = NEW.task_id AND status != 'completed';
    END IF;

  -- For 'all' mode: task is completed when all assignees complete
  ELSIF task_mode = 'all' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_id = NEW.task_id AND status NOT IN ('completed', 'cancelled')
    ) INTO all_completed;

    IF all_completed THEN
      UPDATE instructor_tasks
      SET status = 'completed', completed_at = NOW()
      WHERE id = NEW.task_id AND status != 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update task status when assignee status changes
DROP TRIGGER IF EXISTS task_assignees_status_update ON task_assignees;
CREATE TRIGGER task_assignees_status_update
  AFTER UPDATE OF status ON task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION update_task_status_from_assignees();
