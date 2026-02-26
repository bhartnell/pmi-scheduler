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

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_email);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Announcements: authenticated users can read, admins can write
CREATE POLICY IF NOT EXISTS "announcements_select" ON announcements
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "announcements_insert" ON announcements
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "announcements_update" ON announcements
  FOR UPDATE USING (true);

CREATE POLICY IF NOT EXISTS "announcements_delete" ON announcements
  FOR DELETE USING (true);

-- Announcement reads: users manage their own rows
CREATE POLICY IF NOT EXISTS "announcement_reads_select" ON announcement_reads
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "announcement_reads_insert" ON announcement_reads
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "announcement_reads_upsert" ON announcement_reads
  FOR UPDATE USING (true);
