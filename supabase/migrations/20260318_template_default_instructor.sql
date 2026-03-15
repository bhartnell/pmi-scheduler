-- Add default instructor columns to pmi_course_templates
-- When generating a semester, templates with a default instructor will auto-assign that instructor

ALTER TABLE pmi_course_templates
  ADD COLUMN IF NOT EXISTS default_instructor_id UUID REFERENCES lab_users(id) ON DELETE SET NULL;

ALTER TABLE pmi_course_templates
  ADD COLUMN IF NOT EXISTS default_instructor_name TEXT;

-- Index for FK lookups
CREATE INDEX IF NOT EXISTS idx_course_templates_default_instructor
  ON pmi_course_templates(default_instructor_id)
  WHERE default_instructor_id IS NOT NULL;

COMMENT ON COLUMN pmi_course_templates.default_instructor_id IS 'Default instructor auto-assigned when generating semester blocks';
COMMENT ON COLUMN pmi_course_templates.default_instructor_name IS 'Cached instructor name for display without joins';
