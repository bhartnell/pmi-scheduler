-- S3 Skill Drills: extend skill_drills with JSONB drill data and program metadata
-- Run in Supabase SQL Editor

ALTER TABLE skill_drills ADD COLUMN IF NOT EXISTS drill_data JSONB DEFAULT '{}';
ALTER TABLE skill_drills ADD COLUMN IF NOT EXISTS station_id TEXT;
ALTER TABLE skill_drills ADD COLUMN IF NOT EXISTS program TEXT;
ALTER TABLE skill_drills ADD COLUMN IF NOT EXISTS semester INTEGER;
ALTER TABLE skill_drills ADD COLUMN IF NOT EXISTS format TEXT;

-- Unique partial index on station_id (prevents duplicate seeding, existing drills unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_drills_station_id
  ON skill_drills(station_id) WHERE station_id IS NOT NULL;

-- Composite index for program+semester filtering
CREATE INDEX IF NOT EXISTS idx_skill_drills_program_semester
  ON skill_drills(program, semester) WHERE program IS NOT NULL;

COMMENT ON COLUMN skill_drills.drill_data IS 'Rich drill content: objectives, instructor_guide, student_instructions, case_bank/rhythm_cases, roles, stress_layers, minicode_phase_overlay, key_observations, common_errors';
COMMENT ON COLUMN skill_drills.station_id IS 'Slug identifier for upsert matching and template linkage (e.g., acls-rhythm-leadership)';
COMMENT ON COLUMN skill_drills.program IS 'Program scope: paramedic, emt, aemt. NULL = generic/all programs';
COMMENT ON COLUMN skill_drills.semester IS 'Semester scope: 1, 2, 3. NULL = generic/all semesters';
COMMENT ON COLUMN skill_drills.format IS 'Drill format: team_rotation or individual';

NOTIFY pgrst, 'reload schema';
