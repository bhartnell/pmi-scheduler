-- Skill Documents table for permanent document attachments to skill definitions
-- Documents attached here auto-populate when skill is selected for a station

CREATE TABLE IF NOT EXISTS skill_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'reference'
    CHECK (document_type IN ('skill_sheet', 'checkoff', 'reference', 'protocol')),
  file_type TEXT, -- 'pdf', 'docx', 'image', etc.
  file_size_bytes INTEGER,
  display_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_skill_documents_skill ON skill_documents(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_documents_type ON skill_documents(document_type);

-- Enable RLS
ALTER TABLE skill_documents ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access (admins can manage, everyone can read)
CREATE POLICY "Anyone can read skill_documents" ON skill_documents
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage skill_documents" ON skill_documents
  FOR ALL USING (true) WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_skill_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_skill_documents_updated_at ON skill_documents;
CREATE TRIGGER trigger_skill_documents_updated_at
  BEFORE UPDATE ON skill_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_skill_documents_updated_at();

COMMENT ON TABLE skill_documents IS 'Documents permanently attached to skill definitions. Auto-populate when skill is selected for a station.';
COMMENT ON COLUMN skill_documents.document_type IS 'Type of document: skill_sheet (step-by-step), checkoff (grading rubric), reference (quick guide), protocol (official protocol)';
