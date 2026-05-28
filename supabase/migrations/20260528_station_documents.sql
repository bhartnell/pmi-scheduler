-- Station Documents — per-station file attachments
--
-- Mirrors skill_documents (which attach to a skill definition and
-- auto-populate on every station that references the skill). This
-- table is for documents the instructor wants attached to one
-- specific lab_station — e.g. a custom PCR scenario PDF for a
-- documentation station, or a one-off setup guide that doesn't
-- belong on the canonical skill record.
--
-- Both tables surface in the same "Station Documentation" section
-- of EditStationModal and as document chips on StationCards.
-- skill_documents = inherited / canonical; station_documents =
-- ad-hoc / one-day.
--
-- File upload goes to the existing 'station-documents' Supabase
-- storage bucket (already public in production) under path
-- {station_id}/{ts}_{type}.{ext}.

CREATE TABLE IF NOT EXISTS station_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES lab_stations(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'reference'
    CHECK (document_type IN ('skill_sheet', 'checkoff', 'reference', 'protocol')),
  file_type TEXT, -- 'pdf', 'docx', 'image', 'link', etc.
  file_size_bytes INTEGER,
  display_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_station_documents_station
  ON station_documents(station_id);
CREATE INDEX IF NOT EXISTS idx_station_documents_type
  ON station_documents(document_type);

ALTER TABLE station_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read station_documents" ON station_documents;
CREATE POLICY "Anyone can read station_documents" ON station_documents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can manage station_documents" ON station_documents;
CREATE POLICY "Authenticated can manage station_documents" ON station_documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_station_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_station_documents_updated_at ON station_documents;
CREATE TRIGGER trigger_station_documents_updated_at
  BEFORE UPDATE ON station_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_station_documents_updated_at();

COMMENT ON TABLE station_documents IS
  'Ad-hoc documents attached to a specific lab_stations row. Distinct from skill_documents (which attach to skill definitions and inherit onto every station using that skill).';
COMMENT ON COLUMN station_documents.document_type IS
  'Type of document: skill_sheet (step-by-step), checkoff (grading rubric), reference (quick guide), protocol (official protocol).';
COMMENT ON COLUMN station_documents.file_type IS
  'Source/type category: pdf, docx, image, link (URL-only entry), other.';
