-- 20261026_course_agenda_lines.sql
--
-- [Task Handoff Queue: PALS P5c-2a] The PALS day agenda (lessons, breaks,
-- lunch, exam, remediation) lived only in lib/pals-day-structure.ts, so a
-- cohort's PALS days had no lesson rows to show or generate. This adds the
-- course-template storage for it: one row per agenda line, keyed on
-- (course, day_index, line_key), so every PALS cohort (and later ACLS) reads
-- the same editable template instead of a hardcoded one-off.
--
-- line_key matches PalsAgendaBlock.id in lib/pals-day-structure.ts so the
-- existing pals_agenda_instructors rows (keyed on that id) keep lining up.
-- section_key marks the lines that are real lab sections (A-E); the generator
-- takes those blocks' times from the cohort's lab_days rows, not from here
-- (the template times for sections differ from G15's lab_days; see card).
--
-- Seed = lib/pals-day-structure.ts verbatim (AHA 2025 transcription), inserted
-- ON CONFLICT DO NOTHING so a re-run never overwrites later edits.
-- Additive, idempotent, no existing table touched. Reversible (ROLLBACK below).

CREATE TABLE IF NOT EXISTS course_agenda_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course           text NOT NULL CHECK (course IN ('pals', 'acls')),
  day_index        smallint NOT NULL CHECK (day_index >= 1),
  line_key         text NOT NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  start_time       time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  label            text NOT NULL,
  line_type        text NOT NULL CHECK (line_type IN ('lecture', 'practice', 'lab', 'break', 'lunch', 'testing')),
  section_key      text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course, day_index, line_key)
);
CREATE INDEX IF NOT EXISTS idx_course_agenda_lines_course_day
  ON course_agenda_lines (course, day_index, sort_order);

ALTER TABLE course_agenda_lines ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='course_agenda_lines' AND policyname='Authenticated can read course_agenda_lines') THEN
    CREATE POLICY "Authenticated can read course_agenda_lines" ON course_agenda_lines FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

INSERT INTO course_agenda_lines (course, day_index, line_key, sort_order, start_time, duration_minutes, label, line_type, section_key)
VALUES
  ('pals', 1, 'd1-intro', 10, '08:30', 5, 'Course Introduction', 'lecture', NULL),
  ('pals', 1, 'd1-l1', 20, '08:35', 5, 'L1 — Course Overview', 'lecture', NULL),
  ('pals', 1, 'd1-l2', 30, '08:40', 10, 'L2 — Science of Pediatric Resuscitation', 'lecture', NULL),
  ('pals', 1, 'd1-l3a', 40, '08:50', 25, 'L3A — Child High-Quality BLS Practice', 'practice', NULL),
  ('pals', 1, 'd1-l3b', 50, '09:15', 25, 'L3B — Infant High-Quality BLS Practice', 'practice', NULL),
  ('pals', 1, 'd1-l4', 60, '09:40', 30, 'L4 — CPR Coach & High-Performance Teams (hands-on)', 'practice', NULL),
  ('pals', 1, 'd1-break1', 70, '10:10', 10, 'Break', 'break', NULL),
  ('pals', 1, 'd1-l6a', 80, '10:20', 45, 'L6A — Systematic Approach + Assessment Video Cases (11 segments)', 'lecture', NULL),
  ('pals', 1, 'd1-l6b', 90, '11:05', 15, 'L6B — Secondary Assessment', 'lecture', NULL),
  ('pals', 1, 'd1-l7a', 100, '11:20', 15, 'L7A — Management of Respiratory Emergencies', 'lecture', NULL),
  ('pals', 1, 'd1-l7b', 110, '11:35', 25, 'L7B — Respiratory Video Case Discussions', 'lecture', NULL),
  ('pals', 1, 'd1-lunch', 120, '12:00', 60, 'Lunch', 'lunch', NULL),
  ('pals', 1, 'd1-l8a', 130, '13:00', 15, 'L8A — Management of Shock Emergencies', 'lecture', NULL),
  ('pals', 1, 'd1-l8b', 140, '13:15', 25, 'L8B — Shock Video Case Discussions', 'lecture', NULL),
  ('pals', 1, 'd1-l9a', 150, '13:40', 15, 'L9A — Management of Arrhythmia Emergencies', 'lecture', NULL),
  ('pals', 1, 'd1-l9b', 160, '13:55', 25, 'L9B — Arrhythmia Video Case Discussions', 'lecture', NULL),
  ('pals', 1, 'd1-l10', 170, '14:20', 15, 'L10 — Management of Post-Cardiac Arrest Care', 'lecture', NULL),
  ('pals', 1, 'd1-break2', 180, '14:35', 10, 'Break', 'break', NULL),
  ('pals', 1, 'd1-sectiona', 190, '14:45', 60, 'Section A — Learning Stations (3 stations x 20 min)', 'lab', 'A'),
  ('pals', 1, 'd1-break3', 200, '15:45', 5, 'Break', 'break', NULL),
  ('pals', 1, 'd1-sectionb', 210, '15:50', 100, 'Section B — Case Scenario Practice (4 cases)', 'lab', 'B'),
  ('pals', 1, 'd1-end', 220, '17:30', 0, 'End of Day 1', 'lecture', NULL),
  ('pals', 2, 'd2-recap', 10, '08:30', 10, 'Recap / finish unfinished scenarios', 'lecture', NULL),
  ('pals', 2, 'd2-sectionc', 20, '08:40', 100, 'Section C — Case Scenario Practice (4 cases)', 'lab', 'C'),
  ('pals', 2, 'd2-break1', 30, '10:20', 10, 'Break', 'break', NULL),
  ('pals', 2, 'd2-sectiond', 40, '10:30', 100, 'Section D — Case Scenario Practice (4 cases)', 'lab', 'D'),
  ('pals', 2, 'd2-lunch', 50, '12:10', 60, 'Lunch', 'lunch', NULL),
  ('pals', 2, 'd2-sectione', 60, '13:10', 75, 'Section E — Case Scenario Testing (4 stations x 3 rounds x 25 min)', 'testing', 'E'),
  ('pals', 2, 'd2-break2', 70, '14:25', 10, 'Break', 'break', NULL),
  ('pals', 2, 'd2-l14', 80, '14:35', 60, 'L14 — Exam (online via Atlas, >=84%, open-resource)', 'testing', NULL),
  ('pals', 2, 'd2-remediation', 90, '15:35', 60, 'Remediation / retest', 'lecture', NULL),
  ('pals', 2, 'd2-end', 100, '16:35', 0, 'Class ends', 'lecture', NULL)

ON CONFLICT (course, day_index, line_key) DO NOTHING;

-- ROLLBACK:
--   DROP TABLE IF EXISTS course_agenda_lines;
-- (new table only; nothing else is touched. The seed is re-creatable from
-- lib/pals-day-structure.ts.)
