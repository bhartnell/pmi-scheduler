-- Add checklist_state JSONB column to osce_events for day-of checklist persistence
ALTER TABLE osce_events ADD COLUMN IF NOT EXISTS checklist_state JSONB DEFAULT '{}';
