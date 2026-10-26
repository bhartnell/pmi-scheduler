-- 20261026_pals_g15_rebuild.sql
--
-- [Task Handoff Queue: PALS P4/4] The G15 PALS Nov 2-3 days (lab_days
-- 6126cdaf-... Day 1, 9245f49b-... Day 2) were never built from the 5
-- sectioned PALS templates created 2026-07-15 (Section A/B Day 1, Section
-- C/D/E Day 2) -- both still carry their original 3-station flat content
-- from the superseded pre-sections template path (Day 1 source_template_id
-- NULL; Day 2 source_template_id 07501712-..., the "[SUPERSEDED] PALS
-- Certification -- Day 2" stub, cert_course NULL on the Day-2 row itself).
-- Verified live 2026-10-26: 0 pals_test_attempts, 0 student_skill_evaluations,
-- 0 student_lab_signups, 0 lab_day_attendance against both ids -- safe to
-- replace stations.
--
-- Ben's schedule (PALS_2025_Schedule_BACKUP + 2026-10-19/26 notes) + this
-- card's explicit instruction to KEEP both lab_days ids (calendar sync via
-- pmi_schedule_blocks, timer, and the hub already key on them) drives the
-- shape here, which differs from the 2026-09-14 G15 ACLS regen precedent
-- (which archived its 2 stale ids and minted 7 new ones): instead, each
-- kept id becomes its day's FIRST real section in place (UPDATE, not
-- archive), and only the remaining sections get new lab_days rows --
-- 6126cdaf -> Section A (Day 1), 9245f49b -> Section C (Day 2). This keeps
-- the 2 live pmi_schedule_blocks ("PALS (Day 1 of 2)" / "(Day 2 of 2)",
-- linked_lab_day_id = these same ids) correctly linked without any
-- relinking -- only their linked_section_number needs to move from NULL
-- (old convention for "section 1") to 2, matching the kept rows' new
-- section_number.
--
-- Ben, 2026-10-26 10:40 AM: NO Demo block on PALS ("we normally don't do
-- that during peds") -- Day 1 goes straight from Section A into Section B,
-- no instructor-led block between them. The Demo block stays ACLS-only;
-- not touched here (see card 3ff5cd1c-bc9b-81cc-9819-d098f703d041).
--
-- Section A fix: Ben's schedule names 4 learning stations (Airway,
-- Vascular Access/IO, Rhythm-Cardioversion, Rhythm-Defibrillation), but the
-- 2026-07-15 seed combined the two rhythm skills into one
-- "Rhythm Disturbances / Electrical Therapy" station (3 total, deliberately
-- reduced from AHA's 2020 two-rhythm-station layout). Per this card's
-- explicit instruction to fix the canonical template to match the sections
-- Ben describes, the combined station is split back into two here -- this
-- changes the CANONICAL template (lab_day_templates
-- 5dc0fa9b-f978-4b42-b83f-6f5d0089e45b), so it also fixes every future
-- cohort's Section A, not just G15's.
--
-- Also resolves the "cert_course=pals double-selection" landmine flagged
-- 2026-07-15 and again 2026-09-14 (20260914_g15_acls_regen.sql): the 2
-- superseded flat PALS stub templates (07501712-... Day 2, e980c3e6-...
-- Day 1) still carried cert_course='pals', so
-- lib/aha-course-generator.ts's generic .eq('cert_course','pals') query
-- would double-create alongside the 5 sectioned templates for any FUTURE
-- cohort. This card is Ben's go (via the Notion card text) to null them
-- out now that the sectioned templates are the live path. Name only was
-- fixed 2026-09-14; cert_course was explicitly left for Ben's call then --
-- this is that call.
--
-- Sections B, C, D: scenario_id left NULL (case TBD, instructor picks from
-- the 12-case practice pool in the hub) -- not guessed. Section E: T7/T9/T13
-- in round order (round 1/2/3), scenario ids already correct on the
-- existing Day-2 stations and copied forward unchanged from the template.
--
-- Timing: Section A 14:45-16:05 (4x20min), Section B 16:05-17:45 (4x25min,
-- straight after A, no Demo block), Section C 08:40-10:20, Section D
-- 10:30-12:10, Section E 13:10-14:25 (3x25min) -- all per Ben's schedule.
-- priority_flag='high' on every section (both days are high-priority on
-- the home calendar).
--
-- Backup: _backup_lab_days_g15_palsregen_20261026,
-- _backup_lab_stations_g15_palsregen_20261026,
-- _backup_pmi_schedule_blocks_g15_palsregen_20261026,
-- _backup_lab_template_stations_g15_palsregen_20261026 snapshot the
-- pre-change state of everything touched below.

BEGIN;

CREATE TABLE IF NOT EXISTS _backup_lab_days_g15_palsregen_20261026 AS
SELECT * FROM lab_days
WHERE id IN ('6126cdaf-51d8-4de8-9f78-501e9fc3ddf3', '9245f49b-0e89-4b8d-8319-d26ab5452fce');

CREATE TABLE IF NOT EXISTS _backup_lab_stations_g15_palsregen_20261026 AS
SELECT * FROM lab_stations
WHERE lab_day_id IN ('6126cdaf-51d8-4de8-9f78-501e9fc3ddf3', '9245f49b-0e89-4b8d-8319-d26ab5452fce');

CREATE TABLE IF NOT EXISTS _backup_pmi_schedule_blocks_g15_palsregen_20261026 AS
SELECT * FROM pmi_schedule_blocks
WHERE id IN ('4d877edc-84f8-4738-bc3e-f85052a980d3', 'e376419b-42f4-49ba-ba48-95af3ed1ea67');

CREATE TABLE IF NOT EXISTS _backup_lab_template_stations_g15_palsregen_20261026 AS
SELECT * FROM lab_template_stations
WHERE template_id = '5dc0fa9b-f978-4b42-b83f-6f5d0089e45b';

-- ── Fix the canonical Section A template: split the combined rhythm
-- station into Cardioversion + Defibrillation (Ben's 4-station list). ──
UPDATE lab_template_stations
SET station_name = 'Rhythm - Synchronized Cardioversion (Lesson 9C)',
    notes = 'ECG leads, monitor + rhythm strip, pad placement, synchronized cardioversion 0.5-1 J/kg, rhythm recognition. Students demonstrate one at a time.',
    metadata = '{"duration_minutes":20,"ratio":"6:1 (max 8:1)","grading":"attestation_only","equipment":"ALS Baby + rhythm generator, or high-fidelity manikin"}'::jsonb
WHERE template_id = '5dc0fa9b-f978-4b42-b83f-6f5d0089e45b' AND sort_order = 3;

INSERT INTO lab_template_stations (template_id, station_type, station_name, scenario_id, scenario_title, sort_order, notes, metadata)
SELECT '5dc0fa9b-f978-4b42-b83f-6f5d0089e45b', 'skills', 'Rhythm - Defibrillation (Lesson 9C)', NULL, NULL, 4,
  'ECG leads, monitor + rhythm strip, pad placement, defibrillation 2-4 J/kg, rhythm recognition. Students demonstrate one at a time.',
  '{"duration_minutes":20,"ratio":"6:1 (max 8:1)","grading":"attestation_only","equipment":"ALS Baby + rhythm generator, or high-fidelity manikin"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM lab_template_stations WHERE template_id = '5dc0fa9b-f978-4b42-b83f-6f5d0089e45b' AND sort_order = 4
);

-- ── Resolve the cert_course='pals' double-selection landmine (flagged
-- 2026-07-15, 2026-09-14; Ben's go via this card). ──
UPDATE lab_day_templates
SET cert_course = NULL,
    review_notes = 'cert_course set to NULL 2026-10-26 (PALS P4/4): the 5 sectioned PALS templates (2026-07-15) are now the sole generation path. Resolves the double-selection landmine flagged 2026-07-15 and 2026-09-14.',
    updated_by = 'claude-code-task-handoff-queue:pals-p4-g15-rebuild'
WHERE id IN ('07501712-fc21-4794-b5e5-53dfb847a5d6', 'e980c3e6-a23e-4494-958d-c16817939887');

-- ── Day 1: 6126cdaf becomes Section A (Learning Stations) in place. ──
DELETE FROM lab_stations WHERE lab_day_id = '6126cdaf-51d8-4de8-9f78-501e9fc3ddf3';

UPDATE lab_days
SET title = 'PALS Certification — Day 1, Section A (Learning Stations)',
    section_number = 2,
    section_label = 'Section A — Learning Stations',
    cert_course = 'pals',
    is_adv_cert_testing = false,
    lab_mode = 'group_rotations',
    source_template_id = '5dc0fa9b-f978-4b42-b83f-6f5d0089e45b',
    priority_flag = 'high',
    start_time = '14:45:00',
    end_time = '16:05:00'
WHERE id = '6126cdaf-51d8-4de8-9f78-501e9fc3ddf3';

INSERT INTO lab_stations (lab_day_id, station_number, station_type, scenario_id, custom_title, station_notes, metadata, skill_sheet_id)
SELECT '6126cdaf-51d8-4de8-9f78-501e9fc3ddf3', s.sort_order, s.station_type, s.scenario_id, s.station_name, s.notes, COALESCE(s.metadata, '{}'::jsonb), s.skill_sheet_id
FROM lab_template_stations s
WHERE s.template_id = '5dc0fa9b-f978-4b42-b83f-6f5d0089e45b';

-- ── Day 2: 9245f49b becomes Section C (Case Scenario Practice) in place. ──
DELETE FROM lab_stations WHERE lab_day_id = '9245f49b-0e89-4b8d-8319-d26ab5452fce';

UPDATE lab_days
SET title = 'PALS Certification — Day 2, Section C (Case Scenario Practice)',
    section_number = 2,
    section_label = 'Section C — Case Scenario Practice (4 cases)',
    cert_course = 'pals',
    is_adv_cert_testing = false,
    lab_mode = 'group_rotations',
    source_template_id = '7254c536-f69b-4bb5-95ff-816edf0b0cd7',
    priority_flag = 'high',
    start_time = '08:40:00',
    end_time = '10:20:00'
WHERE id = '9245f49b-0e89-4b8d-8319-d26ab5452fce';

INSERT INTO lab_stations (lab_day_id, station_number, station_type, scenario_id, custom_title, station_notes, metadata, skill_sheet_id)
SELECT '9245f49b-0e89-4b8d-8319-d26ab5452fce', s.sort_order, s.station_type, s.scenario_id, s.station_name, s.notes, COALESCE(s.metadata, '{}'::jsonb), s.skill_sheet_id
FROM lab_template_stations s
WHERE s.template_id = '7254c536-f69b-4bb5-95ff-816edf0b0cd7';

-- ── New sections: Day 1 Section B, Day 2 Section D, Day 2 Section E. ──
CREATE TEMP TABLE _g15_pals_new (label text, lab_day_id uuid, template_id uuid) ON COMMIT DROP;

WITH ins AS (
  INSERT INTO lab_days (
    cohort_id, date, title, semester, section_number, section_label,
    cert_course, is_adv_cert_testing, lab_mode, source_template_id,
    start_time, end_time, priority_flag
  )
  VALUES (
    '856bcf1d-2e85-48b5-92a3-aba941103109', '2026-11-02',
    'PALS Certification — Day 1, Section B (Case Scenario Practice)', 2, 3,
    'Section B — Case Scenario Practice (4 cases)', 'pals', false, 'group_rotations',
    '7ff1edd7-8024-425d-a8ff-c37835be19d4', '16:05:00', '17:45:00', 'high'
  )
  RETURNING id
)
INSERT INTO _g15_pals_new (label, lab_day_id, template_id)
SELECT 'section_b', id, '7ff1edd7-8024-425d-a8ff-c37835be19d4' FROM ins;

WITH ins AS (
  INSERT INTO lab_days (
    cohort_id, date, title, semester, section_number, section_label,
    cert_course, is_adv_cert_testing, lab_mode, source_template_id,
    start_time, end_time, priority_flag
  )
  VALUES (
    '856bcf1d-2e85-48b5-92a3-aba941103109', '2026-11-03',
    'PALS Certification — Day 2, Section D (Case Scenario Practice)', 2, 3,
    'Section D — Case Scenario Practice (4 cases)', 'pals', false, 'group_rotations',
    'cf11a5e1-392f-455b-960d-27a8c3146a75', '10:30:00', '12:10:00', 'high'
  )
  RETURNING id
)
INSERT INTO _g15_pals_new (label, lab_day_id, template_id)
SELECT 'section_d', id, 'cf11a5e1-392f-455b-960d-27a8c3146a75' FROM ins;

WITH ins AS (
  INSERT INTO lab_days (
    cohort_id, date, title, semester, section_number, section_label,
    cert_course, is_adv_cert_testing, lab_mode, source_template_id,
    start_time, end_time, priority_flag
  )
  VALUES (
    '856bcf1d-2e85-48b5-92a3-aba941103109', '2026-11-03',
    'PALS Certification — Day 2, Section E (Case Scenario Testing)', 2, 4,
    'Section E — Case Scenario Testing', 'pals', true, 'individual_testing',
    '6678503b-5c52-48ba-8a80-99292b73da99', '13:10:00', '14:25:00', 'high'
  )
  RETURNING id
)
INSERT INTO _g15_pals_new (label, lab_day_id, template_id)
SELECT 'section_e', id, '6678503b-5c52-48ba-8a80-99292b73da99' FROM ins;

INSERT INTO lab_stations (lab_day_id, station_number, station_type, scenario_id, custom_title, station_notes, metadata, skill_sheet_id)
SELECT n.lab_day_id, s.sort_order, s.station_type, s.scenario_id, s.station_name, s.notes, COALESCE(s.metadata, '{}'::jsonb), s.skill_sheet_id
FROM lab_template_stations s
JOIN _g15_pals_new n ON n.template_id = s.template_id;

-- ── rotation_minutes: the generator path never sets this (DB default 30),
-- but Ben's schedule calls for 20 on Section A's learning stations and 25
-- on every case-scenario section (B, C, D, E — sim + debrief per AHA case
-- timing). ──
UPDATE lab_stations SET rotation_minutes = 20 WHERE lab_day_id = '6126cdaf-51d8-4de8-9f78-501e9fc3ddf3';
UPDATE lab_stations SET rotation_minutes = 25
WHERE lab_day_id = '9245f49b-0e89-4b8d-8319-d26ab5452fce'
   OR lab_day_id IN (SELECT lab_day_id FROM _g15_pals_new);

-- ── Re-point the 2 whole-day calendar blocks' section number (same
-- lab_day_id -- no relinking needed -- just NULL/1 -> 2, the kept rows'
-- new section_number). ──
UPDATE pmi_schedule_blocks
SET linked_section_number = 2, updated_at = now()
WHERE id IN ('4d877edc-84f8-4738-bc3e-f85052a980d3', 'e376419b-42f4-49ba-ba48-95af3ed1ea67');

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- UPDATE pmi_schedule_blocks b SET linked_section_number = o.linked_section_number, updated_at = o.updated_at
--   FROM _backup_pmi_schedule_blocks_g15_palsregen_20261026 o WHERE b.id = o.id;
-- DELETE FROM lab_stations WHERE lab_day_id IN (SELECT lab_day_id FROM lab_days ld
--   WHERE ld.cohort_id = '856bcf1d-2e85-48b5-92a3-aba941103109' AND ld.source_template_id IN (
--     '7ff1edd7-8024-425d-a8ff-c37835be19d4', 'cf11a5e1-392f-455b-960d-27a8c3146a75',
--     '6678503b-5c52-48ba-8a80-99292b73da99'));
-- DELETE FROM lab_days WHERE cohort_id = '856bcf1d-2e85-48b5-92a3-aba941103109'
--   AND source_template_id IN (
--     '7ff1edd7-8024-425d-a8ff-c37835be19d4', 'cf11a5e1-392f-455b-960d-27a8c3146a75',
--     '6678503b-5c52-48ba-8a80-99292b73da99');
-- DELETE FROM lab_stations WHERE lab_day_id IN ('6126cdaf-51d8-4de8-9f78-501e9fc3ddf3', '9245f49b-0e89-4b8d-8319-d26ab5452fce');
-- INSERT INTO lab_stations SELECT * FROM _backup_lab_stations_g15_palsregen_20261026;
-- UPDATE lab_days ld SET
--   title = o.title, section_number = o.section_number, section_label = o.section_label,
--   cert_course = o.cert_course, is_adv_cert_testing = o.is_adv_cert_testing, lab_mode = o.lab_mode,
--   source_template_id = o.source_template_id, priority_flag = o.priority_flag,
--   start_time = o.start_time, end_time = o.end_time
--   FROM _backup_lab_days_g15_palsregen_20261026 o WHERE ld.id = o.id;
-- DELETE FROM lab_template_stations WHERE template_id = '5dc0fa9b-f978-4b42-b83f-6f5d0089e45b' AND sort_order = 4;
-- UPDATE lab_template_stations s SET station_name = o.station_name, notes = o.notes, metadata = o.metadata
--   FROM _backup_lab_template_stations_g15_palsregen_20261026 o WHERE s.id = o.id;
-- UPDATE lab_day_templates SET cert_course = 'pals',
--   review_notes = 'Same ambiguous-naming footgun as the ACLS pair (see 2026-09-14 G15 ACLS regen) -- flagged 2026-07-15, not yet resolved: still cert_course=''pals'' so the generator would pick this UP ALONGSIDE the 2026-07-15 sectioned PALS templates for a future cohort. Needs Ben''s go to set cert_course=NULL before G15''s Nov PALS course is generated.',
--   updated_by = 'claude-code-task-handoff-queue:g15-acls-regen'
--   WHERE id IN ('07501712-fc21-4794-b5e5-53dfb847a5d6', 'e980c3e6-a23e-4494-958d-c16817939887');
-- DROP TABLE IF EXISTS _backup_lab_days_g15_palsregen_20261026;
-- DROP TABLE IF EXISTS _backup_lab_stations_g15_palsregen_20261026;
-- DROP TABLE IF EXISTS _backup_pmi_schedule_blocks_g15_palsregen_20261026;
-- DROP TABLE IF EXISTS _backup_lab_template_stations_g15_palsregen_20261026;
-- COMMIT;
