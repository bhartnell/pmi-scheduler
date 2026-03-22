-- Migration: Shift Trade/Swap Request System
-- Date: 2026-02-24
-- Description: Allows instructors to request trades for confirmed shifts, with director approval.

CREATE TABLE IF NOT EXISTS shift_trade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES lab_users(id),
  requester_shift_id UUID NOT NULL REFERENCES open_shifts(id),
  target_shift_id UUID REFERENCES open_shifts(id),
  target_user_id UUID REFERENCES lab_users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'approved', 'cancelled')),
  reason TEXT,
  response_note TEXT,
  approved_by UUID REFERENCES lab_users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_requester ON shift_trade_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_trade_status ON shift_trade_requests(status);
CREATE INDEX IF NOT EXISTS idx_trade_requester_shift ON shift_trade_requests(requester_shift_id);
CREATE INDEX IF NOT EXISTS idx_trade_target_user ON shift_trade_requests(target_user_id);

ALTER TABLE shift_trade_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage trades" ON shift_trade_requests FOR ALL USING (true);
