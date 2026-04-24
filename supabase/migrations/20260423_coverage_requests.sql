-- Coverage Request flow — April 23 batch item #2.
--
-- Lead instructors can file a "please find coverage for this block" ticket.
-- Approvers (Ryan + Ben, i.e. admin+) see pending tickets on the /scheduling
-- page and can approve → which creates an open_shifts row so part-timers
-- get it through their normal flow.
--
-- Status machine:
--   pending    — just filed; awaits director review
--   approved   — director approved; open shift created (via FK below)
--   filled     — a part-timer confirmed the resulting shift (set by
--                 the signup flow when the linked shift hits capacity)
--   cancelled  — requester or director called it off

CREATE TABLE IF NOT EXISTS coverage_requests (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by    uuid         NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  lab_day_id      uuid                  REFERENCES lab_days(id)  ON DELETE SET NULL,
  date            date         NOT NULL,
  start_time      time         NOT NULL,
  end_time        time         NOT NULL,
  request_type    text         NOT NULL DEFAULT 'lab'
                               CHECK (request_type IN ('lab','class','other')),
  notes           text,
  urgency         text         NOT NULL DEFAULT 'normal'
                               CHECK (urgency IN ('normal','urgent')),
  status          text         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','filled','cancelled')),
  approved_by     uuid                  REFERENCES lab_users(id)    ON DELETE SET NULL,
  approved_at     timestamptz,
  created_shift_id uuid                 REFERENCES open_shifts(id)  ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coverage_requests_status_date
  ON coverage_requests (status, date);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_requester
  ON coverage_requests (requested_by, created_at DESC);

ALTER TABLE coverage_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read coverage requests" ON coverage_requests;
CREATE POLICY "read coverage requests"
  ON coverage_requests FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "write coverage requests" ON coverage_requests;
CREATE POLICY "write coverage requests"
  ON coverage_requests FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  );

COMMENT ON TABLE coverage_requests IS
  'Lead-instructor-filed requests for part-timer coverage. Approver creates an open_shifts row on approval; created_shift_id links the two.';
