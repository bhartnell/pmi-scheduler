-- Migration: FERPA Safeguards — Consent Tracking, Record Access Logging, FERPA Releases
-- Created: 2026-03-10
-- Purpose: Add consent tracking table, record access log for FERPA compliance,
--          FERPA release columns on students table, and seed agreement templates.
--          Foundation for Task 108.

-- ============================================
-- Part A: Consent Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS data_consent_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  agreement_type TEXT NOT NULL CHECK (agreement_type IN (
    'student_data_use', 'agency_data_sharing', 'instructor_confidentiality'
  )),
  agreement_version INTEGER DEFAULT 1,
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, agreement_type, agreement_version)
);

CREATE INDEX IF NOT EXISTS idx_consent_user_email ON data_consent_agreements(user_email);
CREATE INDEX IF NOT EXISTS idx_consent_type ON data_consent_agreements(agreement_type);

-- ============================================
-- Part B: Record Access Logging
-- ============================================

-- Separate from audit_log — higher volume, FERPA-specific schema
CREATE TABLE IF NOT EXISTS record_access_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  student_id UUID,
  data_type TEXT NOT NULL,
  action TEXT NOT NULL,
  route TEXT,
  details JSONB,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_record_access_log_user ON record_access_log(user_email);
CREATE INDEX IF NOT EXISTS idx_record_access_log_student ON record_access_log(student_id);
CREATE INDEX IF NOT EXISTS idx_record_access_log_date ON record_access_log(accessed_at DESC);

-- ============================================
-- Part C: FERPA Release Columns on Students
-- ============================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS ferpa_agency_release BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ferpa_release_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ferpa_release_agency TEXT;

COMMENT ON COLUMN students.ferpa_agency_release IS 'Whether student has signed a FERPA release for agency data sharing';
COMMENT ON COLUMN students.ferpa_release_date IS 'Date the FERPA release was signed';
COMMENT ON COLUMN students.ferpa_release_agency IS 'Agency name the FERPA release applies to (e.g., LVFR)';

-- ============================================
-- Part D: Row Level Security
-- ============================================

ALTER TABLE data_consent_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_access_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY service_role_consent ON data_consent_agreements FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_access_log ON record_access_log FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Part E: Seed Agreement Templates
-- ============================================

-- Uses ai_prompt_templates table (created in 20260307_case_generation_pipeline.sql)
-- with (name, version) unique constraint for versioned text storage

INSERT INTO ai_prompt_templates (id, name, prompt_text, version, is_active, created_by)
VALUES
  (
    gen_random_uuid(),
    'student_data_use_agreement',
    'By using this platform, you acknowledge that Pima Medical Institute collects and stores educational records including grades, attendance, skill evaluations, and pharmacology checkpoint scores. This data is stored on encrypted, US-based servers and is accessible only to authorized PMI instructors and administrators. For students enrolled in agency-sponsored programs (e.g., LVFR AEMT), your designated agency representatives may also view your academic progress per the FERPA release you signed during enrollment. Data is retained for the duration of your enrollment plus seven years per institutional policy. You may request access to your records at any time by contacting your program director.',
    1,
    true,
    'system'
  ),
  (
    gen_random_uuid(),
    'agency_data_sharing_agreement',
    'You are accessing student education records as an authorized representative of your affiliated agency. This access is governed by FERPA (Family Educational Rights and Privacy Act) and the data sharing agreement between Pima Medical Institute and your organization. By proceeding, you agree to: (1) not share student data with unauthorized parties, (2) not screenshot or export data beyond authorized purposes, (3) use student data solely for program oversight and student support, (4) report any data breach or unauthorized access immediately to PMI administration. Violation of these terms may result in immediate access revocation.',
    1,
    true,
    'system'
  )
ON CONFLICT DO NOTHING;
