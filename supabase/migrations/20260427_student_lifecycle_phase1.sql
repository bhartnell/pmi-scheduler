-- Student lifecycle Phase 1 — schema + backfill only.
--
-- No UI / API changes ride on this; the existing /transfer and
-- /graduate endpoints continue to function unchanged.  Phase 2 will
-- update those to populate the new columns and create per-program
-- enrollment rows on transitions.
--
-- Pre-migration scoping (verified 2026-04-27):
--   - 102 students  (96 active, 6 withdrawn, 0 graduated, 0 on_hold)
--   - 0 students with cohort_id IS NULL
--   - 286 student_skill_evaluations rows  (273 have lab_day_id, 13 fall back)
--   - 0 lab_day_attendance rows
--   - 1 student_cohort_history row (Rogie Deleon, same-program transfer)
--   - programs.abbreviation values present: AEMT, EMT, PM
--
-- Idempotent throughout — every CREATE / ALTER uses IF NOT EXISTS,
-- every backfill INSERT uses NOT EXISTS guards, every backfill UPDATE
-- uses WHERE … IS NULL so re-running is safe.
--
-- DEFERRED to Phase 2:
--   • Renaming student_cohort_history.reason → notes. Listed in the
--     Phase 1 brief but doing it now would break the existing
--     /api/students/[id]/transfer + /graduate endpoints which still
--     write `reason: ...` in their INSERTs. Phase 2 will rename the
--     column AND update the writers in the same commit. For now we
--     just add the new event_type / from_cert_level / to_cert_level
--     columns alongside the existing reason.

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1. student_program_enrollments
-- ──────────────────────────────────────────────────────────────────
-- One row per program a student has been enrolled in. Source of truth
-- for "what programs has this student been through". Granular
-- transitions (cohort transfers, status flips) continue to live in
-- student_cohort_history; this table answers a different question.
--
-- The partial unique index enforces the one-active-enrollment-per-
-- student invariant so we can't accidentally end up with a student
-- showing as active in EMT and AEMT simultaneously. Withdrawn /
-- graduated rows can stack freely (a student can have any number of
-- terminated enrollments in their history).

CREATE TABLE IF NOT EXISTS student_program_enrollments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cohort_id   uuid        NOT NULL REFERENCES cohorts(id)  ON DELETE RESTRICT,
  program     text        NOT NULL CHECK (program IN ('emt','aemt','paramedic')),
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','withdrawn','graduated')),
  start_date  date,
  end_date    date,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_program_enrollments_student
  ON student_program_enrollments (student_id, status);
CREATE INDEX IF NOT EXISTS idx_student_program_enrollments_cohort
  ON student_program_enrollments (cohort_id);

-- One active enrollment per student. Partial index (only enforces on
-- status='active') so a student can have many historical rows.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_enrollment_per_student
  ON student_program_enrollments (student_id)
  WHERE status = 'active';

COMMENT ON TABLE student_program_enrollments IS
  'One row per distinct program enrollment for a student. Phase 1 backfilled from current student state; Phase 2+ APIs maintain it on transitions.';

-- ──────────────────────────────────────────────────────────────────
-- 2. Backfill student_program_enrollments from current students
-- ──────────────────────────────────────────────────────────────────
-- Maps programs.abbreviation (uppercase: EMT/AEMT/PM/PMD) to the
-- lowercase enum values the table accepts. PM and PMD both collapse
-- to 'paramedic' since the certification level is identical.
--
-- on_hold students excluded per the Phase 1 brief; revisit when we
-- decide whether on_hold should keep an active enrollment or get its
-- own status value. (Current data has 0 on_hold rows so this is
-- moot for the backfill, but the WHERE clause keeps the rule
-- consistent if any roll in later.)

INSERT INTO student_program_enrollments
  (student_id, cohort_id, program, status, start_date, notes)
SELECT
  s.id,
  s.cohort_id,
  CASE
    WHEN p.abbreviation IN ('PM','PMD') THEN 'paramedic'
    ELSE LOWER(p.abbreviation)
  END                                                   AS program,
  CASE s.status
    WHEN 'active'     THEN 'active'
    WHEN 'withdrawn'  THEN 'withdrawn'
    WHEN 'graduated'  THEN 'graduated'
    ELSE 'active'
  END                                                   AS status,
  COALESCE(s.enrollment_date, c.start_date)             AS start_date,
  'Backfilled from students table on 2026-04-27 (Phase 1)' AS notes
FROM students s
JOIN cohorts  c ON c.id = s.cohort_id
JOIN programs p ON p.id = c.program_id
WHERE s.status <> 'on_hold'
  AND NOT EXISTS (
    -- idempotency: skip if a row already exists for this student
    SELECT 1 FROM student_program_enrollments e
    WHERE e.student_id = s.id
  );


