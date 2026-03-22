-- 1. Closeout Documents
CREATE TABLE IF NOT EXISTS closeout_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID NOT NULL REFERENCES student_internships(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_url TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_closeout_documents_internship ON closeout_documents(internship_id);

-- 2. Student Internships closeout columns
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- RLS
ALTER TABLE closeout_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closeout_docs_select" ON closeout_documents FOR SELECT USING (true);
CREATE POLICY "closeout_docs_insert" ON closeout_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "closeout_docs_delete" ON closeout_documents FOR DELETE USING (true);
