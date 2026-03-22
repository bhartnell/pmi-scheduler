-- Add Helmet Removal: canonical skill, update skill_sheets, link, aliases, skills picker
-- Idempotent via ON CONFLICT / WHERE NOT EXISTS checks.

-- 1. Insert canonical skill
INSERT INTO canonical_skills (canonical_name, skill_category, programs, scope_notes, paramedic_only)
VALUES (
  'Helmet Removal',
  'immobilization',
  ARRAY['emt','aemt','paramedic'],
  'Same technique at all levels. Two-person technique — one maintains inline stabilization while the other removes helmet.',
  false
)
ON CONFLICT (canonical_name) DO NOTHING;

-- 2. Update the Publisher skill_sheets record from program='aemt' to program='all'
UPDATE skill_sheets
SET program = 'all'
WHERE skill_name = 'Removing a Helmet'
  AND program = 'aemt';

-- 3. Link skill_sheets record to the canonical skill via canonical_skill_id
UPDATE skill_sheets
SET canonical_skill_id = (SELECT id FROM canonical_skills WHERE canonical_name = 'Helmet Removal')
WHERE skill_name = 'Removing a Helmet'
  AND canonical_skill_id IS NULL;

-- 4. Add skill_sheet_assignments aliases
DO $$
DECLARE
  v_sheet_id UUID;
  v_aliases TEXT[] := ARRAY['Helmet Removal', 'Football Helmet Removal', 'Helmet Remove'];
  v_alias TEXT;
BEGIN
  SELECT id INTO v_sheet_id FROM skill_sheets WHERE skill_name = 'Removing a Helmet' LIMIT 1;
  IF v_sheet_id IS NOT NULL THEN
    FOREACH v_alias IN ARRAY v_aliases LOOP
      INSERT INTO skill_sheet_assignments (skill_name, skill_sheet_id)
      VALUES (v_alias, v_sheet_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 5. Add skills table entry for station skill picker
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES (
  'Helmet Removal',
  'Immobilization',
  'Two-person helmet removal with inline stabilization',
  ARRAY['EMT','AEMT','Paramedic'],
  1, 0, true
)
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
