-- Skill Drills: support the JSON-import spec from docs/Skill_Drill_Webapp_Brief.md.
--
-- The skill_drills table already exists with most needed columns:
--   id, name, description, category, estimated_duration_minutes,
--   equipment_needed, instructions, is_active, created_by, drill_data
--   (jsonb), station_id, program, semester
--
-- The brief proposes additional structured content. Rather than adding
-- five new columns (concept, setups, run_steps, students_per_setup,
-- equipment as array), we use the existing drill_data JSONB as the
-- bucket. That keeps the schema stable and supports the brief's
-- "flexible fields, only render if present" requirement naturally.
--
-- Canonical drill_data shape (documented here, validated in code):
-- {
--   "concept":              string,   // TLDR paragraph
--   "students_per_setup":   number,
--   "instructor_notes":     string,
--   "equipment":            string[], // array form (vs the legacy
--                                     // equipment_needed text col)
--   "setups":               Setup[],  // see brief for shape
--   "run_steps":            string[]
-- }
--
-- Adds two things:
--   1. source TEXT column — 'internal' | 'imported' (default 'internal').
--      Lets us identify drills that came from the JSON-import path
--      vs ones built directly via UI.
--   2. CHECK on program — brief specifies the allowed values.
--      Existing rows are all 'paramedic' so the CHECK won't reject
--      historical data. 'all' is the brief-defined wildcard for
--      drills usable by any program.

ALTER TABLE skill_drills
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'skill_drills_program_check'
      AND conrelid = 'skill_drills'::regclass
  ) THEN
    ALTER TABLE skill_drills
      ADD CONSTRAINT skill_drills_program_check
      CHECK (program IS NULL OR program IN ('emt','aemt','paramedic','all'));
  END IF;
END $$;

-- Unique constraint for the import upsert key (title + program + semester).
-- Use a partial unique index so NULL semester rows don't collide
-- and the constraint covers the common case the import endpoint uses.
CREATE UNIQUE INDEX IF NOT EXISTS skill_drills_title_program_semester_uidx
  ON skill_drills (lower(name), program, COALESCE(semester, -1))
  WHERE is_active IS NOT FALSE;

COMMENT ON COLUMN skill_drills.drill_data IS
  'Structured drill content (concept, students_per_setup, instructor_notes, equipment[], setups[], run_steps[]). See docs/Skill_Drill_Webapp_Brief.md for the canonical shape.';
COMMENT ON COLUMN skill_drills.source IS
  'Origin tag: ''internal'' for UI-created drills, ''imported'' for JSON-import.';
