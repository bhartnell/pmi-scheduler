-- LVFR platoon calendar — shared 48/96 rotation across A/B/C platoons.
--
-- Two consumers:
--   1. Personal-mode coordinator calendar — Jimi (A-shift) sees a
--      gray "on duty @ LVFR" overlay on his A-shift days so he can
--      see PMI shifts alongside his fire commitments at a glance.
--      Does NOT mark him unavailable for PMI — informational only.
--   2. Internship tracking — verifies a student's clinical shifts
--      align with their preceptor's platoon. e.g. preceptor is
--      A-shift, student schedules a Tuesday on a B-shift day —
--      mismatch flag in the UI.
--
-- Data model: ONE row per date, with the resolved platoon. Seeded
-- algorithmically (48 hours on, 96 hours off, repeating every 6
-- days). B-shift offset +2 days from A; C-shift offset +4 days.
-- Anchor: 2026-01-02 = first A-shift day per the official platoon
-- calendar PDF. Once seeded, individual rows are editable for
-- holidays / BID days / shift swaps without re-running the seed.

CREATE TABLE IF NOT EXISTS lvfr_platoon_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL UNIQUE,
  platoon     text NOT NULL,
  is_bid_day  boolean NOT NULL DEFAULT false,
  notes       text,
  year        integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lvfr_platoon_schedule_platoon_check'
  ) THEN
    ALTER TABLE lvfr_platoon_schedule
      DROP CONSTRAINT lvfr_platoon_schedule_platoon_check;
  END IF;
END $$;

ALTER TABLE lvfr_platoon_schedule
  ADD CONSTRAINT lvfr_platoon_schedule_platoon_check
  CHECK (platoon IN ('A', 'B', 'C', 'off'));

CREATE INDEX IF NOT EXISTS idx_lvfr_platoon_schedule_year
  ON lvfr_platoon_schedule (year, date);

-- Seed full 2026 calendar from the 48/96 rotation algorithm. Skips
-- any dates that already exist (so re-running the migration after
-- manual overrides preserves them). Computed inside a DO block so
-- generate_series + the platoon math live in one statement.
--
-- Pattern: 6-day cycle, two days per platoon.
--   Day mod 6 in {0,1} → A
--   Day mod 6 in {2,3} → B
--   Day mod 6 in {4,5} → C
DO $$
DECLARE
  anchor date := '2026-01-02';
  d date;
  cycle_pos int;
  shift text;
  inserted int := 0;
BEGIN
  FOR d IN
    SELECT generate_series('2026-01-01'::date, '2026-12-31'::date, '1 day')::date
  LOOP
    cycle_pos := ((d - anchor) % 6 + 6) % 6;
    shift := CASE
      WHEN cycle_pos IN (0, 1) THEN 'A'
      WHEN cycle_pos IN (2, 3) THEN 'B'
      ELSE 'C'
    END;
    -- Skip the day before the anchor (Jan 1 2026) so its negative
    -- modulo doesn't pin a wrong shift; algorithm above handles
    -- negatives but Jan 1 falls naturally on cycle_pos=5 → C, which
    -- is fine. We INSERT ON CONFLICT so any pre-existing manual
    -- overrides from a prior run are preserved.
    INSERT INTO lvfr_platoon_schedule (date, platoon, year)
    VALUES (d, shift, EXTRACT(YEAR FROM d)::int)
    ON CONFLICT (date) DO NOTHING;
    inserted := inserted + 1;
  END LOOP;
  RAISE NOTICE 'lvfr_platoon_schedule: seeded/checked % rows for 2026.', inserted;
END $$;

-- ── Per-instructor platoon assignment ────────────────────────────
-- Most instructors aren't on a platoon at all (NULL). Jimi → 'A'.
-- Drives the personal-mode overlay: when caller.lvfr_platoon is set,
-- the calendar shades dates matching that platoon as on-duty. Stored
-- on lab_users (rather than a join table) since each person has at
-- most one platoon affiliation at a time.
ALTER TABLE lab_users
  ADD COLUMN IF NOT EXISTS lvfr_platoon text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_users_lvfr_platoon_check'
  ) THEN
    ALTER TABLE lab_users DROP CONSTRAINT lab_users_lvfr_platoon_check;
  END IF;
END $$;

ALTER TABLE lab_users
  ADD CONSTRAINT lab_users_lvfr_platoon_check
  CHECK (lvfr_platoon IS NULL OR lvfr_platoon IN ('A', 'B', 'C'));

-- Set Jimi to A-shift. ILIKE so a "James Vargas" name variant still
-- matches; idempotent so re-runs don't drift.
UPDATE lab_users
SET lvfr_platoon = 'A'
WHERE (email ILIKE '%jimi%' OR name ILIKE '%jimi%' OR name ILIKE '%vargas%')
  AND lvfr_platoon IS DISTINCT FROM 'A';

COMMENT ON TABLE lvfr_platoon_schedule IS
  'Shared 48/96 rotation calendar for LVFR A/B/C platoons. Seeded algorithmically from the Jan 2 2026 A-shift anchor; individual dates editable for BID days, holidays, shift swaps.';
COMMENT ON COLUMN lab_users.lvfr_platoon IS
  'Optional A/B/C affiliation for instructors who work LVFR. Drives personal-mode overlays on the coordinator calendar.';
