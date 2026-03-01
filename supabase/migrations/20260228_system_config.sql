-- System Configuration table
-- Centralized key-value config store for admin-controlled settings

CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('email', 'notifications', 'security', 'features', 'branding', 'legal')),
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (all access goes through API)
CREATE POLICY IF NOT EXISTS "Service role full access" ON system_config
  FOR ALL USING (true);

-- Seed default configurations
INSERT INTO system_config (config_key, config_value, category, description) VALUES
  ('email_from_address', '"noreply@pmi.edu"', 'email', 'Default from address for system emails'),
  ('email_from_name', '"PMI EMS Scheduler"', 'email', 'Default from name for system emails'),
  ('email_reply_to', '"noreply@pmi.edu"', 'email', 'Reply-to address for system emails'),
  ('notification_default_email', 'true', 'notifications', 'Enable email notifications by default'),
  ('notification_default_inapp', 'true', 'notifications', 'Enable in-app notifications by default'),
  ('notification_digest_frequency', '"daily"', 'notifications', 'Digest frequency: never, daily, weekly'),
  ('session_timeout_hours', '24', 'security', 'Default session timeout in hours'),
  ('require_2fa_admins', 'false', 'security', 'Require 2FA for admin users'),
  ('max_login_attempts', '5', 'security', 'Max failed login attempts before lockout'),
  ('enable_student_self_scheduling', 'true', 'features', 'Allow students to sign up for lab slots'),
  ('enable_peer_evaluations', 'true', 'features', 'Enable peer evaluation system'),
  ('enable_2fa', 'true', 'features', 'Enable two-factor authentication option'),
  ('enable_guest_access', 'true', 'features', 'Allow guest access for external observers'),
  ('enable_clinical_tracking', 'true', 'features', 'Enable clinical hours tracking module'),
  ('enable_time_clock', 'true', 'features', 'Enable instructor time clock'),
  ('app_name', '"PMI EMS Scheduler"', 'branding', 'Application display name'),
  ('app_logo_url', '""', 'branding', 'Custom logo URL (leave empty for default)'),
  ('app_primary_color', '"#2563eb"', 'branding', 'Primary brand color (hex)'),
  ('terms_url', '""', 'legal', 'Terms of Service URL'),
  ('privacy_url', '""', 'legal', 'Privacy Policy URL'),
  ('cookie_policy_url', '""', 'legal', 'Cookie Policy URL')
ON CONFLICT (config_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
