-- Add event_pin to osce_events for shared PIN-based evaluator access
-- Replaces individual magic links as the primary entry method

ALTER TABLE osce_events ADD COLUMN IF NOT EXISTS event_pin TEXT DEFAULT 'OSCE2026';

-- Add index for PIN lookups
CREATE INDEX IF NOT EXISTS idx_osce_events_pin ON osce_events(event_pin);
