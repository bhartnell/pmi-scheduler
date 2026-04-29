-- Year-anchor + per-cohort semester override tables.
--
-- Two-table addition that backstops pmi_semesters with a year-level
-- "set the S1 start date once and derive everything from it" anchor
-- AND a per-cohort override for off-calendar cohorts (Group 12/13's
-- December start, LVFR AEMT's July start, etc.).
--
-- The block resolver (lib/planner-semester.ts) consults these tables
-- in order: cohort override → pmi_semesters explicit dates → academic
-- year derived (UI feature, future). The data layer here is enough
-- for the resolver to stop creating the 285-block "wrong-semester"
-- bug class — the UI for editing year anchors and overrides ships
-- in a follow-up.

-- ── 1. pmi_academic_years ──────────────────────────────────────────
-- Single S1 start date per year drives auto-calculated semester
-- boundaries (S1: anchor → +105d, review week, S2, S3, S4). The UI
-- materialises those calculated dates into pmi_semesters; this row
-- just stores the anchor itself so we can re-derive on any year-end
-- shift without losing the source-of-truth date.
CREATE TABLE IF NOT EXISTS pmi_academic_years (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year            integer NOT NULL,
  s1_start_date   date NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pmi_academic_years_year_unique'
  ) THEN
    ALTER TABLE pmi_academic_years
      ADD CONSTRAINT pmi_academic_years_year_unique UNIQUE (year);
  END IF;
END $$;

COMMENT ON TABLE pmi_academic_years IS
  'Year-level anchor: a single s1_start_date per year drives auto-calculated dates for S1-S4 boundaries (15-week semesters with a 1-week review break between). Set once per year, occasionally adjusted for calendar drift.';

-- ── 2. cohort_semester_overrides ──────────────────────────────────
-- Per-cohort exception when a cohort runs off the standard calendar
-- (Group 12 starting S3 in December, LVFR AEMT starting S1 in July).
-- The override links a cohort to a specific pmi_semesters row and
-- replaces the date window for that pairing — block-resolution code
-- reads this first, falls back to pmi_semesters.start_date / end_date
-- when no row matches.
CREATE TABLE IF NOT EXISTS cohort_semester_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id     uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  semester_id   uuid NOT NULL REFERENCES pmi_semesters(id) ON DELETE CASCADE,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_semester_overrides_unique'
  ) THEN
    ALTER TABLE cohort_semester_overrides
      ADD CONSTRAINT cohort_semester_overrides_unique UNIQUE (cohort_id, semester_id);
  END IF;
END $$;

-- Composite index for the resolver's hot path: "given a cohort_id +
-- date, find the matching override". Covers the WHERE (cohort_id, date
-- BETWEEN start_date AND end_date) lookup that runs on every block
-- create/update.
CREATE INDEX IF NOT EXISTS idx_cso_cohort_date
  ON cohort_semester_overrides (cohort_id, start_date, end_date);

COMMENT ON TABLE cohort_semester_overrides IS
  'Per-cohort exceptions for cohorts that run off the standard calendar. Resolver checks this BEFORE pmi_semesters.start_date/end_date — handles Group 12/13 December starts, LVFR AEMT July start, etc.';
