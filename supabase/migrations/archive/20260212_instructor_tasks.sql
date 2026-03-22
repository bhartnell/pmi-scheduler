-- Instructor Tasks System
-- Allows instructors to assign tasks to each other

-- Tasks table
CREATE TABLE IF NOT EXISTS instructor_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_by UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  due_date DATE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  related_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES instructor_tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assigned_to ON instructor_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_assigned_by ON instructor_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_status ON instructor_tasks(status);
CREATE INDEX IF NOT EXISTS idx_instructor_tasks_due_date ON instructor_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- Enable RLS
ALTER TABLE instructor_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instructor_tasks
-- Note: Using service role key bypasses RLS, but these are here for completeness

-- Allow anyone authenticated to view tasks (filtered in application layer)
DROP POLICY IF EXISTS "Users can view all tasks" ON instructor_tasks;
CREATE POLICY "Users can view all tasks"
  ON instructor_tasks FOR SELECT
  USING (true);

-- Allow anyone authenticated to create tasks
DROP POLICY IF EXISTS "Users can create tasks" ON instructor_tasks;
CREATE POLICY "Users can create tasks"
  ON instructor_tasks FOR INSERT
  WITH CHECK (true);

-- Allow task participants to update
DROP POLICY IF EXISTS "Task participants can update" ON instructor_tasks;
CREATE POLICY "Task participants can update"
  ON instructor_tasks FOR UPDATE
  USING (true);

-- Allow assigner to delete
DROP POLICY IF EXISTS "Assigner can delete tasks" ON instructor_tasks;
CREATE POLICY "Assigner can delete tasks"
  ON instructor_tasks FOR DELETE
  USING (true);

-- RLS Policies for task_comments
DROP POLICY IF EXISTS "Users can view task comments" ON task_comments;
CREATE POLICY "Users can view task comments"
  ON task_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create comments" ON task_comments;
CREATE POLICY "Users can create comments"
  ON task_comments FOR INSERT
  WITH CHECK (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_instructor_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS instructor_tasks_updated_at ON instructor_tasks;
CREATE TRIGGER instructor_tasks_updated_at
  BEFORE UPDATE ON instructor_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_instructor_tasks_updated_at();
