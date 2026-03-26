-- Add nremt_code column to skill_sheets for NREMT skill sheet identification
ALTER TABLE skill_sheets ADD COLUMN IF NOT EXISTS nremt_code TEXT;
CREATE INDEX IF NOT EXISTS idx_skill_sheets_nremt_code ON skill_sheets(nremt_code) WHERE nremt_code IS NOT NULL;
