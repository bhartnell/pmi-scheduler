-- Add version counter to lab_timer_state for optimistic concurrency control
-- and efficient polling (clients can skip re-fetching unchanged state)

ALTER TABLE lab_timer_state ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
