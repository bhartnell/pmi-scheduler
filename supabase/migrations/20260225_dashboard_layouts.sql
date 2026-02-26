-- Dashboard layout persistence
-- Stores per-user customized widget layouts synced across devices
-- Also stores admin-configured role-based default layouts

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  layout JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_email ON dashboard_layouts(user_email);

-- Row Level Security
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own layout row
CREATE POLICY IF NOT EXISTS "dashboard_layouts_self_access"
  ON dashboard_layouts
  FOR ALL
  USING (user_email = current_setting('app.current_user_email', true));

-- Default layouts per role (admin can customize these)
CREATE TABLE IF NOT EXISTS dashboard_default_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL UNIQUE,
  layout JSONB NOT NULL DEFAULT '{}',
  set_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_default_layouts_role ON dashboard_default_layouts(role);

-- Row Level Security
ALTER TABLE dashboard_default_layouts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read defaults (needed for fallback logic)
CREATE POLICY IF NOT EXISTS "dashboard_default_layouts_read"
  ON dashboard_default_layouts
  FOR SELECT
  USING (true);
