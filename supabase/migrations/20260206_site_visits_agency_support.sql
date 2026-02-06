-- Add agency_id support to clinical_site_visits
-- Allows visits to be logged to either clinical sites OR field agencies

-- Add agency_id column referencing the agencies table
ALTER TABLE clinical_site_visits
ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;

-- Make site_id nullable (visits can now be to agencies instead of clinical sites)
ALTER TABLE clinical_site_visits
ALTER COLUMN site_id DROP NOT NULL;

-- Add check constraint: must have either site_id OR agency_id
ALTER TABLE clinical_site_visits
DROP CONSTRAINT IF EXISTS chk_site_or_agency;

ALTER TABLE clinical_site_visits
ADD CONSTRAINT chk_site_or_agency
CHECK (site_id IS NOT NULL OR agency_id IS NOT NULL);

-- Add index for agency queries
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_agency ON clinical_site_visits(agency_id);

COMMENT ON COLUMN clinical_site_visits.agency_id IS 'Reference to field agency (EMS) if visit is to an agency instead of clinical site';
