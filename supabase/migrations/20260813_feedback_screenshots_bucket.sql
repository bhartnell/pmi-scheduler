-- Create the 'feedback-screenshots' storage bucket referenced by app/api/feedback/route.ts.
-- The screenshot_url column (added in archive/20260226_feedback_screenshots.sql) has never
-- been populated because this bucket was never created manually as that migration's
-- instructions required — uploads fail with "Bucket not found" and the error is swallowed
-- as non-fatal, so screenshots silently drop while the rest of the feedback report still saves.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-screenshots',
  'feedback-screenshots',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- ROLLBACK:
-- DELETE FROM storage.buckets WHERE id = 'feedback-screenshots';
-- (Safe only once the bucket is empty; remove any uploaded objects first via the
-- Storage API/dashboard, since a non-empty bucket cannot be deleted.)
