-- Resource Library: central document repository for program materials

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('protocols', 'skill_sheets', 'policies', 'forms', 'other')),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('file', 'link')),
  url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  version INTEGER DEFAULT 1,
  uploaded_by TEXT NOT NULL,
  min_role TEXT DEFAULT 'instructor',
  linked_skill_ids TEXT[],
  linked_scenario_ids TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON resources(uploaded_by);

CREATE TABLE IF NOT EXISTS resource_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  file_path TEXT,
  file_name TEXT,
  url TEXT,
  uploaded_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_versions_resource ON resource_versions(resource_id);

-- Enable RLS on both tables
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_versions ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API routes use service role)
CREATE POLICY IF NOT EXISTS "Service role can do everything on resources"
  ON resources FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can do everything on resource_versions"
  ON resource_versions FOR ALL
  USING (true)
  WITH CHECK (true);
