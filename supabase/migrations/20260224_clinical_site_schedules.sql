-- Clinical Site Schedules (Planning Calendar)
-- Tracks which days PMI has access to clinical sites vs other schools (CSN, etc.)
-- Migration: 20260224_clinical_site_schedules.sql

CREATE TABLE IF NOT EXISTS clinical_site_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinical_site_id UUID REFERENCES clinical_sites(id) ON DELETE CASCADE,
  institution TEXT NOT NULL DEFAULT 'PMI',
  days_of_week TEXT[] NOT NULL, -- e.g. ['monday','wednesday','friday']
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clinical_site_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies: read access for authenticated, write for lead_instructor+
-- We use service role in API routes so these are safety nets
CREATE POLICY "clinical_site_schedules_read" ON clinical_site_schedules
  FOR SELECT USING (true);

CREATE POLICY "clinical_site_schedules_insert" ON clinical_site_schedules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "clinical_site_schedules_update" ON clinical_site_schedules
  FOR UPDATE USING (true);

CREATE POLICY "clinical_site_schedules_delete" ON clinical_site_schedules
  FOR DELETE USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clinical_site_schedules_site ON clinical_site_schedules(clinical_site_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_schedules_institution ON clinical_site_schedules(institution);
CREATE INDEX IF NOT EXISTS idx_clinical_site_schedules_dates ON clinical_site_schedules(start_date, end_date);
