-- Migration: deep_link_configs table for Mobile App Deep Links feature
-- Date: 2026-02-28

CREATE TABLE IF NOT EXISTS deep_link_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_pattern TEXT NOT NULL,
  app_scheme TEXT DEFAULT 'pmi',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS
ALTER TABLE deep_link_configs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated reads (any role can fetch deep link configs)
CREATE POLICY IF NOT EXISTS "deep_link_configs_read"
  ON deep_link_configs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow admin writes via service role (API routes use service role)
-- No row-level insert/update policy needed because the API enforces admin check

-- Index for common query
CREATE INDEX IF NOT EXISTS idx_deep_link_configs_route ON deep_link_configs(route_pattern);
CREATE INDEX IF NOT EXISTS idx_deep_link_configs_active ON deep_link_configs(is_active);

-- Seed some sensible defaults
INSERT INTO deep_link_configs (route_pattern, app_scheme, description, is_active)
VALUES
  ('/lab-management/*', 'pmi', 'Lab management pages', true),
  ('/student/*',         'pmi', 'Student portal pages', true),
  ('/clinical/*',        'pmi', 'Clinical tracking pages', true),
  ('/scheduling/*',      'pmi', 'Scheduling pages', true),
  ('/tasks/*',           'pmi', 'Task pages', true)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
