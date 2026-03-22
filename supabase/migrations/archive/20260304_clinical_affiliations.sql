-- Migration: Clinical Affiliation Agreement Tracker
-- Created: 2026-03-04
-- Purpose: Track clinical site affiliation agreements and their expiration dates
--          Add program_director role for non-instructor staff who manage affiliations

-- ============================================
-- 1. Add program_director role to lab_users
-- ============================================

ALTER TABLE lab_users DROP CONSTRAINT IF EXISTS lab_users_role_check;

ALTER TABLE lab_users ADD CONSTRAINT lab_users_role_check
  CHECK (role IN (
    'superadmin',
    'admin',
    'lead_instructor',
    'instructor',
    'volunteer_instructor',
    'program_director',
    'student',
    'guest',
    'pending'
  ));

COMMENT ON COLUMN lab_users.role IS 'User role: superadmin, admin, lead_instructor, instructor, volunteer_instructor, program_director (affiliations access only), student, guest, or pending';

-- ============================================
-- 2. Clinical Affiliations table
-- ============================================

CREATE TABLE IF NOT EXISTS clinical_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL,
  agreement_status TEXT NOT NULL DEFAULT 'active'
    CHECK (agreement_status IN ('active', 'expired', 'pending_renewal', 'terminated')),
  start_date DATE,
  expiration_date DATE NOT NULL,
  responsible_person TEXT,
  responsible_person_email TEXT,
  notes TEXT,
  document_url TEXT,
  auto_renew BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_affiliations_expiration
  ON clinical_affiliations(expiration_date);
CREATE INDEX IF NOT EXISTS idx_clinical_affiliations_status
  ON clinical_affiliations(agreement_status);

ALTER TABLE clinical_affiliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage affiliations"
  ON clinical_affiliations FOR ALL USING (true);

-- ============================================
-- 3. Affiliation Notifications Log
-- ============================================

CREATE TABLE IF NOT EXISTS affiliation_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliation_id UUID NOT NULL REFERENCES clinical_affiliations(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  recipients TEXT[]
);

-- Prevent duplicate notifications on the same day for same affiliation + type
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliation_notif_dedup
  ON affiliation_notifications_log(affiliation_id, notification_type, sent_date);

ALTER TABLE affiliation_notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view notification logs"
  ON affiliation_notifications_log FOR ALL USING (true);
