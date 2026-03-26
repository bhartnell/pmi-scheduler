-- Add NREMT multi-point sub-item fields to skill_sheet_steps
-- These support point-based scoring with sub-item checkboxes and section headers

ALTER TABLE skill_sheet_steps
  ADD COLUMN IF NOT EXISTS possible_points integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sub_items jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS section_header text DEFAULT NULL;

COMMENT ON COLUMN skill_sheet_steps.possible_points IS 'Number of points this step is worth (1 for simple pass/fail, >1 for multi-point sub-items)';
COMMENT ON COLUMN skill_sheet_steps.sub_items IS 'JSON array of sub-items, each with a label field, e.g. [{"label":"Check pulse"},{"label":"Check breathing"}]';
COMMENT ON COLUMN skill_sheet_steps.section_header IS 'If non-null, renders a bold section divider above this step';
