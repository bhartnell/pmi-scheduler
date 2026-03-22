-- Add complete XABCDE assessment fields to scenarios table
-- Previous migration added X, A, E - now adding B, C, D for complete primary assessment

-- Primary Assessment - Complete XABCDE
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_b TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_c TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_d TEXT;

-- Neurological assessment details (part of D - Disability)
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS gcs TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS pupils TEXT;

-- Secondary Survey - body system findings
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS secondary_survey JSONB DEFAULT '{}'::jsonb;

-- EKG/Cardiac findings
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS ekg_findings JSONB DEFAULT '{}'::jsonb;

-- Debrief points for instructor use
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS debrief_points TEXT[];

-- Comments for documentation
COMMENT ON COLUMN scenarios.assessment_b IS 'B - Breathing assessment (rate, quality, breath sounds, effort)';
COMMENT ON COLUMN scenarios.assessment_c IS 'C - Circulation assessment (pulses, skin signs, bleeding, cap refill)';
COMMENT ON COLUMN scenarios.assessment_d IS 'D - Disability/Neurological status (LOC, motor/sensory)';
COMMENT ON COLUMN scenarios.gcs IS 'Glasgow Coma Scale score (e.g., "E4V5M6 = 15")';
COMMENT ON COLUMN scenarios.pupils IS 'Pupil assessment (e.g., "PERRL 4mm", "Fixed dilated")';
COMMENT ON COLUMN scenarios.secondary_survey IS 'Secondary survey body system findings as JSONB (head, neck, chest, abdomen, back, pelvis, extremities)';
COMMENT ON COLUMN scenarios.ekg_findings IS 'EKG/Cardiac findings as JSONB (rhythm, rate, interpretation, 12_lead)';
COMMENT ON COLUMN scenarios.debrief_points IS 'Key debrief discussion points for instructor';

-- Index for scenarios with EKG findings (cardiac scenarios)
CREATE INDEX IF NOT EXISTS idx_scenarios_ekg ON scenarios USING GIN (ekg_findings) WHERE ekg_findings IS NOT NULL AND ekg_findings != '{}'::jsonb;
