-- Role System Update Migration
-- Run this SQL in Supabase SQL Editor

-- Update deletion_requests table structure to match new API
ALTER TABLE deletion_requests RENAME COLUMN table_name TO item_type;
ALTER TABLE deletion_requests RENAME COLUMN record_id TO item_id;
ALTER TABLE deletion_requests RENAME COLUMN record_title TO item_name;

-- Change item_id to TEXT to support various ID formats
ALTER TABLE deletion_requests ALTER COLUMN item_id TYPE TEXT;

-- Create guest_access table
CREATE TABLE IF NOT EXISTS guest_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  access_code TEXT UNIQUE,
  lab_day_id UUID REFERENCES lab_days(id),
  assigned_role TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on guest_access
ALTER TABLE guest_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for guest_access" ON guest_access FOR ALL USING (true) WITH CHECK (true);

-- Update superadmin accounts
UPDATE lab_users
SET role = 'superadmin'
WHERE email IN ('bhartnell@pmi.edu', 'jlomonaco@pmi.edu');

-- Update existing admins to admin role (not superadmin)
UPDATE lab_users
SET role = 'admin'
WHERE role = 'admin'
AND email NOT IN ('bhartnell@pmi.edu', 'jlomonaco@pmi.edu');

-- Create index on guest_access for faster lookups
CREATE INDEX IF NOT EXISTS idx_guest_access_code ON guest_access(access_code);
CREATE INDEX IF NOT EXISTS idx_guest_access_name ON guest_access(name);
CREATE INDEX IF NOT EXISTS idx_guest_access_lab_day ON guest_access(lab_day_id);
