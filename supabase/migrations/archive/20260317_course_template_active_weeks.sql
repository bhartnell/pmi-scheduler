-- Migration: Add active_weeks column to pmi_course_templates
-- Enables mid-semester day reduction (e.g., AEMT drops Day 2 after Week 9)
-- Values: 'all', '1-9', '10-15', or custom like '1-8,10,12-15'

ALTER TABLE pmi_course_templates
  ADD COLUMN IF NOT EXISTS active_weeks TEXT DEFAULT 'all';
