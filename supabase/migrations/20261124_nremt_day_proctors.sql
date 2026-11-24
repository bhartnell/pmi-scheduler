-- NREMT per-day proctor list (card 4225cd1c). Additive only.
-- A person on the list for an NREMT testing day gets stations-only access to that day's
-- hub and grading, from the start of the day BEFORE through the end of the lab day (Pacific).
-- Rows are never deleted: removal sets removed = true.
CREATE TABLE IF NOT EXISTS nremt_day_proctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id uuid NOT NULL REFERENCES lab_days(id),
  lab_user_id uuid REFERENCES lab_users(id),
  email text NOT NULL,
  name text,
  added_by text,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed boolean NOT NULL DEFAULT false,
  removed_at timestamptz,
  removed_by text
);

-- One live row per person per day.
CREATE UNIQUE INDEX IF NOT EXISTS nremt_day_proctors_live_uniq
  ON nremt_day_proctors (lab_day_id, lower(email)) WHERE removed = false;
CREATE INDEX IF NOT EXISTS nremt_day_proctors_email_idx
  ON nremt_day_proctors (lower(email)) WHERE removed = false;

-- Server-side access only (service role bypasses RLS); no policies = no public API access.
ALTER TABLE nremt_day_proctors ENABLE ROW LEVEL SECURITY;

-- ROLLBACK: DROP TABLE IF EXISTS nremt_day_proctors;  (new table, nothing else references it)
