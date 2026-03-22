-- 1. Deep Links (app configuration)
CREATE TABLE IF NOT EXISTS app_deep_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_pattern TEXT NOT NULL,
  app_scheme TEXT DEFAULT 'pmi',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
NOTIFY pgrst, 'reload schema';
