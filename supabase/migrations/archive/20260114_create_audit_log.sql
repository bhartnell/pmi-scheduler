-- FERPA Compliance Audit Log Table
-- Tracks access to protected educational records

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL, -- 'view', 'create', 'update', 'delete', 'export', 'login', 'logout', 'access_denied'
  resource_type TEXT NOT NULL, -- 'student', 'student_assessment', 'performance_note', etc.
  resource_id UUID,
  resource_description TEXT, -- Human-readable description
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB, -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Enable Row Level Security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only superadmins can view audit logs
-- Note: This assumes lab_users table and auth.uid() integration
-- If using service role key in API, RLS is bypassed and permissions checked in code
CREATE POLICY "Superadmins can view audit logs" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lab_users
      WHERE lab_users.id = auth.uid()
      AND lab_users.role = 'superadmin'
    )
  );

-- Policy: Allow inserts from authenticated users (for API routes using service key)
CREATE POLICY "Allow insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE audit_log IS 'FERPA compliance audit log tracking access to protected educational records';
COMMENT ON COLUMN audit_log.action IS 'Type of action: view, create, update, delete, export, login, logout, access_denied';
COMMENT ON COLUMN audit_log.resource_type IS 'Type of resource accessed: student, student_assessment, performance_note, learning_style, etc.';
