-- Mapping table: pmi recurring_group_id (or single block_id) → Google
-- Calendar event id on the SHARED calendar.
--
-- Distinct from google_calendar_events which maps per-user-event for
-- the legacy per-user sync pattern. This table is for the shared
-- "Pima EMS Programs Schedule" calendar where:
--   - One Google recurring event per recurring_group_id (a series of
--     same-day-of-week blocks like "EMS 121 Pharmacology lecture
--     every Thursday for 15 weeks")
--   - Single block_id mapping for one-off blocks without a series
--   - Instructor added as ATTENDEE on the series so they get a
--     guest invite once instead of N times
--
-- Updates flow:
--   - instructor_id on a block changes → look up the mapping by
--     recurring_group_id, PATCH the Google event's attendees
--   - blocks added/removed from a series → re-push the whole series
--     (idempotent: cleans up the old Google event first, creates new)
--   - Block becomes cancelled → DELETE the Google event + mapping
--
-- The unique constraint on google_event_id catches the (rare) case
-- where two PMI series accidentally point at the same Google event.

CREATE TABLE IF NOT EXISTS shared_calendar_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source key: either a recurring series OR a single block. CHECK
  -- below enforces exactly one is set.
  recurring_group_id  uuid,
  block_id            uuid REFERENCES pmi_schedule_blocks(id) ON DELETE CASCADE,
  -- Google Calendar identifiers.
  google_event_id     text NOT NULL,
  google_calendar_id  text NOT NULL,
  -- Snapshot of what was synced. instructor_id can be null when no
  -- instructor is assigned (the event still posts to the shared
  -- calendar but without a guest); semester_id helps the bulk-sync
  -- endpoint scope re-pushes.
  instructor_id       uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  semester_id         uuid REFERENCES pmi_semesters(id) ON DELETE SET NULL,
  -- Last successful push, useful for debugging when the cron
  -- inevitably runs against stale state.
  last_synced_at      timestamptz NOT NULL DEFAULT now(),
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (recurring_group_id IS NOT NULL AND block_id IS NULL)
    OR (recurring_group_id IS NULL AND block_id IS NOT NULL)
  )
);

-- One Google event per source entity. Re-running the sync should
-- update the existing row, not create duplicates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_cal_events_unique_recurring'
  ) THEN
    CREATE UNIQUE INDEX shared_cal_events_unique_recurring
      ON shared_calendar_events (recurring_group_id, google_calendar_id)
      WHERE recurring_group_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shared_cal_events_unique_block'
  ) THEN
    CREATE UNIQUE INDEX shared_cal_events_unique_block
      ON shared_calendar_events (block_id, google_calendar_id)
      WHERE block_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shared_cal_events_semester
  ON shared_calendar_events (semester_id);
CREATE INDEX IF NOT EXISTS idx_shared_cal_events_google_event
  ON shared_calendar_events (google_event_id);

COMMENT ON TABLE shared_calendar_events IS
  'Per-series mappings to the shared "Pima EMS Programs Schedule" Google Calendar. One row per recurring_group_id (or per block_id for one-offs). Drives idempotent re-pushes — sync looks up by source key, PATCHes existing Google event vs creating a new one.';
