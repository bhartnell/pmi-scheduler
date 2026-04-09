-- Migration: NREMT Retake System
-- Adds retake tracking columns to student_skill_evaluations

-- Add is_retake column
DO $$ BEGIN
  ALTER TABLE student_skill_evaluations ADD COLUMN is_retake boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add original_evaluation_id column (self-referencing FK)
DO $$ BEGIN
  ALTER TABLE student_skill_evaluations ADD COLUMN original_evaluation_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add FK constraint for original_evaluation_id
DO $$ BEGIN
  ALTER TABLE student_skill_evaluations
    ADD CONSTRAINT student_skill_evaluations_original_evaluation_id_fkey
    FOREIGN KEY (original_evaluation_id) REFERENCES student_skill_evaluations(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for looking up retakes by original evaluation
CREATE INDEX IF NOT EXISTS idx_sse_original_evaluation_id
  ON student_skill_evaluations(original_evaluation_id)
  WHERE original_evaluation_id IS NOT NULL;

-- Index for retake queries by lab_day + student
CREATE INDEX IF NOT EXISTS idx_sse_retake_lookup
  ON student_skill_evaluations(lab_day_id, student_id, is_retake)
  WHERE is_retake = true;
