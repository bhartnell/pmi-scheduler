-- Add week_number and sim_permitted columns to smc_requirements so the
-- authoritative EMT + AEMT lists (provided 2026-04-18) can be seeded
-- with their full structure.
--
--   week_number: the week of the course when this skill is introduced.
--                EMT and AEMT are single-semester programs with a
--                defined week ordering; Paramedic rows leave it null.
--
--   sim_permitted: AEMT CoAEMSP motor skills marked with * allow
--                  simulation toward the minimum attempt count. Used
--                  for clearance tracking so sim attempts can be
--                  counted alongside live patient contacts.
--
-- Both columns are nullable/defaulted so existing rows don't change.

ALTER TABLE smc_requirements
  ADD COLUMN IF NOT EXISTS week_number integer,
  ADD COLUMN IF NOT EXISTS sim_permitted boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_smc_requirements_week
  ON smc_requirements (program_id, semester, week_number);
