CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  data_source TEXT NOT NULL,
  columns TEXT[] NOT NULL,
  filters JSONB DEFAULT '[]',
  sort_by TEXT,
  sort_direction TEXT DEFAULT 'asc',
  group_by TEXT,
  is_shared BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_report_templates_creator ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_shared ON report_templates(is_shared);

NOTIFY pgrst, 'reload schema';
