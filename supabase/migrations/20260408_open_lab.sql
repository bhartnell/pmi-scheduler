-- Open Lab feature: sessions, signups, and instructor flag
-- Allows students to sign up for weekly drop-in practice sessions

-- 1. Open Lab Sessions table
CREATE TABLE IF NOT EXISTS open_lab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  start_time TIME NOT NULL DEFAULT '13:00',
  end_time TIME NOT NULL DEFAULT '16:00',
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_open_lab_sessions_date ON open_lab_sessions(date);

-- 2. Open Lab Signups table
CREATE TABLE IF NOT EXISTS open_lab_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES open_lab_sessions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  student_user_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  program_level TEXT NOT NULL CHECK (program_level IN ('EMT', 'AEMT', 'Paramedic')),
  what_to_work_on TEXT NOT NULL,
  requested_instructor_id UUID REFERENCES lab_users(id) ON DELETE SET NULL,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edit_token UUID NOT NULL DEFAULT gen_random_uuid(),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_open_lab_signups_session ON open_lab_signups(session_id);
CREATE INDEX IF NOT EXISTS idx_open_lab_signups_email ON open_lab_signups(student_email);
CREATE INDEX IF NOT EXISTS idx_open_lab_signups_token ON open_lab_signups(edit_token);
CREATE INDEX IF NOT EXISTS idx_open_lab_signups_user ON open_lab_signups(student_user_id);

-- 3. Add is_open_lab_instructor flag to lab_users
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS is_open_lab_instructor BOOLEAN NOT NULL DEFAULT false;

-- 4. Tag known open lab instructors
UPDATE lab_users SET is_open_lab_instructor = true
WHERE lower(email) IN (
  'bhartnell@pmi.edu',
  'rniedfeldt@pmi.edu',
  'ryyoung@pmi.edu',
  'mschafer@pmi.edu',
  'jlomonaco@pmi.edu',
  'stpeterson@pmi.edu'
);

-- 5. RLS policies
ALTER TABLE open_lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_lab_signups ENABLE ROW LEVEL SECURITY;

-- Sessions: public read, authenticated write
CREATE POLICY "open_lab_sessions_public_read" ON open_lab_sessions
  FOR SELECT USING (true);

CREATE POLICY "open_lab_sessions_authenticated_write" ON open_lab_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Signups: public insert, public select (for counts), token-based update/delete
CREATE POLICY "open_lab_signups_public_insert" ON open_lab_signups
  FOR INSERT WITH CHECK (true);

CREATE POLICY "open_lab_signups_public_read" ON open_lab_signups
  FOR SELECT USING (true);

CREATE POLICY "open_lab_signups_public_update" ON open_lab_signups
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "open_lab_signups_public_delete" ON open_lab_signups
  FOR DELETE USING (true);
