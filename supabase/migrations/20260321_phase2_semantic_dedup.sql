-- Phase 2: Merge semantic duplicates within the same program (AEMT)
-- 3 pairs identified as same-skill with different naming conventions

BEGIN;

-- ===========================================
-- Pair 1: AEMT Nasal Airway duplicates
-- Keep: "Inserting a Nasopharyngeal Airway in a Patient" (79a8d12f) - clearer name
-- Deactivate: "Inserting a Nasal Airway" (772a58d8)
-- Both 3 steps, 0 evals
-- ===========================================

DO $$
DECLARE
  v_keeper_id uuid;
  v_deactivate_id uuid;
  v_keeper_steps int;
  v_deactivate_steps int;
BEGIN
  SELECT id INTO v_keeper_id FROM skill_sheets WHERE id::text LIKE '79a8d12f%' AND is_active = true;
  SELECT id INTO v_deactivate_id FROM skill_sheets WHERE id::text LIKE '772a58d8%' AND is_active = true;

  IF v_keeper_id IS NULL OR v_deactivate_id IS NULL THEN
    RAISE NOTICE 'Pair 1: One or both not found/active, skipping';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_keeper_steps FROM skill_sheet_steps WHERE skill_sheet_id = v_keeper_id;
  SELECT COUNT(*) INTO v_deactivate_steps FROM skill_sheet_steps WHERE skill_sheet_id = v_deactivate_id;

  -- Migrate evals
  UPDATE student_skill_evaluations SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;

  -- Migrate assignments (delete from deactivated where keeper already has same program)
  DELETE FROM skill_sheet_assignments WHERE skill_sheet_id = v_deactivate_id
    AND program IN (SELECT program FROM skill_sheet_assignments WHERE skill_sheet_id = v_keeper_id);
  UPDATE skill_sheet_assignments SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;

  -- Migrate steps only if keeper has fewer
  IF v_keeper_steps < v_deactivate_steps THEN
    DELETE FROM skill_sheet_steps WHERE skill_sheet_id = v_keeper_id;
    UPDATE skill_sheet_steps SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;
    RAISE NOTICE 'Pair 1: Migrated % steps from deactivated to keeper', v_deactivate_steps;
  ELSE
    DELETE FROM skill_sheet_steps WHERE skill_sheet_id = v_deactivate_id;
    RAISE NOTICE 'Pair 1: Keeper has % steps, removed % from deactivated', v_keeper_steps, v_deactivate_steps;
  END IF;

  UPDATE skill_sheets SET is_active = false WHERE id = v_deactivate_id;
  RAISE NOTICE 'Pair 1: Deactivated "Inserting a Nasal Airway" -> keeper "Inserting a Nasopharyngeal Airway in a Patient"';
END $$;


-- ===========================================
-- Pair 2: AEMT Oral Airway duplicates
-- Keep: "Inserting an Oropharyngeal Airway in a Patient" (5b4f0bac) - most descriptive
-- Deactivate: "Inserting an Oral Airway Into an Adult" (cf6f8941) - same skill, less specific
-- Note: "Inserting an Oral Airway With a 90° Rotation" (d2ef8d9d) is a DIFFERENT technique - keep it
-- ===========================================

DO $$
DECLARE
  v_keeper_id uuid;
  v_deactivate_id uuid;
  v_keeper_steps int;
  v_deactivate_steps int;
BEGIN
  SELECT id INTO v_keeper_id FROM skill_sheets WHERE id::text LIKE '5b4f0bac%' AND is_active = true;
  SELECT id INTO v_deactivate_id FROM skill_sheets WHERE id::text LIKE 'cf6f8941%' AND is_active = true;

  IF v_keeper_id IS NULL OR v_deactivate_id IS NULL THEN
    RAISE NOTICE 'Pair 2: One or both not found/active, skipping';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_keeper_steps FROM skill_sheet_steps WHERE skill_sheet_id = v_keeper_id;
  SELECT COUNT(*) INTO v_deactivate_steps FROM skill_sheet_steps WHERE skill_sheet_id = v_deactivate_id;

  UPDATE student_skill_evaluations SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;

  DELETE FROM skill_sheet_assignments WHERE skill_sheet_id = v_deactivate_id
    AND program IN (SELECT program FROM skill_sheet_assignments WHERE skill_sheet_id = v_keeper_id);
  UPDATE skill_sheet_assignments SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;

  IF v_keeper_steps < v_deactivate_steps THEN
    DELETE FROM skill_sheet_steps WHERE skill_sheet_id = v_keeper_id;
    UPDATE skill_sheet_steps SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;
  ELSE
    DELETE FROM skill_sheet_steps WHERE skill_sheet_id = v_deactivate_id;
  END IF;

  UPDATE skill_sheets SET is_active = false WHERE id = v_deactivate_id;
  RAISE NOTICE 'Pair 2: Deactivated "Inserting an Oral Airway Into an Adult" -> keeper "Inserting an Oropharyngeal Airway in a Patient"';
END $$;


-- ===========================================
-- Pair 3: AEMT BVM duplicates
-- Keep: "One-Person Bag-Mask Device Ventilation" (59dfe8a1) - 4 steps (more detailed)
-- Deactivate: "One-Person Technique for Using a BVM" (9a11da60) - 2 steps
-- ===========================================

DO $$
DECLARE
  v_keeper_id uuid;
  v_deactivate_id uuid;
  v_keeper_steps int;
  v_deactivate_steps int;
BEGIN
  SELECT id INTO v_keeper_id FROM skill_sheets WHERE id::text LIKE '59dfe8a1%' AND is_active = true;
  SELECT id INTO v_deactivate_id FROM skill_sheets WHERE id::text LIKE '9a11da60%' AND is_active = true;

  IF v_keeper_id IS NULL OR v_deactivate_id IS NULL THEN
    RAISE NOTICE 'Pair 3: One or both not found/active, skipping';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_keeper_steps FROM skill_sheet_steps WHERE skill_sheet_id = v_keeper_id;
  SELECT COUNT(*) INTO v_deactivate_steps FROM skill_sheet_steps WHERE skill_sheet_id = v_deactivate_id;

  UPDATE student_skill_evaluations SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;

  DELETE FROM skill_sheet_assignments WHERE skill_sheet_id = v_deactivate_id
    AND program IN (SELECT program FROM skill_sheet_assignments WHERE skill_sheet_id = v_keeper_id);
  UPDATE skill_sheet_assignments SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;

  IF v_keeper_steps < v_deactivate_steps THEN
    DELETE FROM skill_sheet_steps WHERE skill_sheet_id = v_keeper_id;
    UPDATE skill_sheet_steps SET skill_sheet_id = v_keeper_id WHERE skill_sheet_id = v_deactivate_id;
  ELSE
    DELETE FROM skill_sheet_steps WHERE skill_sheet_id = v_deactivate_id;
  END IF;

  UPDATE skill_sheets SET is_active = false WHERE id = v_deactivate_id;
  RAISE NOTICE 'Pair 3: Deactivated "One-Person Technique for Using a BVM" -> keeper "One-Person Bag-Mask Device Ventilation"';
END $$;

COMMIT;
