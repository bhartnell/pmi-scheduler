-- Migration: Fix ryyoung role + ensure lab_day_equipment columns
-- Date: 2026-03-12

-- Fix ryyoung's role to admin (was changed to guest during recent role updates)
UPDATE lab_users SET role = 'admin' WHERE email = 'ryyoung@pmi.edu' AND role != 'admin';

-- Clear stale dashboard preferences for ryyoung so he gets fresh admin defaults
DELETE FROM user_preferences WHERE user_email = 'ryyoung@pmi.edu';

-- Ensure lab_day_equipment has checked_out_by and checked_out_at columns
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_by TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
