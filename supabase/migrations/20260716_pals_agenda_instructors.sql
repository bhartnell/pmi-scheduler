-- PALS Hub: reference-only instructor assignment for the day-of DIDACTIC/
-- VIDEO LESSON ROWS (L1-L10 style). Task Handoff Queue: "PALS hub -
-- instructor picker on DIDACTIC AGENDA ROWS" — mirrors the existing
-- lab_stations.instructor_name reference-only pattern (PR #46, lab station
-- cards) applied to the lecture/didactic agenda instead.
--
-- WHY A NEW TABLE: the agenda rows (lib/pals-day-structure.ts) are static,
-- code-only reference data with no DB row/id at all (see that file's header
-- comment) — there is nothing existing to attach instructor_name to. This
-- table gives each (cohort, date, block) a place to record who's teaching
-- it, without touching the static agenda content itself.
--
-- Cohort-scoped per the Repeatability Rule (works for every PALS cohort
-- automatically, not a one-off keyed to a single date). Reference-only: no
-- calendar/availability connection, no writes to pmi_schedule_blocks or
-- Google Calendar — exactly like the station picker it mirrors.
--
-- Additive & idempotent (IF NOT EXISTS). Reversible (see ROLLBACK below).

CREATE TABLE IF NOT EXISTS pals_agenda_instructors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id       uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  date            date NOT NULL,
  block_id        text NOT NULL,          -- stable id from lib/pals-day-structure.ts PalsAgendaBlock.id
  instructor_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, date, block_id)
);
CREATE INDEX IF NOT EXISTS idx_pals_agenda_instructors_cohort_date
  ON pals_agenda_instructors (cohort_id, date);

ALTER TABLE pals_agenda_instructors ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pals_agenda_instructors' AND policyname='Authenticated can read pals_agenda_instructors') THEN
    CREATE POLICY "Authenticated can read pals_agenda_instructors" ON pals_agenda_instructors FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

COMMENT ON TABLE pals_agenda_instructors IS 'Reference-only instructor assignment per PALS day-of agenda lesson block (cohort_id+date+block_id unique). Mirrors lab_stations.instructor_name (PR #46) for rows that have no other DB backing — the agenda itself is static reference data in lib/pals-day-structure.ts. No calendar/availability side effects.';

-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_pals_agenda_instructors_cohort_date;
--   DROP TABLE IF EXISTS pals_agenda_instructors;
