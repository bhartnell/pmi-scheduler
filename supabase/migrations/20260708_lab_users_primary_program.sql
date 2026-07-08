-- Add a per-instructor PROGRAM TAG (primary discipline) to lab_users.
--
-- Part 1 of the lab-day calendar rule / general-lab-default feature
-- (Notion "[CALENDAR - HIGH/LAUNCH] THE FIX for labs-not-showing"):
-- combined with the existing is_part_time flag, primary_program identifies
-- a "full-time paramedic instructor" (is_part_time = false AND
-- primary_program = 'paramedic') — the set that gets the general-lab-default
-- event on their cohort's lab days. The tag is also reusable for other
-- program-aware logic (e.g. Clinical Tracker tabs).
--
-- Nullable: NULL = untagged (no general-lab default). Ben sets the tags in
-- the admin user editor. Additive + idempotent.

ALTER TABLE "lab_users"
  ADD COLUMN IF NOT EXISTS "primary_program" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_users_primary_program_check'
  ) THEN
    ALTER TABLE "lab_users"
      ADD CONSTRAINT "lab_users_primary_program_check"
      CHECK (primary_program IS NULL OR primary_program IN ('paramedic', 'aemt', 'emt'));
  END IF;
END $$;

-- ROLLBACK:
-- ALTER TABLE "lab_users" DROP CONSTRAINT IF EXISTS "lab_users_primary_program_check";
-- ALTER TABLE "lab_users" DROP COLUMN IF EXISTS "primary_program";
