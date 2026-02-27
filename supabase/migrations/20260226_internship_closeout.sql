-- Closeout documents table
CREATE TABLE IF NOT EXISTS closeout_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  internship_id UUID NOT NULL REFERENCES student_internships(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('completion_form', 'preceptor_eval', 'field_docs', 'exam_results', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closeout_docs_internship ON closeout_documents(internship_id);

-- Add completion columns to student_internships if not exists
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- RLS
ALTER TABLE closeout_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closeout_docs_select" ON closeout_documents FOR SELECT USING (true);
CREATE POLICY "closeout_docs_insert" ON closeout_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "closeout_docs_delete" ON closeout_documents FOR DELETE USING (true);
