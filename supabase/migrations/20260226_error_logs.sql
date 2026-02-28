-- Error Logs Table
-- Stores client-side errors caught by ErrorBoundary components.
-- Written by the /api/errors/log endpoint using the service role key.

CREATE TABLE IF NOT EXISTS error_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES lab_users(id) ON DELETE SET NULL,
  error_message TEXT        NOT NULL,
  error_stack   TEXT,
  component_name TEXT,
  page_url      TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_error_logs_created  ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user     ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_component ON error_logs(component_name);

-- Row Level Security
-- All writes are done via the service role key (API route), so only
-- admins need SELECT access through the anon/authenticated role.
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Admins and superadmins can read all error logs
CREATE POLICY "error_logs_admin_read" ON error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lab_users
      WHERE lab_users.email = (
        SELECT email FROM auth.users WHERE auth.users.id = auth.uid()
      )
      AND lab_users.role IN ('superadmin', 'admin')
    )
  );

-- No direct INSERT/UPDATE/DELETE via RLS - all mutations go through
-- the service role key in the API route.
