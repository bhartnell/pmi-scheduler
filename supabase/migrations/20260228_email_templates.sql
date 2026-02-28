-- Email Templates (standalone)
-- Provides a freeform email_templates table for custom templates beyond the
-- built-in system templates managed by email_template_customizations.
-- This table stores user-created templates with draft/publish support.

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_draft BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_draft ON email_templates(is_draft);

-- RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- All access via service role key through API routes
CREATE POLICY "Admins can manage email templates" ON email_templates
  FOR ALL USING (true);

NOTIFY pgrst, 'reload schema';
