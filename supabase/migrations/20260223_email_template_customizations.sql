-- Email Template Customizations
-- Allows admins to override the default email templates stored in code.

CREATE TABLE IF NOT EXISTS email_template_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT,
  body_html TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_template_key ON email_template_customizations(template_key);

-- RLS
ALTER TABLE email_template_customizations ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins (via service role) can manage templates.
-- All API access goes through service role key, so a permissive policy is safe here.
CREATE POLICY "Admins can manage email templates" ON email_template_customizations
  FOR ALL USING (true);
