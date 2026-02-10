-- Add missing scenario-level assessment fields
-- These support XABCDE, SAMPLE history, and OPQRST at the scenario level

-- Primary Assessment - XABCDE fields
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_x TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_a TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS assessment_e TEXT;

-- SAMPLE History (scenario-level, as JSONB)
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS sample_history JSONB DEFAULT '{"signs_symptoms": "", "last_oral_intake": "", "events_leading": ""}'::jsonb;

-- OPQRST (scenario-level, as JSONB)
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS opqrst JSONB DEFAULT '{"onset": "", "provocation": "", "quality": "", "radiation": "", "severity": "", "time_onset": ""}'::jsonb;

-- Comments for documentation
COMMENT ON COLUMN scenarios.assessment_x IS 'X - Hemorrhage Control assessment';
COMMENT ON COLUMN scenarios.assessment_a IS 'A - Airway Status assessment';
COMMENT ON COLUMN scenarios.assessment_e IS 'E - Expose/Environment findings';
COMMENT ON COLUMN scenarios.sample_history IS 'SAMPLE History at scenario level - S (signs), L (last oral intake), E (events leading)';
COMMENT ON COLUMN scenarios.opqrst IS 'OPQRST at scenario level - O, P, Q, R, S, T fields';
