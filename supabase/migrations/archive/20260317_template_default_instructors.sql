-- Migration: Add default_instructor_ids JSON array to pmi_course_templates
-- This allows templates to store multiple default instructors that get assigned
-- to all generated blocks when using the generate wizard.

ALTER TABLE pmi_course_templates
ADD COLUMN IF NOT EXISTS default_instructor_ids UUID[] DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN pmi_course_templates.default_instructor_ids IS 'Array of instructor UUIDs to auto-assign when generating blocks from this template';
