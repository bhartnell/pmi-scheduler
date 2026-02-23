-- Add drill_id column to skill_documents so the table can serve both skills and drills.
-- Documents with skill_id belong to a skill; documents with drill_id belong to a skill drill.

-- Add drill_id foreign key column
ALTER TABLE skill_documents ADD COLUMN IF NOT EXISTS drill_id UUID REFERENCES skill_drills(id) ON DELETE CASCADE;

-- Index for fast lookup by drill
CREATE INDEX IF NOT EXISTS idx_skill_documents_drill ON skill_documents(drill_id);

-- Make skill_id nullable now that docs can belong to either a skill or a drill
ALTER TABLE skill_documents ALTER COLUMN skill_id DROP NOT NULL;

COMMENT ON COLUMN skill_documents.drill_id IS 'When set, this document belongs to a skill drill instead of a skill. Exactly one of skill_id or drill_id should be set.';
