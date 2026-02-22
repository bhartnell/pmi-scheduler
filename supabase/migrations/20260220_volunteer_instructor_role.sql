-- Add volunteer_instructor role to the system
-- Created: 2026-02-20
-- Purpose: Add volunteer/guest instructor role with limited access

-- ============================================
-- Update lab_users role constraint
-- ============================================
-- Add volunteer_instructor to the allowed role values
-- Note: This assumes the constraint exists. If it doesn't, this will create it.

-- Drop the old constraint if it exists
ALTER TABLE lab_users DROP CONSTRAINT IF EXISTS lab_users_role_check;

-- Add new constraint with volunteer_instructor included
ALTER TABLE lab_users ADD CONSTRAINT lab_users_role_check
  CHECK (role IN (
    'superadmin',
    'admin',
    'lead_instructor',
    'instructor',
    'volunteer_instructor',
    'student',
    'guest',
    'pending'
  ));

-- Add comment explaining the role
COMMENT ON COLUMN lab_users.role IS 'User role: superadmin, admin, lead_instructor, instructor, volunteer_instructor (limited access), student, guest, or pending';

-- ============================================
-- No data migration needed
-- ============================================
-- volunteer_instructor is a new role, so no existing users need to be migrated
