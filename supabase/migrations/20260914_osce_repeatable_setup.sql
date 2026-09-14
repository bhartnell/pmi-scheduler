-- Task Handoff Queue: "OSCE event creation in the UI — make it repeatable
-- per cohort (2x/year)". The Fall 2026 event's roster + assessments were
-- built by hand-written SQL (osce_student_schedule.student_name /
-- osce_assessments.student_name are free text with zero student linkage —
-- confirmed live) — exactly the "background building of the process" Ben
-- wants replaced with a UI-driven, cohort-scoped, repeatable flow.
--
-- Additive only: two new nullable/defaulted columns on osce_events, one new
-- child table. Nothing existing changes shape or loses data.

BEGIN;

ALTER TABLE osce_events ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES cohorts(id);
ALTER TABLE osce_events ADD COLUMN IF NOT EXISTS minutes_per_student integer NOT NULL DEFAULT 32;

CREATE INDEX IF NOT EXISTS idx_osce_events_cohort ON osce_events(cohort_id);

-- Per-day scenario assignment (which of A-F run on Day 1 vs Day 2). Lets the
-- roster-generation flow assign each scheduled student a scenario, and lets
-- the UI warn when a scenario is assigned to both days of the same event
-- (a real exam-security concern when the two days aren't consecutive).
CREATE TABLE IF NOT EXISTS osce_day_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES osce_events(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number IN (1, 2)),
  scenario text NOT NULL CHECK (scenario IN ('A', 'B', 'C', 'D', 'E', 'F')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, day_number, scenario)
);

CREATE INDEX IF NOT EXISTS idx_osce_day_scenarios_event ON osce_day_scenarios(event_id);

ALTER TABLE osce_day_scenarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_day_scenarios' AND policyname = 'osce_day_scenarios_all') THEN
    CREATE POLICY "osce_day_scenarios_all" ON osce_day_scenarios FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS osce_day_scenarios;
-- DROP INDEX IF EXISTS idx_osce_events_cohort;
-- ALTER TABLE osce_events DROP COLUMN IF EXISTS minutes_per_student;
-- ALTER TABLE osce_events DROP COLUMN IF EXISTS cohort_id;
-- COMMIT;
