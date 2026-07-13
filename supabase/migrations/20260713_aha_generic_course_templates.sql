-- Migration: aha_generic_course_templates
--
-- Task Handoff Queue (Ben approved, "PALS BUILD - AHA-generic
-- template+generator, fallback split"), Checkpoint A: adds the columns
-- needed to model an AHA-generic (ACLS|PALS) course template on the
-- EXISTING lab_day_templates/lab_template_stations tables, so a new
-- generator ("create AHA course for cohort") can expand a template into a
-- cohort's own lab_days/lab_stations, mirroring the same tag columns
-- lab_days already carries (cert_course, is_adv_cert_testing, lab_mode,
-- section_number/section_label — see 20260615_adv_cert_module.sql and the
-- section-aware migration referenced in docs/DATABASE_SCHEMA.md:1662).
--
-- Deliberately reuses lab_day_templates rather than a new table: 4
-- "certification"-category rows already exist (ACLS/PALS Day 1/Day 2,
-- verified live), each already 1:1 linked via lab_days.source_template_id
-- to real cohort rows (including 2 upcoming G14 PALS placeholders dated
-- 2026-07-16/17) — those FKs and rows are untouched by this migration.
-- Multi-section AHA days (e.g. G14's ACLS Day 2 has 4 real sections) need
-- one lab_day_templates row PER (day_number, section_number), which is
-- why section_number/section_label are added here rather than modeled
-- purely in the existing template_data jsonb.
--
-- All new columns are nullable or default-false — zero behavior change
-- for the 100+ existing non-certification template rows or the generic
-- lab-templates/apply route, which never sets or reads them.
--
-- Additive + idempotent.

ALTER TABLE "lab_day_templates"
  ADD COLUMN IF NOT EXISTS "cert_course" text,
  ADD COLUMN IF NOT EXISTS "section_number" integer,
  ADD COLUMN IF NOT EXISTS "section_label" text,
  ADD COLUMN IF NOT EXISTS "is_adv_cert_testing" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lab_mode" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lab_day_templates_cert_course_check'
  ) THEN
    ALTER TABLE "lab_day_templates"
      ADD CONSTRAINT "lab_day_templates_cert_course_check"
      CHECK (cert_course IS NULL OR cert_course IN ('acls', 'pals'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_lab_day_templates_cert_course"
  ON "lab_day_templates" ("cert_course")
  WHERE (cert_course IS NOT NULL);

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_lab_day_templates_cert_course;
-- ALTER TABLE lab_day_templates DROP CONSTRAINT IF EXISTS lab_day_templates_cert_course_check;
-- ALTER TABLE lab_day_templates
--   DROP COLUMN IF EXISTS lab_mode,
--   DROP COLUMN IF EXISTS is_adv_cert_testing,
--   DROP COLUMN IF EXISTS section_label,
--   DROP COLUMN IF EXISTS section_number,
--   DROP COLUMN IF EXISTS cert_course;
