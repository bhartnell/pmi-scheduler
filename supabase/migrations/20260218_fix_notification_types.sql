-- Fix user_notifications type CHECK constraint to include all notification types
-- The original migration only included a subset of types

-- Drop the old constraint
ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;

-- Add the updated constraint with all notification types
ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_type_check
CHECK (type IN (
  'lab_assignment',
  'lab_reminder',
  'feedback_new',
  'feedback_resolved',
  'task_assigned',
  'task_completed',
  'task_comment',
  'role_approved',
  'shift_available',
  'shift_confirmed',
  'clinical_hours',
  'compliance_due',
  'general'
));
