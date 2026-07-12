-- cert_tier unified rename: megacode_practice/megacode_testing -> scenario_practice/scenario_testing
--
-- Ben confirmed (2026-07-11, re-confirmed in the live Code session 2026-07-12):
-- adopt SCENARIO vocabulary shared across ACLS + PALS. "megacode" is
-- ACLS-specific; PALS reuses the same shared scenario bank and its practice/
-- testing tiers, so the tier names must be cert-neutral.
--
-- COORDINATED CODE+DATA MIGRATION — the code references to the literal strings
-- 'megacode_practice' / 'megacode_testing' are updated in the SAME commit
-- (types/adv-cert.ts, lib/adv-cert.ts, app/api/adv-cert/scenarios/route.ts).
-- A data rename without the code update would break existing ACLS grading.
--
-- DESTRUCTIVE (UPDATE-many on business data) — run with a restore point:
--   node scripts/run-migration.js supabase/migrations/20260712_cert_tier_scenario_rename.sql --backup=scenarios
--
-- Scope verified against live DB (2026-07-12): exactly 14 scenarios rows change
-- (8 megacode_practice + 6 megacode_testing, all cert_course='acls'); skills and
-- skill_drills have ZERO non-null cert_tier rows, so only their CHECK set moves.
-- 'skill' and 'learning_station' tiers are unchanged.

-- 1. Drop the old CHECK constraints (they forbid scenario_*, so they must go
--    before the data can be migrated).
ALTER TABLE scenarios   DROP CONSTRAINT IF EXISTS scenarios_cert_tier_check;
ALTER TABLE skills      DROP CONSTRAINT IF EXISTS skills_cert_tier_check;
ALTER TABLE skill_drills DROP CONSTRAINT IF EXISTS skill_drills_cert_tier_check;

-- 2. Migrate the existing ACLS rows.
UPDATE scenarios SET cert_tier = 'scenario_practice' WHERE cert_tier = 'megacode_practice';
UPDATE scenarios SET cert_tier = 'scenario_testing'  WHERE cert_tier = 'megacode_testing';
-- skills / skill_drills: no rows to migrate (all cert_tier IS NULL) — kept for
-- completeness/idempotency in case tags are added before this runs.
UPDATE skills      SET cert_tier = 'scenario_practice' WHERE cert_tier = 'megacode_practice';
UPDATE skills      SET cert_tier = 'scenario_testing'  WHERE cert_tier = 'megacode_testing';
UPDATE skill_drills SET cert_tier = 'scenario_practice' WHERE cert_tier = 'megacode_practice';
UPDATE skill_drills SET cert_tier = 'scenario_testing'  WHERE cert_tier = 'megacode_testing';

-- 3. Re-add the CHECK constraints with the new value set (megacode_* removed;
--    scenario_* added; skill/learning_station unchanged).
ALTER TABLE scenarios ADD CONSTRAINT scenarios_cert_tier_check
  CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','scenario_practice','scenario_testing'));
ALTER TABLE skills ADD CONSTRAINT skills_cert_tier_check
  CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','scenario_practice','scenario_testing'));
ALTER TABLE skill_drills ADD CONSTRAINT skill_drills_cert_tier_check
  CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','scenario_practice','scenario_testing'));

-- ROLLBACK: (reverse rename + restore old CHECK set)
--   ALTER TABLE scenarios   DROP CONSTRAINT IF EXISTS scenarios_cert_tier_check;
--   ALTER TABLE skills      DROP CONSTRAINT IF EXISTS skills_cert_tier_check;
--   ALTER TABLE skill_drills DROP CONSTRAINT IF EXISTS skill_drills_cert_tier_check;
--   UPDATE scenarios   SET cert_tier='megacode_practice' WHERE cert_tier='scenario_practice';
--   UPDATE scenarios   SET cert_tier='megacode_testing'  WHERE cert_tier='scenario_testing';
--   UPDATE skills      SET cert_tier='megacode_practice' WHERE cert_tier='scenario_practice';
--   UPDATE skills      SET cert_tier='megacode_testing'  WHERE cert_tier='scenario_testing';
--   UPDATE skill_drills SET cert_tier='megacode_practice' WHERE cert_tier='scenario_practice';
--   UPDATE skill_drills SET cert_tier='megacode_testing'  WHERE cert_tier='scenario_testing';
--   ALTER TABLE scenarios ADD CONSTRAINT scenarios_cert_tier_check
--     CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','megacode_practice','megacode_testing'));
--   ALTER TABLE skills ADD CONSTRAINT skills_cert_tier_check
--     CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','megacode_practice','megacode_testing'));
--   ALTER TABLE skill_drills ADD CONSTRAINT skill_drills_cert_tier_check
--     CHECK (cert_tier IS NULL OR cert_tier IN ('skill','learning_station','megacode_practice','megacode_testing'));
--   Plus revert the 3 code files. And drop the --backup snapshot table once verified:
--     DROP TABLE "_backup_scenarios_<timestamp>";
