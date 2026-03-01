-- Migration: Add verification fields to instructor_certifications table
-- The certifications table (also referred to as instructor_certifications) stores
-- instructor credential records. These columns enable admins to track verification status.

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'expired', 'rejected')),
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Index to speed up status-based filtering
CREATE INDEX IF NOT EXISTS idx_certifications_verification_status
  ON certifications(verification_status);

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
