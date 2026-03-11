-- Lab Day Debrief Notes: collaborative categorized note thread per lab day
CREATE TABLE IF NOT EXISTS lab_day_debrief_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_day_id UUID NOT NULL REFERENCES lab_days(id) ON DELETE CASCADE,
  author_id UUID REFERENCES lab_users(id),
  author_name TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general','timing','station_feedback','student_performance',
    'equipment','improvement','positive'
  )),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_debrief_notes_lab_day ON lab_day_debrief_notes(lab_day_id);

ALTER TABLE lab_day_debrief_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debrief_notes_all_authenticated" ON lab_day_debrief_notes
  FOR ALL USING (true) WITH CHECK (true);
