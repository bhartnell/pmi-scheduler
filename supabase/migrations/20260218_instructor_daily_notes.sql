-- Instructor Daily Notes / Journal
-- Created: 2026-02-18
-- Purpose: Free-text daily feedback/journal entries on calendar dates

-- ============================================
-- Instructor Daily Notes Table
-- One note per instructor per date
-- ============================================
CREATE TABLE IF NOT EXISTS instructor_daily_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID REFERENCES lab_users(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One note per instructor per date
  UNIQUE(instructor_id, note_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_notes_instructor_date ON instructor_daily_notes(instructor_id, note_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON instructor_daily_notes(note_date DESC);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE instructor_daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_notes_select_policy" ON instructor_daily_notes
  FOR SELECT USING (true);

CREATE POLICY "daily_notes_insert_policy" ON instructor_daily_notes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "daily_notes_update_policy" ON instructor_daily_notes
  FOR UPDATE USING (true);

CREATE POLICY "daily_notes_delete_policy" ON instructor_daily_notes
  FOR DELETE USING (true);
