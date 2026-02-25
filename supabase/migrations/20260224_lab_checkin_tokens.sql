-- Migration: Add student self-check-in token support to lab_days
-- 2026-02-24

ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS checkin_token TEXT UNIQUE;
ALTER TABLE lab_days ADD COLUMN IF NOT EXISTS checkin_enabled BOOLEAN DEFAULT false;

-- Index for fast token lookups on the public check-in endpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_days_checkin_token ON lab_days(checkin_token) WHERE checkin_token IS NOT NULL;
