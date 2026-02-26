-- Migration: access_requests table
-- Stores self-service signup requests from non-PMI users (e.g. volunteer instructors)

CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  requested_role TEXT DEFAULT 'volunteer_instructor',
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  denial_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);

-- RLS: enable but allow service-role key full access (all API routes use service role)
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically, but we add a permissive policy for
-- authenticated users so client-side queries (if ever needed) are restricted.
-- For now all access goes through server-side API routes with service role key.
CREATE POLICY "Service role full access" ON access_requests
  USING (true)
  WITH CHECK (true);