-- ──────────────────────────────────────────────────────────────────
-- 3. Add cert_level to tracking tables
-- ──────────────────────────────────────────────────────────────────
-- Stamps the certification level at the time the record was created.
-- Lets a student profile filter records by cert level when they
-- eventually upgrade EMT → AEMT → paramedic. CHECK constraint matches
-- the program enum on student_program_enrollments.
--
-- Nullable for now so existing rows aren't blocked by NOT NULL until
-- backfilled. Phase 2 may flip to NOT NULL once API code stamps the
-- column on every insert.

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS cert_level text;

-- Constraint added separately so the IF NOT EXISTS on the column
-- above doesn't conflict with the CHECK (Postgres has no idempotent
-- ADD CONSTRAINT short of a DO block).
DO $$ BEGIN
  ALTER TABLE student_skill_evaluations
    ADD CONSTRAINT student_skill_evaluations_cert_level_check
    CHECK (cert_level IN ('emt','aemt','paramedic'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE lab_day_attendance
  ADD COLUMN IF NOT EXISTS cert_level text;

DO $$ BEGIN
  ALTER TABLE lab_day_attendance
    ADD CONSTRAINT lab_day_attendance_cert_level_check
    CHECK (cert_level IN ('emt','aemt','paramedic'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────
-- 4. Backfill cert_level on student_skill_evaluations
-- ──────────────────────────────────────────────────────────────────
-- Strategy: prefer the cohort linked via lab_day_id (most accurate
-- for time-of-record), fall back to the student's current cohort for
-- the ~13 rows without lab_day_id. Per scoping, none of the affected
-- students have ever changed programs, so the fallback is correct
-- in this dataset; if/when program upgrades happen we'll re-evaluate.

UPDATE student_skill_evaluations sse
SET cert_level =
  CASE
    WHEN p.abbreviation IN ('PM','PMD') THEN 'paramedic'
    ELSE LOWER(p.abbreviation)
  END
FROM lab_days ld
JOIN cohorts  c ON c.id = ld.cohort_id
JOIN programs p ON p.id = c.program_id
WHERE ld.id = sse.lab_day_id
  AND sse.cert_level IS NULL;

-- Fallback: any remaining rows (no lab_day_id) get the student's
-- current cohort program. Safe given current data; documented in
-- the migration log so we can audit if a program upgrade ever lands.
UPDATE student_skill_evaluations sse
SET cert_level =
  CASE
    WHEN p.abbreviation IN ('PM','PMD') THEN 'paramedic'
    ELSE LOWER(p.abbreviation)
  END
FROM students s
JOIN cohorts  c ON c.id = s.cohort_id
JOIN programs p ON p.id = c.program_id
WHERE s.id = sse.student_id
  AND sse.cert_level IS NULL;

-- lab_day_attendance has 0 rows currently, so no backfill UPDATE
-- needed. New inserts (Phase 2) will stamp cert_level on creation.

-- ──────────────────────────────────────────────────────────────────
-- 5. student_cohort_history — add event_type + cert_level columns
-- ──────────────────────────────────────────────────────────────────
-- The reason → notes RENAME from the Phase 1 brief is deferred to
-- Phase 2 (would break /transfer + /graduate writers, see header
-- comment). Adding the new columns now is safe — they're nullable
-- and existing INSERTs that don't reference them continue to work.

ALTER TABLE student_cohort_history
  ADD COLUMN IF NOT EXISTS event_type      text,
  ADD COLUMN IF NOT EXISTS from_cert_level text,
  ADD COLUMN IF NOT EXISTS to_cert_level   text;

DO $$ BEGIN
  ALTER TABLE student_cohort_history
    ADD CONSTRAINT student_cohort_history_event_type_check
    CHECK (event_type IN (
      'withdrawal','re-enrollment','program_upgrade',
      'graduation','transfer'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE student_cohort_history
    ADD CONSTRAINT student_cohort_history_from_cert_level_check
    CHECK (from_cert_level IS NULL OR from_cert_level IN ('emt','aemt','paramedic'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE student_cohort_history
    ADD CONSTRAINT student_cohort_history_to_cert_level_check
    CHECK (to_cert_level IS NULL OR to_cert_level IN ('emt','aemt','paramedic'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill the lone existing row (Rogie Deleon, same-program transfer)
-- as event_type='transfer'. Idempotent via WHERE event_type IS NULL.
UPDATE student_cohort_history
SET event_type = 'transfer'
WHERE event_type IS NULL;

-- (Cert levels left NULL on Rogie's row — same-program transfer, no
-- cert change, the recommendation was to leave from/to NULL when
-- they're equal so the column doesn't fill with redundant data.)

COMMIT;
