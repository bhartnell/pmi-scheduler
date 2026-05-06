-- Add preferred_manikin to scenarios.
--
-- Optional hint shown on the scenario edit / view pages so lab
-- coordinators know which simulator the scenario was designed
-- around. Most scenarios are run on whatever's available, so this
-- field is nullable and OK to leave blank.
--
-- Allowed values (CHECK constraint):
--   simmom            — birthing / OB / postpartum
--   simnewb           — neonatal / infant
--   standard_manikin  — adult manikin (default high-fidelity)
--   task_trainer      — single-skill trainer (IV arm, intubation
--                       head, etc.)
--   none_specified    — explicit "no preference" marker (distinct
--                       from null which means "haven't decided")

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS preferred_manikin text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scenarios_preferred_manikin_check'
  ) THEN
    ALTER TABLE scenarios
      ADD CONSTRAINT scenarios_preferred_manikin_check
      CHECK (preferred_manikin IS NULL OR preferred_manikin = ANY (ARRAY[
        'simmom'::text,
        'simnewb'::text,
        'standard_manikin'::text,
        'task_trainer'::text,
        'none_specified'::text
      ]));
  END IF;
END $$;

COMMENT ON COLUMN scenarios.preferred_manikin IS
  'Optional hint to lab coordinators about which simulator/trainer the scenario was designed for. Null = no preference recorded; ''none_specified'' = explicitly no preference.';
