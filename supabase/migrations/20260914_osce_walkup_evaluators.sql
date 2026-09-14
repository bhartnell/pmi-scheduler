-- OSCE walk-up evaluator self-registration.
--
-- Problem: the evaluator PIN-entry flow (app/osce-scoring/enter,
-- /api/osce/validate-pin) only lists pre-registered osce_observers +
-- lab_users faculty. When an agency sends someone who isn't on that
-- closed list (Spring 2026 incident: LVFR sent unlisted evaluators who
-- had to grade under someone else's guest login), there was no way for
-- them to identify themselves — wrong attribution on assessment records.
--
-- This adds a minimal, separate table for self-reported walk-up
-- evaluators (name/agency/role only — no email, no token, no OAuth, per
-- Ben's explicit direction) so they can be told apart from pre-registered
-- observers on the record and reconciled afterward in the admin UI.
--
-- Not folded into osce_observers: that table requires NOT NULL UNIQUE
-- email and ties rows to time-block reservations, neither of which
-- applies to someone who shows up unannounced on event day.
--
-- Additive only — new table, no changes to existing tables/constraints.
-- No backfill, no data loss, no --backup needed.

CREATE TABLE IF NOT EXISTS osce_walkup_evaluators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES osce_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  agency TEXT NOT NULL,
  role TEXT CHECK (role IN ('md', 'faculty', 'agency')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE osce_walkup_evaluators ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_walkup_evaluators' AND policyname = 'osce_walkup_evaluators_public_insert') THEN
    CREATE POLICY "osce_walkup_evaluators_public_insert" ON osce_walkup_evaluators FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_walkup_evaluators' AND policyname = 'osce_walkup_evaluators_service_all') THEN
    CREATE POLICY "osce_walkup_evaluators_service_all" ON osce_walkup_evaluators FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_osce_walkup_evaluators_event ON osce_walkup_evaluators(event_id);

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_osce_walkup_evaluators_event;
-- DROP TABLE IF EXISTS osce_walkup_evaluators;
