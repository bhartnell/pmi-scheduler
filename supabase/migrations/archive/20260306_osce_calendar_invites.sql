-- OSCE Calendar Invites: Track when calendar invites have been sent to observers
-- Add calendar_invite_sent_at to osce_observer_blocks for tracking invite status

ALTER TABLE osce_observer_blocks ADD COLUMN IF NOT EXISTS calendar_invite_sent_at TIMESTAMPTZ;

-- Also store Google Calendar event IDs for OSCE blocks in google_calendar_events
-- The existing google_calendar_events table already supports this via source_type/source_id
-- We'll use source_type = 'osce_block' and source_id = time_block_id
