CREATE TABLE IF NOT EXISTS closeout_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID REFERENCES student_internships(id) ON DELETE CASCADE,
  survey_type TEXT NOT NULL CHECK (survey_type IN ('hospital_preceptor', 'field_preceptor')),
  preceptor_name TEXT,
  agency_name TEXT,
  responses JSONB NOT NULL,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closeout_surveys_internship ON closeout_surveys(internship_id);

ALTER TABLE closeout_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surveys_select" ON closeout_surveys FOR SELECT USING (true);
CREATE POLICY "surveys_insert" ON closeout_surveys FOR INSERT WITH CHECK (true);
CREATE POLICY "surveys_update" ON closeout_surveys FOR UPDATE USING (true);
CREATE POLICY "surveys_delete" ON closeout_surveys FOR DELETE USING (true);
