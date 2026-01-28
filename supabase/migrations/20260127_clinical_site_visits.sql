-- Clinical Site Visit Log Tables
-- Tracks instructor visits to clinical sites where students are placed

-- 1. Clinical Sites (hospitals/facilities)
CREATE TABLE IF NOT EXISTS clinical_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  system TEXT, -- 'Valley Health System', 'Dignity Health', etc.
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_sites_active ON clinical_sites(is_active);
CREATE INDEX IF NOT EXISTS idx_clinical_sites_system ON clinical_sites(system);

-- 2. Clinical Site Departments (which departments are available at each site)
CREATE TABLE IF NOT EXISTS clinical_site_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES clinical_sites(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, department)
);

CREATE INDEX IF NOT EXISTS idx_clinical_site_departments_site ON clinical_site_departments(site_id);

-- 3. Clinical Site Visits (the log entries)
CREATE TABLE IF NOT EXISTS clinical_site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES clinical_sites(id) ON DELETE RESTRICT,
  departments TEXT[] NOT NULL DEFAULT '{}', -- Array of department names
  visitor_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL, -- Denormalized for display
  visit_date DATE NOT NULL,
  visit_time TIME,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  entire_class BOOLEAN DEFAULT false,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT -- Email of creator
);

CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_site ON clinical_site_visits(site_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_date ON clinical_site_visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_cohort ON clinical_site_visits(cohort_id);
CREATE INDEX IF NOT EXISTS idx_clinical_site_visits_visitor ON clinical_site_visits(visitor_id);

-- 4. Clinical Visit Students (junction table - which students were visited)
CREATE TABLE IF NOT EXISTS clinical_visit_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES clinical_site_visits(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(visit_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_clinical_visit_students_visit ON clinical_visit_students(visit_id);
CREATE INDEX IF NOT EXISTS idx_clinical_visit_students_student ON clinical_visit_students(student_id);

-- RLS Policies
ALTER TABLE clinical_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_site_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_visit_students ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access (PMI staff)
CREATE POLICY "Allow all access to clinical_sites" ON clinical_sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to clinical_site_departments" ON clinical_site_departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to clinical_site_visits" ON clinical_site_visits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to clinical_visit_students" ON clinical_visit_students FOR ALL USING (true) WITH CHECK (true);

-- Seed data: Clinical Sites
INSERT INTO clinical_sites (name, abbreviation, system) VALUES
  ('Spring Valley Hospital', 'SVH', 'Valley Health System'),
  ('Centennial Hills Hospital', 'CHH', 'Valley Health System'),
  ('ER at Blue Diamond', 'BD', 'Valley Health System'),
  ('ER at Valley Vista', 'VV', 'Valley Health System'),
  ('Summerlin Hospital', 'SHMC', 'Valley Health System'),
  ('West Henderson Hospital', 'WHH', 'Valley Health System'),
  ('St Rose Siena', 'Siena', 'Dignity Health')
ON CONFLICT DO NOTHING;

-- Seed data: Departments for each site
-- Spring Valley Hospital (SVH)
INSERT INTO clinical_site_departments (site_id, department)
SELECT id, dept FROM clinical_sites, unnest(ARRAY['ER', 'OR', 'Psych', 'ICU', 'Cath Lab']) AS dept
WHERE abbreviation = 'SVH'
ON CONFLICT DO NOTHING;

-- Centennial Hills Hospital (CHH)
INSERT INTO clinical_site_departments (site_id, department)
SELECT id, dept FROM clinical_sites, unnest(ARRAY['OR', 'L&D']) AS dept
WHERE abbreviation = 'CHH'
ON CONFLICT DO NOTHING;

-- ER at Blue Diamond (BD)
INSERT INTO clinical_site_departments (site_id, department)
SELECT id, dept FROM clinical_sites, unnest(ARRAY['ER']) AS dept
WHERE abbreviation = 'BD'
ON CONFLICT DO NOTHING;

-- ER at Valley Vista (VV)
INSERT INTO clinical_site_departments (site_id, department)
SELECT id, dept FROM clinical_sites, unnest(ARRAY['ER']) AS dept
WHERE abbreviation = 'VV'
ON CONFLICT DO NOTHING;

-- Summerlin Hospital (SHMC)
INSERT INTO clinical_site_departments (site_id, department)
SELECT id, dept FROM clinical_sites, unnest(ARRAY['Peds ER', 'PICU']) AS dept
WHERE abbreviation = 'SHMC'
ON CONFLICT DO NOTHING;

-- West Henderson Hospital (WHH)
INSERT INTO clinical_site_departments (site_id, department)
SELECT id, dept FROM clinical_sites, unnest(ARRAY['ER']) AS dept
WHERE abbreviation = 'WHH'
ON CONFLICT DO NOTHING;

-- St Rose Siena
INSERT INTO clinical_site_departments (site_id, department)
SELECT id, dept FROM clinical_sites, unnest(ARRAY['ER', 'OR', 'Peds ER', 'L&D']) AS dept
WHERE abbreviation = 'Siena'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE clinical_sites IS 'Clinical sites (hospitals/facilities) where students are placed';
COMMENT ON TABLE clinical_site_departments IS 'Departments available at each clinical site';
COMMENT ON TABLE clinical_site_visits IS 'Log of instructor visits to clinical sites';
COMMENT ON TABLE clinical_visit_students IS 'Junction table linking visits to specific students';
