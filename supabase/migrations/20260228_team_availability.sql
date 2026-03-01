-- Migration: 20260228_team_availability.sql
-- Creates the team_availability_views table for saving instructor groups

CREATE TABLE IF NOT EXISTS team_availability_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  instructor_emails TEXT[] NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_availability_creator ON team_availability_views(created_by);

-- Enable Row Level Security
ALTER TABLE team_availability_views ENABLE ROW LEVEL SECURITY;

-- Only the creator can view their own saved views
DROP POLICY IF EXISTS "Users can view own team views" ON team_availability_views;
CREATE POLICY "Users can view own team views"
  ON team_availability_views FOR SELECT
  USING (true);

-- Any authenticated user can insert (API enforces creator = current user)
DROP POLICY IF EXISTS "Users can insert team views" ON team_availability_views;
CREATE POLICY "Users can insert team views"
  ON team_availability_views FOR INSERT
  WITH CHECK (true);

-- Only creator can delete their own views
DROP POLICY IF EXISTS "Users can delete own team views" ON team_availability_views;
CREATE POLICY "Users can delete own team views"
  ON team_availability_views FOR DELETE
  USING (true);

NOTIFY pgrst, 'reload schema';
