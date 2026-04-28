-- Lab day priority flag — Scheduling Overhaul Phase 1, Part 1.1.
--
-- Lets admins/lead_instructors flag a lab day as 'high' or 'critical'
-- so part-timers can spot ACLS / PALS / NREMT testing days at a glance
-- and prioritise blocking those dates. The reason column is free-form
-- context the calendar surfaces alongside the badge ("ACLS recert",
-- "Guest cardiologist", etc.).
--
-- Defaults to 'normal' so every existing row stays where it is. A
-- CHECK constraint guards the enum values without committing to a
-- pg_enum type — same pattern lab_mode uses (text + CHECK) so we can
-- add new tiers later without a `ALTER TYPE … ADD VALUE` migration.

ALTER TABLE lab_days
  ADD COLUMN IF NOT EXISTS priority_flag text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS priority_reason text;

-- Idempotent CHECK — drop the named constraint if it already exists so
-- re-running the migration is a no-op even after we adjust the enum.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lab_days_priority_flag_check'
  ) THEN
    ALTER TABLE lab_days DROP CONSTRAINT lab_days_priority_flag_check;
  END IF;
END $$;

ALTER TABLE lab_days
  ADD CONSTRAINT lab_days_priority_flag_check
  CHECK (priority_flag IN ('normal', 'high', 'critical'));

-- Partial index — only the flagged rows. Keeps the index tiny while
-- speeding up the "show critical days first" sort on the open-shifts
-- feed and the program calendar.
CREATE INDEX IF NOT EXISTS idx_lab_days_priority_flag
  ON lab_days (priority_flag, date)
  WHERE priority_flag <> 'normal';

COMMENT ON COLUMN lab_days.priority_flag IS
  'Scheduling priority: normal (default), high (heavy lab / guest instructor), critical (ACLS / PALS / NREMT testing). Drives badge rendering on calendars and the open-shift sort order.';

COMMENT ON COLUMN lab_days.priority_reason IS
  'Free-form context shown alongside the priority badge, e.g. "ACLS recert" or "NREMT psychomotor". NULL when priority_flag = normal.';
