-- Add part-time flag to lab_users
-- This is a simple boolean endorsement flag that lets users keep their
-- instructor/lead instructor role but be flagged as part-time for
-- filtering emails, shift notifications, and reports.
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS is_part_time BOOLEAN DEFAULT false;
