-- Migration: lvfr_aemt_skill_class_completion
-- Side 1 of skills tracking (class-level, roster-based).
--
-- Marks a skill "covered for the class" per cohort. Once covered, the skill is
-- treated as completed for the WHOLE roster (NOT per-student scored). This is
-- the ACLS/BLS/airway model: completion autofills for the class. The rare skill
-- FAILURE is a manual human exception documented off the blank reference sheet
-- (Side 2b) and is intentionally NOT tracked here.
--
-- Additive + reversible: new table only, IF NOT EXISTS, RLS on (API uses the
-- service-role client, which bypasses RLS). ROLLBACK at bottom.

CREATE TABLE IF NOT EXISTS "lvfr_aemt_skill_class_completion" (
  "id"             uuid        DEFAULT gen_random_uuid() NOT NULL,
  "cohort_id"      uuid        NOT NULL,
  "skill_id"       text        NOT NULL,
  "completed"      boolean     NOT NULL DEFAULT false,
  "completed_date" date,
  "completed_by"   text,
  "notes"          text,
  "updated_at"     timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "lvfr_skill_class_completion_cohort_skill_key" UNIQUE ("cohort_id", "skill_id"),
  CONSTRAINT "lvfr_skill_class_completion_cohort_fk"
    FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("id") ON DELETE CASCADE,
  CONSTRAINT "lvfr_skill_class_completion_skill_fk"
    FOREIGN KEY ("skill_id") REFERENCES "lvfr_aemt_skills" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_lvfr_skill_class_completion_cohort"
  ON "lvfr_aemt_skill_class_completion" ("cohort_id");

ALTER TABLE "lvfr_aemt_skill_class_completion" ENABLE ROW LEVEL SECURITY;

-- ROLLBACK:
-- DROP TABLE IF EXISTS lvfr_aemt_skill_class_completion;
