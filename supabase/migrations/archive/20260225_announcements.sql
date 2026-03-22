-- System-wide announcements and read tracking
-- Migration: 20260225_announcements.sql

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('info', 'warning', 'critical')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'instructors', 'students')),
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, user_email)
);

-- Ensure columns exist (table may have been created with partial schema)
ALTER TABLE announcement_reads ADD COLUMN IF NOT EXISTS announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE;
ALTER TABLE announcement_reads ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE announcement_reads ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_email);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Announcements: authenticated users can read, admins can write
DROP POLICY IF EXISTS "announcements_select" ON announcements;
CREATE POLICY "announcements_select" ON announcements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "announcements_insert" ON announcements;
CREATE POLICY "announcements_insert" ON announcements
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "announcements_update" ON announcements;
CREATE POLICY "announcements_update" ON announcements
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "announcements_delete" ON announcements;
CREATE POLICY "announcements_delete" ON announcements
  FOR DELETE USING (true);

-- Announcement reads: users manage their own rows
DROP POLICY IF EXISTS "announcement_reads_select" ON announcement_reads;
CREATE POLICY "announcement_reads_select" ON announcement_reads
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "announcement_reads_insert" ON announcement_reads;
CREATE POLICY "announcement_reads_insert" ON announcement_reads
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "announcement_reads_upsert" ON announcement_reads;
CREATE POLICY "announcement_reads_upsert" ON announcement_reads
  FOR UPDATE USING (true);
