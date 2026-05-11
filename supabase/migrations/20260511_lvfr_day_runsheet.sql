-- LVFR AEMT day runsheet — replaces the rigid timed calendar blocks
-- with a per-day checklist that gives instructors a framework with
-- flexibility. The pmi_schedule_blocks rows for an LVFR cohort still
-- exist as the "source of truth" for what the day was supposed to be
-- but the operator-facing surface is the runsheet: one row per
-- session (AM / PM / full_day), N items per session, items get
-- checked off in-place as the day progresses.
--
-- Real-time multi-instructor checkoff is delivered via Supabase
-- realtime on lvfr_schedule_items — see /app/lvfr-aemt/day/[date]/page.tsx.
--
-- Tables here intentionally do not enable RLS: the admin Supabase
-- client used in our API routes bypasses RLS anyway, and the
-- /lvfr-aemt/ layout already enforces canAccessLVFR() at the edge.

-- ── lvfr_day_schedule ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lvfr_day_schedule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL,
  cohort_id   uuid REFERENCES cohorts(id) ON DELETE SET NULL,
  session     text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lvfr_day_schedule_session_check'
  ) THEN
    ALTER TABLE lvfr_day_schedule
      ADD CONSTRAINT lvfr_day_schedule_session_check
      CHECK (session IN ('morning', 'afternoon', 'full_day'));
  END IF;
END $$;

-- One runsheet header row per (date, session) — guarantees no
-- duplicate "morning" rows on the same day, which the runsheet UI
-- relies on when looking up the day record.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lvfr_day_schedule_date_session
  ON lvfr_day_schedule (date, session);

CREATE INDEX IF NOT EXISTS idx_lvfr_day_schedule_date
  ON lvfr_day_schedule (date);

-- ── lvfr_schedule_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lvfr_schedule_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_schedule_id   uuid NOT NULL REFERENCES lvfr_day_schedule(id) ON DELETE CASCADE,
  title             text NOT NULL,
  item_type         text,
  estimated_minutes integer,
  sort_order        integer NOT NULL DEFAULT 0,
  is_completed      boolean NOT NULL DEFAULT false,
  completed_at      timestamptz,
  completed_by      uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  notes             text,
  -- Optional traceability back to the originating pmi_schedule_blocks
  -- row when the item was seeded from the master calendar. Lets a
  -- future "regenerate from blocks" pass detect already-seeded items
  -- so we don't double-insert. Nullable for ad-hoc items added by an
  -- instructor mid-day.
  source_block_id   uuid REFERENCES pmi_schedule_blocks(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lvfr_schedule_items_item_type_check'
  ) THEN
    ALTER TABLE lvfr_schedule_items
      ADD CONSTRAINT lvfr_schedule_items_item_type_check
      CHECK (item_type IS NULL OR item_type IN (
        'chapter', 'quiz', 'skills', 'break', 'lab', 'exam', 'other'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lvfr_schedule_items_day_schedule_id
  ON lvfr_schedule_items (day_schedule_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_lvfr_schedule_items_source_block_id
  ON lvfr_schedule_items (source_block_id);

-- ── updated_at trigger ───────────────────────────────────────────
-- updated_at on the header row should bump whenever the runsheet
-- mutates so a "last touched" indicator on the landing page is
-- accurate even if the only change was a checkoff on a child item.
CREATE OR REPLACE FUNCTION lvfr_runsheet_touch_parent()
RETURNS trigger AS $$
BEGIN
  UPDATE lvfr_day_schedule
    SET updated_at = now()
    WHERE id = COALESCE(NEW.day_schedule_id, OLD.day_schedule_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lvfr_schedule_items_touch_parent ON lvfr_schedule_items;
CREATE TRIGGER trg_lvfr_schedule_items_touch_parent
  AFTER INSERT OR UPDATE OR DELETE ON lvfr_schedule_items
  FOR EACH ROW EXECUTE FUNCTION lvfr_runsheet_touch_parent();

COMMENT ON TABLE lvfr_day_schedule IS
  'Per-day, per-session header row for the LVFR AEMT runsheet UI. Items live in lvfr_schedule_items. Unique on (date, session).';
COMMENT ON TABLE lvfr_schedule_items IS
  'Individual checkbox line items on the LVFR day runsheet. Real-time checkoff via supabase realtime channel on this table.';
COMMENT ON COLUMN lvfr_schedule_items.source_block_id IS
  'Set when the item was seeded from a pmi_schedule_blocks row. Lets a re-seed pass skip rows already present.';
