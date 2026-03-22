-- 1. Substitute Requests
CREATE TABLE IF NOT EXISTS substitute_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  requester_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  reason_details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'covered')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  covered_by TEXT,
  covered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_substitute_requests_status ON substitute_requests(status);
CREATE INDEX IF NOT EXISTS idx_substitute_requests_lab_day ON substitute_requests(lab_day_id);
NOTIFY pgrst, 'reload schema';
