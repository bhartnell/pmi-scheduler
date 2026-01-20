-- ============================================
-- POLLS AVAILABLE SLOTS COLUMN
-- Add available_slots field to polls table for creator slot selection
-- ============================================

-- Add available_slots column to polls table
-- This stores the array of slot keys (e.g., "0-0", "1-2") that the poll creator has made available
ALTER TABLE polls ADD COLUMN IF NOT EXISTS available_slots JSONB DEFAULT '[]';

-- Index for queries that filter by available slots
CREATE INDEX IF NOT EXISTS idx_polls_available_slots ON polls USING GIN (available_slots);
