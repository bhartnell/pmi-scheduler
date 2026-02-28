-- Student Profile Self-Service Fields
-- Migration: 20260228_student_profile_fields.sql
-- Purpose: Add contact/profile fields students can edit themselves

-- Add phone number field
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add address field
ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;

-- Add emergency contact relationship (emergency_contact_name and
-- emergency_contact_phone already exist from 20260226_student_import_enhancements.sql)
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- Add student number (for display; separate from the UUID primary key)
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_number TEXT;

-- Add enrollment date
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_date DATE;

-- Add indexes for fields that may be searched
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number) WHERE student_number IS NOT NULL;
