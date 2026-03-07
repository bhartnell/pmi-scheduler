-- Track which fields were AI-generated and review status
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS ai_generated_fields TEXT[] DEFAULT '{}';
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS content_review_status TEXT DEFAULT 'approved' CHECK (content_review_status IN ('approved', 'pending_review', 'rejected'));
CREATE INDEX IF NOT EXISTS idx_scenarios_review_status ON scenarios(content_review_status);
NOTIFY pgrst, 'reload schema';
