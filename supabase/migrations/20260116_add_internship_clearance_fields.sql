-- ============================================
-- ADD CLEARANCE FIELDS TO STUDENT_INTERNSHIPS
-- Migration: 20260116_add_internship_clearance_fields.sql
-- ============================================

-- Orientation
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS orientation_completed BOOLEAN DEFAULT false;

-- Pre-placement clearance checklist
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS liability_form_completed BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS background_check_completed BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS drug_screen_completed BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS immunizations_verified BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS cpr_card_verified BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS uniform_issued BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS badge_issued BOOLEAN DEFAULT false;

-- NREMT clearance
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS cleared_for_nremt BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS ryan_notified BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS ryan_notified_date DATE;
