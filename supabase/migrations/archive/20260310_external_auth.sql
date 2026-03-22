-- Task 109: Microsoft OAuth — approved external emails + auth_provider tracking
-- ============================================================================

-- 1. Approved external email whitelist
CREATE TABLE IF NOT EXISTS approved_external_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  organization TEXT NOT NULL,
  default_role TEXT DEFAULT 'pending',
  default_scope TEXT[],
  approved_by TEXT NOT NULL,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_approved_external_email
  ON approved_external_emails(email) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_approved_external_domain
  ON approved_external_emails(domain);

-- 2. Add auth_provider column to lab_users
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'google';

-- 3. RLS policies
ALTER TABLE approved_external_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY service_role_approved_external
    ON approved_external_emails FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
