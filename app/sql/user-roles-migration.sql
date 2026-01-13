-- User Roles and Deletion Requests Migration
-- Run this SQL in Supabase SQL Editor

-- Update lab_users table with role columns
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'pending';
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Create deletion requests table
CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  record_title TEXT,
  requested_by UUID REFERENCES lab_users(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES lab_users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on deletion_requests
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for deletion_requests" ON deletion_requests FOR ALL USING (true) WITH CHECK (true);

-- Seed initial admins
INSERT INTO lab_users (name, email, role, is_active, approved_at)
VALUES
  ('Benjamin Hartnell', 'bhartnell@pmi.edu', 'admin', true, NOW()),
  ('Rae Niedfeldt', 'rniedfeldt@pmi.edu', 'admin', true, NOW()),
  ('Josh Lomonaco', 'jlomonaco@pmi.edu', 'admin', true, NOW())
ON CONFLICT (email) DO UPDATE SET role = 'admin', approved_at = NOW(), is_active = true;
