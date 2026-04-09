-- Add is_nremt boolean to skill_sheets and skills tables for NREMT identification

-- skill_sheets: tag skill sheets that are NREMT-sourced
ALTER TABLE skill_sheets ADD COLUMN IF NOT EXISTS is_nremt BOOLEAN DEFAULT false;

UPDATE skill_sheets SET is_nremt = true
WHERE source = 'nremt' OR nremt_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_skill_sheets_is_nremt ON skill_sheets(is_nremt) WHERE is_nremt = true;

-- skills: tag skills in the station assignment table
ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_nremt BOOLEAN DEFAULT false;

-- Tag skills that match known NREMT skill names
UPDATE skills SET is_nremt = true WHERE name IN (
  'Medical Assessment',
  'Trauma Assessment',
  'BVM Ventilation',
  'Oxygen Administration',
  'AED Operation',
  'AED / Defibrillation',
  'Joint Immobilization',
  'Long Bone Immobilization',
  'Spinal Immobilization',
  'Bleeding Control',
  'Shock Management'
);

-- Also tag any skills with NREMT-related keywords
UPDATE skills SET is_nremt = true WHERE (
  name ILIKE '%nremt%'
  OR name ILIKE '%cardiac arrest%'
  OR name ILIKE '%spinal immobilization%'
) AND is_nremt = false;

CREATE INDEX IF NOT EXISTS idx_skills_is_nremt ON skills(is_nremt) WHERE is_nremt = true;
