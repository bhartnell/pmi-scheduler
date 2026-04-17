-- Add provisional license tracking to student_internships
-- Used in the Placement & Pre-Requisites section of the internship edit page.
-- Note: a legacy "provisional_date" column exists but is unused; we add
-- explicit dedicated columns for the new UI to avoid ambiguity.

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS provisional_license_obtained boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provisional_license_date date;
