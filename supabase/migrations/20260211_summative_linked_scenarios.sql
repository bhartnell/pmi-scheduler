-- Add linked_scenario_id to summative_scenarios table
-- This allows linking a summative scenario to a full detailed scenario from the scenarios table

ALTER TABLE summative_scenarios
ADD COLUMN IF NOT EXISTS linked_scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_summative_scenarios_linked ON summative_scenarios(linked_scenario_id);

-- Comment for documentation
COMMENT ON COLUMN summative_scenarios.linked_scenario_id IS 'Optional link to a detailed scenario from the scenarios table for patient info, phases, vitals, etc.';
