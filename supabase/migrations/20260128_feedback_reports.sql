-- Feedback Reports table for bug reports and feature requests
CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User input
  report_type TEXT NOT NULL DEFAULT 'bug', -- 'bug', 'feature', 'other'
  description TEXT NOT NULL,

  -- Auto-captured
  page_url TEXT,
  user_email TEXT,
  user_agent TEXT,

  -- Status tracking
  status TEXT DEFAULT 'new', -- 'new', 'in_progress', 'resolved', 'wont_fix'
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON feedback_reports(status);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_type ON feedback_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON feedback_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_user ON feedback_reports(user_email);

-- Enable RLS
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can create feedback
CREATE POLICY "Users can create feedback"
  ON feedback_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: All authenticated users can view feedback (for now - can restrict later)
CREATE POLICY "Users can view feedback"
  ON feedback_reports FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Admins can update feedback (for status changes)
CREATE POLICY "Users can update feedback"
  ON feedback_reports FOR UPDATE
  TO authenticated
  USING (true);
