-- Substitute Requests: Instructors request coverage for assigned lab days
-- Admin/lead_instructor reviews and approves/denies requests

CREATE TABLE IF NOT EXISTS substitute_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_instructor_id UUID REFERENCES lab_users(id) ON DELETE CASCADE,
  lab_day_id UUID REFERENCES lab_days(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by UUID REFERENCES lab_users(id),
  review_notes TEXT,
  covered_by UUID REFERENCES lab_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sub_requests_status ON substitute_requests(status);
CREATE INDEX IF NOT EXISTS idx_sub_requests_instructor ON substitute_requests(requesting_instructor_id);
CREATE INDEX IF NOT EXISTS idx_sub_requests_lab_day ON substitute_requests(lab_day_id);

-- Enable RLS
ALTER TABLE substitute_requests ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can view (service role key handles actual filtering in API)
CREATE POLICY "substitute_requests_select_policy" ON substitute_requests
  FOR SELECT USING (true);

-- Policy: allow inserts (API enforces who can insert)
CREATE POLICY "substitute_requests_insert_policy" ON substitute_requests
  FOR INSERT WITH CHECK (true);

-- Policy: allow updates (API enforces role checks)
CREATE POLICY "substitute_requests_update_policy" ON substitute_requests
  FOR UPDATE USING (true);

-- Policy: allow deletes (API enforces role checks)
CREATE POLICY "substitute_requests_delete_policy" ON substitute_requests
  FOR DELETE USING (true);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
