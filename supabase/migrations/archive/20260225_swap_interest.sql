-- Migration: Shift Swap Interest / Volunteer Pool
-- Date: 2026-02-25
-- Description: Allows instructors to express interest in covering an open swap request.
--   Directors can then select from the interested pool to assign a replacement.

CREATE TABLE IF NOT EXISTS shift_swap_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_request_id UUID NOT NULL REFERENCES shift_trade_requests(id) ON DELETE CASCADE,
  interested_by TEXT NOT NULL,
  status TEXT DEFAULT 'interested' CHECK (status IN ('interested', 'selected', 'declined')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swap_interest_request ON shift_swap_interest(swap_request_id);
CREATE INDEX IF NOT EXISTS idx_swap_interest_user ON shift_swap_interest(interested_by);

ALTER TABLE shift_swap_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage swap interest" ON shift_swap_interest FOR ALL USING (true);
