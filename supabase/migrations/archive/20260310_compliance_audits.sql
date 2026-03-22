-- Task 110: Compliance Audit Tracking & Reminder System
-- =====================================================

-- 1. Compliance audit types (master list of 8 audits)
CREATE TABLE IF NOT EXISTS compliance_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_type TEXT NOT NULL UNIQUE,
  frequency TEXT NOT NULL CHECK (frequency IN ('per_deploy','per_migration','monthly','quarterly','per_enrollment')),
  tool_method TEXT,
  description TEXT,
  last_completed_at TIMESTAMPTZ,
  last_completed_by TEXT,
  last_result TEXT CHECK (last_result IN ('pass','fail','info','n_a')),
  last_findings TEXT,
  last_actions TEXT,
  next_due_at TIMESTAMPTZ,
  is_overdue BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Audit history log
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID REFERENCES compliance_audits(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  completed_by TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('pass','fail','info','n_a')),
  findings TEXT,
  actions_taken TEXT,
  script_output JSONB,
  next_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE compliance_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY compliance_audits_service ON compliance_audits FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY compliance_audit_log_service ON compliance_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_audit ON compliance_audit_log(audit_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_date ON compliance_audit_log(completed_at DESC);

-- 5. Seed the 8 audit types
INSERT INTO compliance_audits (audit_type, frequency, tool_method, description, next_due_at) VALUES
  ('API Permission Audit', 'per_deploy', 'audit-permissions-gen.js', 'Scan all API routes for proper auth enforcement', NULL),
  ('FK Ambiguity Check', 'per_migration', 'check-fk-ambiguity.js', 'Check for ambiguous PostgREST FK joins after schema changes', NULL),
  ('Dead Code Scan', 'monthly', 'Automated codebase scan', 'Find unused imports, orphaned files, stale TODOs', NOW() + INTERVAL '30 days'),
  ('Role Assignment Review', 'quarterly', 'Admin user list review', 'Verify all users have appropriate roles, no stale pending accounts', NOW() + INTERVAL '90 days'),
  ('Agency Access Log Review', 'monthly', 'record_access_log query', 'Review agency user access patterns to student records', NOW() + INTERVAL '30 days'),
  ('Export Activity Review', 'monthly', 'Export and email log analysis', 'Review all data exports for appropriate scope and authorization', NOW() + INTERVAL '30 days'),
  ('External Email Audit', 'quarterly', 'approved_external_emails review', 'Verify external email list is current, remove stale entries', NOW() + INTERVAL '90 days'),
  ('FERPA Release Verification', 'per_enrollment', 'Student record review', 'Verify all students with agency access have signed FERPA releases', NULL)
ON CONFLICT (audit_type) DO NOTHING;
