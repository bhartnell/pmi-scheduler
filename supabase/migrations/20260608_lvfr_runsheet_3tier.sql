-- LVFR AEMT runsheet rebuild — 3-tier item model + day brief/debrief.
--
-- Adds the requirement tier (required/optional/info), an item description
-- (sub-bullets rolled into one item per the spec's granularity rule), and a
-- human-readable time_label ("0730-0740"). Day-level brief/debrief land on
-- lvfr_day_schedule. All columns are additive + nullable so the existing
-- runsheet keeps working until the data rebuild replaces the items.
--
-- See SPEC_lvfr_runsheet_rebuild (2).md and scripts/lvfr-rebuild/.

-- ── lvfr_schedule_items: 3-tier requirement + description + time_label ──
ALTER TABLE lvfr_schedule_items
  ADD COLUMN IF NOT EXISTS requirement text NOT NULL DEFAULT 'required';

ALTER TABLE lvfr_schedule_items
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE lvfr_schedule_items
  ADD COLUMN IF NOT EXISTS time_label text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lvfr_schedule_items_requirement_check'
  ) THEN
    ALTER TABLE lvfr_schedule_items
      ADD CONSTRAINT lvfr_schedule_items_requirement_check
      CHECK (requirement IN ('required', 'optional', 'info'));
  END IF;
END $$;

-- Backfill existing (pre-rebuild) rows so they still render sanely before the
-- data replace: breaks/lunch become info, everything else stays required.
UPDATE lvfr_schedule_items
  SET requirement = 'info'
  WHERE item_type = 'break' AND requirement = 'required';

-- ── lvfr_day_schedule: day-level brief + debrief ──
ALTER TABLE lvfr_day_schedule
  ADD COLUMN IF NOT EXISTS brief text;

ALTER TABLE lvfr_day_schedule
  ADD COLUMN IF NOT EXISTS debrief text;

COMMENT ON COLUMN lvfr_schedule_items.requirement IS
  '3-tier model: required (checkbox, blocks day-complete), optional (checkbox, does not block), info (no checkbox — breaks/lunch/roll call).';
COMMENT ON COLUMN lvfr_schedule_items.description IS
  'Sub-bullets for a major activity, rolled into one item per the granularity rule (e.g. devices for a lab, stations for checkoffs).';
COMMENT ON COLUMN lvfr_schedule_items.time_label IS
  'Human-readable time window for the activity, e.g. "0730-0740". Display-only.';
COMMENT ON COLUMN lvfr_day_schedule.brief IS
  'Short day synopsis shown above the AM block. Sourced from the day objectives + lab-day preview.';
COMMENT ON COLUMN lvfr_day_schedule.debrief IS
  'Short day wrap shown below the PM block. Sourced from the docx Debrief / Day Closeout block.';
