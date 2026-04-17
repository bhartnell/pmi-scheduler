-- SMC (Student Minimum Competency) requirements per program + semester.
--
-- One row per (program, semester, required skill). Seeded from
-- lab_template_stations.skills jsonb (the de-facto SMC source today),
-- with admin edit UI coming in a future phase. Tracks:
--   - skill_id (FK to skills when name match succeeds)
--   - skill_name (free-form, used when skill_id is null)
--   - min_attempts and is_platinum copied from the template jsonb
--
-- Matching is done at query time (not at seed time) so that:
--   (a) rerunning the seed doesn't lose manual corrections
--   (b) new stations added via custom_title are picked up without a reseed.

CREATE TABLE IF NOT EXISTS smc_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  semester integer NOT NULL,
  -- skill_id may be null when the SMC name didn't match the skills catalog.
  -- The UI treats it as a "manual review" item and lets admins link it later.
  skill_id uuid REFERENCES skills(id) ON DELETE SET NULL,
  skill_name text NOT NULL,
  category text,
  min_attempts integer DEFAULT 1,
  is_platinum boolean DEFAULT false,
  notes text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (program_id, semester, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_smc_requirements_program_semester
  ON smc_requirements (program_id, semester);

CREATE INDEX IF NOT EXISTS idx_smc_requirements_skill_id
  ON smc_requirements (skill_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION smc_requirements_update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_smc_requirements_updated_at ON smc_requirements;
CREATE TRIGGER trg_smc_requirements_updated_at
  BEFORE UPDATE ON smc_requirements
  FOR EACH ROW EXECUTE FUNCTION smc_requirements_update_timestamp();
