-- Add priority field to feedback_reports
ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

-- Add comment for documentation
COMMENT ON COLUMN feedback_reports.priority IS 'Priority level: critical, high, medium, low';
