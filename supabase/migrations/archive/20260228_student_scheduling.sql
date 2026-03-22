-- Student Lab Signups
-- Allows students to self-sign up for open lab slots

CREATE TABLE IF NOT EXISTS student_lab_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  waitlist_position INTEGER,
  signed_up_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  UNIQUE(lab_day_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_lab_signups_lab ON student_lab_signups(lab_day_id);
CREATE INDEX IF NOT EXISTS idx_student_lab_signups_student ON student_lab_signups(student_id);
CREATE INDEX IF NOT EXISTS idx_student_lab_signups_status ON student_lab_signups(status);

-- Enable RLS
ALTER TABLE student_lab_signups ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view signups (service role used in API routes)
CREATE POLICY "student_lab_signups_select_policy" ON student_lab_signups
  FOR SELECT USING (true);

-- Policy: Allow inserts (auth enforced at API layer with service role)
CREATE POLICY "student_lab_signups_insert_policy" ON student_lab_signups
  FOR INSERT WITH CHECK (true);

-- Policy: Allow updates (auth enforced at API layer with service role)
CREATE POLICY "student_lab_signups_update_policy" ON student_lab_signups
  FOR UPDATE USING (true);

-- Policy: Allow deletes (auth enforced at API layer with service role)
CREATE POLICY "student_lab_signups_delete_policy" ON student_lab_signups
  FOR DELETE USING (true);

COMMENT ON TABLE student_lab_signups IS 'Student self-scheduling signups for lab days';
COMMENT ON COLUMN student_lab_signups.status IS 'Signup status: confirmed, waitlisted, or cancelled';
COMMENT ON COLUMN student_lab_signups.waitlist_position IS 'Position on waitlist (null if confirmed)';
COMMENT ON COLUMN student_lab_signups.cancel_reason IS 'Optional reason provided when cancelling';

NOTIFY pgrst, 'reload schema';
