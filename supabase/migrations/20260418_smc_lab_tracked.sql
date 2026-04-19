-- Add lab_tracked flag to smc_requirements so the cohort lab SMC view
-- can hide skills that are tracked in Platinum (clinical/field) rather
-- than via lab stations. Default TRUE — only explicitly-flagged skills
-- are hidden from the lab planning view.
--
-- Initial data application: the two PM clinical med-admin skills move
-- to lab_tracked=false so they stop showing "not yet covered" on the
-- lab SMC view — they're tracked in Platinum, not here.
--   • IV Bolus Medication
--   • IV Infusion Setup
-- All other PM, AEMT, and EMT SMC rows stay lab_tracked=true.

ALTER TABLE smc_requirements
  ADD COLUMN IF NOT EXISTS lab_tracked boolean DEFAULT true;

-- Explicit flip for the two clinical-only PM med-admin skills. Scoped
-- by name+program so this is safe to rerun (idempotent).
UPDATE smc_requirements sr
SET lab_tracked = false
FROM programs p
WHERE sr.program_id = p.id
  AND (
    (p.abbreviation = 'PM' OR p.abbreviation = 'PMD')
    AND sr.skill_name IN ('IV Bolus Medication', 'IV Infusion Setup')
  );
