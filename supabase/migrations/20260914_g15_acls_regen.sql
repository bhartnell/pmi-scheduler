-- 20260914_g15_acls_regen.sql
--
-- [Task Handoff Queue: "G15's ACLS days were generated from the SUPERSEDED
-- March placeholder template, not the July sectioned templates that already
-- exist"] G15 (PM 15.0, cohort 856bcf1d-...) had its ACLS Certification days
-- (2026-10-05/06) created by hand / from the pre-"sections" March 2026 flat
-- stub templates (b0b27a24-... Day 1, 3b12db4b-... Day 2) instead of the
-- proper 7-section ACLS templates built 2026-07-13 (Task Handoff Queue:
-- "AHA HUB + ACLS REPEATABLE" Phase 2) that already mirror G14's live June
-- ACLS structure. Root cause: NOT the AHA course generator itself
-- (lib/aha-course-generator.ts filters lab_day_templates.cert_course='acls',
-- and both March stubs have cert_course=NULL, so the generator could never
-- select them) -- these two rows were created before the generator/sectioned
-- templates existed and never regenerated once they did. The real footgun is
-- that the two March stubs are still named identically to the real course
-- ("ACLS Certification — Day 1"/"Day 2") and not flagged superseded, so they
-- stay pickable from the generic per-day "apply template" flow; the July
-- 2026-07-13 entry already flagged this exact ambiguity for the PALS pair
-- and it was never fixed. Fixed here for both pairs (rename only, ACLS +
-- PALS) -- see the template UPDATEs below.
--
-- G15's Oct 2026-11-02/03 PALS course is NOT touched by this migration --
-- its two March-era flat stub templates (e980c3e6-.../07501712-...) still
-- carry cert_course='pals' and were already flagged 2026-07-15 as needing a
-- Ben-authored cert_course=NULL switch-over before the 5-section PALS
-- template becomes the sole generation path (same reasoning as the ACLS
-- precedent) -- that switch-over decision is still Ben's, not made here;
-- only the name is fixed on both PALS stubs so they read as superseded too.
--
-- Ben's screenshot corroborated the readiness-doc finding: 0 megacode lab
-- days, 0 attempts, 0/21 passed as TL, all Day-1 stations unassigned.
--
-- HARD GUARDRAILS (per the task): additive, G14 never touched. The 2 stale
-- G15 rows are ARCHIVED (is_archived=true + "[ARCHIVED] ... (superseded)"
-- title/section_label), not deleted -- exactly the pattern G14's own
-- Day-2 §1 stub row already uses live (source_template_id=3b12db4b, the
-- same stub) -- lab_stations/adv_cert_test_attempts/every lab_day_id-keyed
-- table checked live and confirmed empty for both stale rows before writing
-- (0 attempts, 0 instructor assignments, 0 attendance/signups/timer state).
--
-- The 7 real sections are inserted exactly as
-- generateAhaCourseForCohort() would (title = template.name, fields copied
-- 1:1 from lab_day_templates/lab_template_stations, including
-- skill_sheet_id -- see the accompanying code fix in
-- lib/aha-course-generator.ts, which previously dropped that column; no
-- station on these 7 templates has one set, so this migration's actual
-- output is unaffected either way).
--
-- The 2 live pmi_schedule_blocks calendar rows for these dates
-- (2efd7769-... "ACLS (Day 1 of 2)", 61bb2ccc-... "ACLS (Day 2 of 2)", both
-- whole-day 08:30-17:00 blocks with instructor b4f6e2f1-... already
-- assigned) currently link to the stale section-1 rows being archived here
-- (linked_section_number NULL = section 1). The section-aware calendar
-- trigger (20260617_calendar_link_triggers_section.sql) will NOT
-- auto-relink them (it only fills a NULL linked_lab_day_id, and only
-- matches an exact linked_section_number, which these still carry as NULL);
-- there being no single section that represents a whole day now that the
-- day is split into 4 (Day 1) / 3 (Day 2) parts, they are re-pointed here at
-- each day's first real section (section_number=2) as the least-arbitrary
-- choice -- flagged to Ben in the Task Handoff Queue log in case a
-- different section is preferred.
--
-- Backup: _backup_lab_days_g15_aclsregen_20260914,
-- _backup_lab_stations_g15_aclsregen_20260914 and
-- _backup_pmi_schedule_blocks_g15_aclsregen_20260914 snapshot the pre-change
-- state of the 2 stale lab_days, their 5 lab_stations, and the 2 calendar
-- blocks before any UPDATE below.

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_lab_days_g15_aclsregen_20260914 AS
SELECT * FROM lab_days
WHERE id IN ('696d9edc-0a79-4f97-8527-452bf4a406ba', '77b5c545-1b8b-486c-8318-94ca4e4d9de3');

CREATE TABLE IF NOT EXISTS _backup_lab_stations_g15_aclsregen_20260914 AS
SELECT * FROM lab_stations
WHERE lab_day_id IN ('696d9edc-0a79-4f97-8527-452bf4a406ba', '77b5c545-1b8b-486c-8318-94ca4e4d9de3');

CREATE TABLE IF NOT EXISTS _backup_pmi_schedule_blocks_g15_aclsregen_20260914 AS
SELECT * FROM pmi_schedule_blocks
WHERE id IN ('2efd7769-f5ad-4c00-bc4b-c452808bb288', '61bb2ccc-0d3f-4258-8d2c-240b636dd565');

-- ── Archive the 2 stale G15 rows (never delete) ─────────────────────
UPDATE lab_days
SET is_archived = true,
    title = '[ARCHIVED] ACLS Certification — Day 1 (superseded)',
    section_label = '[ARCHIVED] ACLS Day 1 (superseded by sections)'
WHERE id = '696d9edc-0a79-4f97-8527-452bf4a406ba';

UPDATE lab_days
SET is_archived = true,
    title = '[ARCHIVED] ACLS Certification — Day 2 (superseded)',
    section_label = '[ARCHIVED] ACLS Day 2 (superseded by sections)'
WHERE id = '77b5c545-1b8b-486c-8318-94ca4e4d9de3';

-- ── Insert the 7 real sectioned days, exactly as the generator would ──
CREATE TEMP TABLE _g15_acls_day_map (day_number int, target_date date) ON COMMIT DROP;
INSERT INTO _g15_acls_day_map (day_number, target_date) VALUES (1, '2026-10-05'), (2, '2026-10-06');

-- (RETURNING can only surface columns actually written by the INSERT --
-- day_number is never one of them, matching generateAhaCourseForCohort's
-- own insert shape, so this tracks by `date` instead, which IS inserted.)
CREATE TEMP TABLE _g15_acls_created (template_id uuid, lab_day_id uuid, target_date date, section_number int) ON COMMIT DROP;
WITH ins AS (
  INSERT INTO lab_days (
    cohort_id, date, title, semester, section_number, section_label,
    cert_course, is_adv_cert_testing, lab_mode, source_template_id
  )
  SELECT
    '856bcf1d-2e85-48b5-92a3-aba941103109', m.target_date, t.name, 2,
    t.section_number, t.section_label, 'acls', t.is_adv_cert_testing,
    COALESCE(t.lab_mode, 'group_rotations'), t.id
  FROM lab_day_templates t
  JOIN _g15_acls_day_map m ON m.day_number = t.day_number
  WHERE t.id IN (
    '315e9819-1a7d-43e5-8ca4-7fb9bd56c955', '7d4c8d4b-2e0d-40c6-b493-2af681989d92',
    'f7e1ec79-2d5c-4abc-af28-69f9d81b5193', '0f567cf9-5eb6-4ed5-be15-820c5ecae52f',
    '3beafb23-4cf9-4396-ab74-efb9ee2dbff0', '1953de1a-9e7c-4dbe-8ba1-11c86c4b4897',
    '927edce1-7d0b-4ed0-98f0-0dfdfe4e0caa'
  )
  RETURNING id, source_template_id, date, section_number
)
INSERT INTO _g15_acls_created (template_id, lab_day_id, target_date, section_number)
SELECT source_template_id, id, date, section_number FROM ins;

INSERT INTO lab_stations (
  lab_day_id, station_number, station_type, scenario_id, custom_title,
  station_notes, metadata, skill_sheet_id
)
SELECT c.lab_day_id, s.sort_order, s.station_type, s.scenario_id, s.station_name,
       s.notes, COALESCE(s.metadata, '{}'::jsonb), s.skill_sheet_id
FROM lab_template_stations s
JOIN _g15_acls_created c ON c.template_id = s.template_id;

-- ── Re-link the 2 whole-day calendar blocks to each day's first real
-- section (see note above -- flagged to Ben, adjustable later). ──
UPDATE pmi_schedule_blocks b
SET linked_lab_day_id = c.lab_day_id, linked_section_number = c.section_number, updated_at = now()
FROM _g15_acls_created c
WHERE c.section_number = 2
  AND ((b.id = '2efd7769-f5ad-4c00-bc4b-c452808bb288' AND c.target_date = '2026-10-05')
    OR (b.id = '61bb2ccc-0d3f-4258-8d2c-240b636dd565' AND c.target_date = '2026-10-06'));

-- ── Root-cause fix: rename the 4 orphaned March-era flat stub templates
-- so they read as superseded in generic template pickers. Rename only --
-- cert_course is left exactly as-is on all 4 (ACLS pair already NULL,
-- excluded from the generator; PALS pair's cert_course=NULL switch-over
-- stays Ben's call per the 2026-07-15 flag, not decided here). ──
UPDATE lab_day_templates
SET name = '[SUPERSEDED] ACLS Certification — Day 1 (use sectioned templates)',
    review_notes = 'Superseded 2026-09-14 by the 2026-07-13 sectioned ACLS templates (Day 1 §2-5). Caused G15''s ACLS days to be generated wrong -- see Task Handoff Queue. Do not select for new cohorts.',
    requires_review = true,
    updated_by = 'claude-code-task-handoff-queue:g15-acls-regen'
WHERE id = 'b0b27a24-f03a-4700-afa0-6aed8e05a777';

UPDATE lab_day_templates
SET name = '[SUPERSEDED] ACLS Certification — Day 2 (use sectioned templates)',
    review_notes = 'Superseded 2026-09-14 by the 2026-07-13 sectioned ACLS templates (Day 2 §2-4). Caused G15''s ACLS days to be generated wrong -- see Task Handoff Queue. Do not select for new cohorts.',
    requires_review = true,
    updated_by = 'claude-code-task-handoff-queue:g15-acls-regen'
WHERE id = '3b12db4b-6019-4770-be4f-f254555b3f9b';

UPDATE lab_day_templates
SET name = '[SUPERSEDED] PALS Certification — Day 1 (use sectioned templates)',
    review_notes = 'Same ambiguous-naming footgun as the ACLS pair (see 2026-09-14 G15 ACLS regen) -- flagged 2026-07-15, not yet resolved: still cert_course=''pals'' so the generator would pick this UP ALONGSIDE the 2026-07-15 sectioned PALS templates for a future cohort. Needs Ben''s go to set cert_course=NULL before G15''s Nov PALS course is generated.',
    requires_review = true,
    updated_by = 'claude-code-task-handoff-queue:g15-acls-regen'
WHERE id = 'e980c3e6-a23e-4494-958d-c16817939887';

UPDATE lab_day_templates
SET name = '[SUPERSEDED] PALS Certification — Day 2 (use sectioned templates)',
    review_notes = 'Same ambiguous-naming footgun as the ACLS pair (see 2026-09-14 G15 ACLS regen) -- flagged 2026-07-15, not yet resolved: still cert_course=''pals'' so the generator would pick this UP ALONGSIDE the 2026-07-15 sectioned PALS templates for a future cohort. Needs Ben''s go to set cert_course=NULL before G15''s Nov PALS course is generated.',
    requires_review = true,
    updated_by = 'claude-code-task-handoff-queue:g15-acls-regen'
WHERE id = '07501712-fc21-4794-b5e5-53dfb847a5d6';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- UPDATE pmi_schedule_blocks b SET linked_lab_day_id = o.linked_lab_day_id,
--   linked_section_number = o.linked_section_number, updated_at = o.updated_at
--   FROM _backup_pmi_schedule_blocks_g15_aclsregen_20260914 o WHERE b.id = o.id;
-- DELETE FROM lab_stations WHERE lab_day_id IN (
--   SELECT id FROM lab_days WHERE cohort_id = '856bcf1d-2e85-48b5-92a3-aba941103109'
--     AND cert_course = 'acls' AND source_template_id IN (
--       '315e9819-1a7d-43e5-8ca4-7fb9bd56c955', '7d4c8d4b-2e0d-40c6-b493-2af681989d92',
--       'f7e1ec79-2d5c-4abc-af28-69f9d81b5193', '0f567cf9-5eb6-4ed5-be15-820c5ecae52f',
--       '3beafb23-4cf9-4396-ab74-efb9ee2dbff0', '1953de1a-9e7c-4dbe-8ba1-11c86c4b4897',
--       '927edce1-7d0b-4ed0-98f0-0dfdfe4e0caa'));
-- DELETE FROM lab_days WHERE cohort_id = '856bcf1d-2e85-48b5-92a3-aba941103109'
--   AND source_template_id IN (
--     '315e9819-1a7d-43e5-8ca4-7fb9bd56c955', '7d4c8d4b-2e0d-40c6-b493-2af681989d92',
--     'f7e1ec79-2d5c-4abc-af28-69f9d81b5193', '0f567cf9-5eb6-4ed5-be15-820c5ecae52f',
--     '3beafb23-4cf9-4396-ab74-efb9ee2dbff0', '1953de1a-9e7c-4dbe-8ba1-11c86c4b4897',
--     '927edce1-7d0b-4ed0-98f0-0dfdfe4e0caa');
-- UPDATE lab_days ld SET is_archived = o.is_archived, title = o.title, section_label = o.section_label
--   FROM _backup_lab_days_g15_aclsregen_20260914 o WHERE ld.id = o.id;
-- UPDATE lab_day_templates SET name = 'ACLS Certification — Day 1', review_notes = NULL, requires_review = false, updated_by = NULL WHERE id = 'b0b27a24-f03a-4700-afa0-6aed8e05a777';
-- UPDATE lab_day_templates SET name = 'ACLS Certification — Day 2', review_notes = NULL, requires_review = false, updated_by = NULL WHERE id = '3b12db4b-6019-4770-be4f-f254555b3f9b';
-- UPDATE lab_day_templates SET name = 'PALS Certification — Day 1', review_notes = NULL, requires_review = false, updated_by = NULL WHERE id = 'e980c3e6-a23e-4494-958d-c16817939887';
-- UPDATE lab_day_templates SET name = 'PALS Certification — Day 2', review_notes = NULL, requires_review = false, updated_by = NULL WHERE id = '07501712-fc21-4794-b5e5-53dfb847a5d6';
-- DROP TABLE IF EXISTS _backup_lab_days_g15_aclsregen_20260914;
-- DROP TABLE IF EXISTS _backup_lab_stations_g15_aclsregen_20260914;
-- DROP TABLE IF EXISTS _backup_pmi_schedule_blocks_g15_aclsregen_20260914;
-- COMMIT;
