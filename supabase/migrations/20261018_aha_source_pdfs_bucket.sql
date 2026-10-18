-- Private storage bucket for original AHA source PDFs (case/checklist print-original button).
-- One object per case/checklist, keyed '<case_code>.pdf'. Served only through
-- /api/aha-source-pdfs/[code], which checks the session and returns a short-lived signed URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aha-source-pdfs',
  'aha-source-pdfs',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ROLLBACK:
-- DELETE FROM storage.buckets WHERE id = 'aha-source-pdfs';
-- (Safe only once the bucket is empty; remove uploaded objects via the Storage API/dashboard first.)
