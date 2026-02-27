-- Add screenshot_url column to feedback_reports table
-- The file is stored in Supabase storage bucket 'feedback-screenshots'
-- and the public URL is saved here.
--
-- NOTE: The storage bucket 'feedback-screenshots' must be created manually in Supabase:
--   1. Go to Supabase dashboard > Storage
--   2. Create a new bucket named 'feedback-screenshots'
--   3. Set it to Public (so URLs are accessible without auth)
--   4. Optionally add a file size limit of 5MB and allow image/png, image/jpeg MIME types

ALTER TABLE feedback_reports ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
