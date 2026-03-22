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

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE resources ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS min_role TEXT DEFAULT 'instructor';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS linked_skill_ids TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS linked_scenario_ids TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

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

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES resources(id) ON DELETE CASCADE;
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS version INTEGER;
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE resource_versions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_resource_versions_resource ON resource_versions(resource_id);

-- Enable RLS on both tables
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_versions ENABLE ROW LEVEL SECURITY;

-- Service role bypass (API routes use service role)
DROP POLICY IF EXISTS "Service role can do everything on resources" ON resources;
CREATE POLICY "Service role can do everything on resources"
  ON resources FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can do everything on resource_versions" ON resource_versions;
CREATE POLICY "Service role can do everything on resource_versions"
  ON resource_versions FOR ALL
  USING (true)
  WITH CHECK (true);
