-- Add equipment_needed and medications_to_administer columns to scenarios table
-- These support the enhanced scenario form (Task 51 Part C)

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS equipment_needed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS medications_to_administer TEXT[] DEFAULT '{}';

-- Add index for scenarios that have equipment listed (for filtering/reporting)
CREATE INDEX IF NOT EXISTS idx_scenarios_equipment_needed
  ON scenarios USING gin (equipment_needed)
  WHERE equipment_needed IS NOT NULL AND array_length(equipment_needed, 1) > 0;
