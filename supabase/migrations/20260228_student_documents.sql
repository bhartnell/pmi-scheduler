-- Student Document Portal
-- Stores student-uploaded documents and admin document requests.

CREATE TABLE IF NOT EXISTS student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('certificate', 'transcript', 'compliance', 'identification', 'medical', 'other')),
  name TEXT NOT NULL,
  file_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  uploaded_by TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'completed')),
  requested_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_type ON student_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_document_requests_student ON document_requests(student_id);

-- Enable RLS
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role bypasses RLS; anon users have no access
-- API routes use service role key so these are permissive no-ops for service role.
CREATE POLICY IF NOT EXISTS "student_documents_service_role" ON student_documents
  FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "document_requests_service_role" ON document_requests
  FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
