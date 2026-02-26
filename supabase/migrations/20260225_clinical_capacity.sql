-- Clinical Site Capacity Tracking
-- Migration: 20260225_clinical_capacity.sql
-- Adds capacity fields to both the agencies table (EMS/hospital) and clinical_sites table

-- agencies table (EMS field agencies + hospital agencies)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS max_students_per_day INTEGER DEFAULT 2;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS max_students_per_rotation INTEGER;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS capacity_notes TEXT;
-- Add updated_at to agencies (missing from original migration)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- clinical_sites table (hospital clinical sites used for site visits)
ALTER TABLE clinical_sites ADD COLUMN IF NOT EXISTS max_students_per_day INTEGER DEFAULT 2;
ALTER TABLE clinical_sites ADD COLUMN IF NOT EXISTS max_students_per_rotation INTEGER;
ALTER TABLE clinical_sites ADD COLUMN IF NOT EXISTS capacity_notes TEXT;

-- Indexes for capacity queries
CREATE INDEX IF NOT EXISTS idx_agencies_capacity ON agencies(max_students_per_day) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_clinical_sites_capacity ON clinical_sites(max_students_per_day) WHERE is_active = true;

-- student_internships date index (used in utilization queries)
CREATE INDEX IF NOT EXISTS idx_internships_placement_date ON student_internships(placement_date);
CREATE INDEX IF NOT EXISTS idx_internships_agency_date ON student_internships(agency_id, placement_date);
