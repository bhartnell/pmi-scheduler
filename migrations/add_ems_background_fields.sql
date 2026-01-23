-- Migration: Add EMS Background fields to students table
-- Purpose: Track incoming experience for Paramedic students for group balancing and data analysis
-- Date: 2026-01-22

-- Add prior certification level field
ALTER TABLE students ADD COLUMN IF NOT EXISTS prior_cert_level TEXT
  CHECK (prior_cert_level IN ('emt', 'aemt', 'other'));

COMMENT ON COLUMN students.prior_cert_level IS 'Prior certification level: emt (EMT-Basic), aemt (AEMT), other';

-- Add years of EMS experience field
ALTER TABLE students ADD COLUMN IF NOT EXISTS years_ems_experience NUMERIC(4, 1)
  CHECK (years_ems_experience >= 0 AND years_ems_experience <= 50);

COMMENT ON COLUMN students.years_ems_experience IS 'Years of EMS experience (decimal for precision, e.g., 2.5 years)';

-- Add prior work setting field
ALTER TABLE students ADD COLUMN IF NOT EXISTS prior_work_setting TEXT
  CHECK (prior_work_setting IN ('911', 'ift', 'hospital', 'flight', 'volunteer', 'none'));

COMMENT ON COLUMN students.prior_work_setting IS 'Primary work setting: 911 (911/Fire), ift (Private/IFT), hospital, flight (Flight/Critical Care), volunteer, none (not currently working)';

-- Add prior employer field
ALTER TABLE students ADD COLUMN IF NOT EXISTS prior_employer TEXT;

COMMENT ON COLUMN students.prior_employer IS 'Prior employer name (free text or agency reference)';

-- Verification query (run after migration to confirm)
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'students'
-- AND column_name IN ('prior_cert_level', 'years_ems_experience', 'prior_work_setting', 'prior_employer')
-- ORDER BY column_name;
