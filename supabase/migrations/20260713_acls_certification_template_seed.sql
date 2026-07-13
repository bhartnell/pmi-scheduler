-- Migration: acls_certification_template_seed
--
-- Task Handoff Queue: "AHA HUB + ACLS REPEATABLE - phased overnight build",
-- Phase 2 (ACLS course template). Seeds the ACLS half of the AHA-generic
-- course template (schema added in 20260713_aha_generic_course_templates.sql)
-- so lib/aha-course-generator.ts can stand up an ACLS course for ANY
-- cohort, mirroring the PALS template already seeded by hand in
-- Checkpoint B (see docs/CHANGELOG.md 2026-07-13, commit 22b0600d).
--
-- Read G14's live ACLS lab_days/lab_stations (cohort 8577fdc3-...) to
-- derive this structure. Does NOT modify any G14 row — this is pure new
-- INSERTs into lab_day_templates/lab_template_stations. Verified live
-- before and after: G14's 9 lab_days rows are byte-for-byte unchanged.
--
-- Deliberately excludes G14's Day-1 Section 1 (unlabeled, still linked via
-- source_template_id to the pre-existing stub b0b27a24-f03a-4700-afa0-
-- 6aed8e05a777) and Day-2's already-[ARCHIVED] Section 1 (stub
-- 3b12db4b-6019-4770-be4f-f254555b3f9b) - Day-1 Section 1 reads as the
-- same kind of pre-"sections" leftover Day-2's Section 1 was already
-- explicitly archived for, just never archived itself. Flagged for Ben,
-- not touched here. Both pre-existing stub rows are left untouched
-- (cert_course stays NULL, orphaned/unused by this template) rather than
-- repurposed, since both already carry a source_template_id link into
-- that same stale/archived G14 data.
--
-- Data-quality finding surfaced, not fixed on G14: Day-1 Section 2's live
-- station labels read CASE_34/36/39/40 but the scenarios actually linked
-- are CASE_45/48/47/49; Day-2 Section 3's live MEGACODE_TEST_1..4 labels
-- likewise don't reliably match their linked scenario. This template uses
-- the real linked-scenario data (or, for Section 3, no fixed link at all -
-- ACLS testing draws from the pool at grading time) rather than
-- propagating either mismatch.
--
-- Additive + idempotent (guarded on cert_course+day_number+section_number
-- / template_id+sort_order, matching the generator's own idempotency key).

WITH new_templates AS (
  INSERT INTO lab_day_templates
    (name, description, category, program, day_number, section_number, section_label,
     cert_course, is_adv_cert_testing, lab_mode, instructor_count, is_anchor, template_data, created_by)
  SELECT v.name, v.description, v.category, v.program, v.day_number, v.section_number, v.section_label,
         v.cert_course, v.is_adv_cert_testing, v.lab_mode, v.instructor_count, v.is_anchor, '{}'::jsonb,
         'claude-code-task-handoff-queue:aha-hub-acls-repeatable-phase2'
  FROM (VALUES
    ('ACLS Certification — Day 1, Section 2 (Learning — Cardiac Arrest)'::text,
     'Mirrors G14''s live Day-1 Section 2. Note: G14''s live station labels here read CASE_34/36/39/40 but the scenarios actually linked are CASE_45/48/47/49 (verified live, mismatch flagged not fixed on G14). This template uses the real linked scenario data instead of propagating the mismatched labels.'::text,
     'certification'::text, 'paramedic'::text, 1, 2, 'Learning — Cardiac Arrest'::text, 'acls'::text, false, 'group_rotations'::text, 5, true),
    ('ACLS Certification — Day 1, Section 3 (Pre-Arrest Combined)', NULL, 'certification', 'paramedic', 1, 3, 'Pre-Arrest (Combined)', 'acls', false, 'group_rotations', 5, true),
    ('ACLS Certification — Day 1, Section 4 (BLS)', NULL, 'certification', 'paramedic', 1, 4, 'BLS', 'acls', false, 'group_rotations', 5, true),
    ('ACLS Certification — Day 1, Section 5 (Airway)', NULL, 'certification', 'paramedic', 1, 5, 'Airway', 'acls', false, 'group_rotations', 5, true),
    ('ACLS Certification — Day 2, Section 2 (Megacode Practice — Set 1)', NULL, 'certification', 'paramedic', 2, 2, 'Megacode Practice — Set 1', 'acls', false, 'group_rotations', 5, true),
    ('ACLS Certification — Day 2, Section 3 (Megacode Testing)',
     'Testing-day station slots are intentionally left unlinked to a fixed scenario_id: G14''s live Megacode Testing station labels (MEGACODE_TEST_1..4) do not reliably match the scenario each is actually linked to (verified live, flagged not fixed on G14) and testing draws from the ACLS scenario pool at grading time rather than a fixed per-station pick.',
     'certification', 'paramedic', 2, 3, 'Megacode Testing', 'acls', true, 'individual_testing', 5, true),
    ('ACLS Certification — Day 2, Section 4 (Megacode Practice — Set 2)', NULL, 'certification', 'paramedic', 2, 4, 'Megacode Practice — Set 2', 'acls', false, 'group_rotations', 5, true)
  ) AS v(name, description, category, program, day_number, section_number, section_label, cert_course, is_adv_cert_testing, lab_mode, instructor_count, is_anchor)
  WHERE NOT EXISTS (
    SELECT 1 FROM lab_day_templates t
    WHERE t.cert_course = 'acls' AND t.day_number = v.day_number AND t.section_number = v.section_number
  )
  RETURNING id, day_number, section_number
)
INSERT INTO lab_template_stations (template_id, station_type, station_name, scenario_id, scenario_title, sort_order, notes)
SELECT nt.id, x.station_type, x.station_name, x.scenario_id, x.scenario_title, x.sort_order, x.notes
FROM new_templates nt
JOIN (VALUES
  -- Day 1, Section 2 — Learning — Cardiac Arrest
  (1, 2, 'scenario'::text, NULL::text, 'de84284f-9077-483c-b303-a5f97d4a9a5d'::uuid, 'Case 45 — OOH Cardiac Arrest (VF/pVT)'::text, 1, NULL::text),
  (1, 2, 'scenario', NULL, '488c00b4-821d-4c2b-8433-134924ec5e75', 'Case 48 — OOH Cardiac Arrest (VF/pVT)', 2, NULL),
  (1, 2, 'scenario', NULL, '57f1f2a7-31cc-4fbe-b991-57e2efe8c82c', 'Case 47 — OOH Outpatient Clinic Cardiac Arrest (Asystole/PEA)', 3, NULL),
  (1, 2, 'scenario', NULL, 'd545f452-dca2-4f04-a087-5012f80a7045', 'Case 49 — OOH Cardiac Arrest (Asystole/PEA)', 4, NULL),
  -- Day 1, Section 3 — Pre-Arrest (Combined)
  (1, 3, 'scenario', NULL, 'daa9cab9-4ad6-4256-86bf-abf77438095f', 'Case 16 — Tachy/Brady', 1, NULL),
  (1, 3, 'scenario', NULL, '20129cc6-fe5b-490f-afb0-2afad12fd9c8', 'Case 17 — Tachy/Brady', 2, NULL),
  (1, 3, 'scenario', NULL, '899ff297-2bbd-46c4-b188-5dfc600fbd88', 'Case 26 — Tachy/Brady', 3, NULL),
  (1, 3, 'scenario', NULL, '8e310f1c-e9ec-4c89-9ad8-f51e9cc9fe01', 'Case 27 — Tachy/Brady', 4, NULL),
  -- Day 1, Section 4 — BLS
  (1, 4, 'skills', 'Adult BLS', NULL, NULL, 1, NULL),
  (1, 4, 'skills', 'Peds BLS', NULL, NULL, 2, NULL),
  -- Day 1, Section 5 — Airway
  (1, 5, 'skills', 'Airway Management', NULL, NULL, 1, NULL),
  -- Day 2, Section 2 — Megacode Practice Set 1
  (2, 2, 'scenario', NULL, 'ba9d24d5-0dd4-467e-b4b3-f0b6b364fe05', 'OOH Megacode Practice — SVT (Case 67)', 1, NULL),
  (2, 2, 'scenario', NULL, '62665329-7e04-4339-88fc-8842f711a8ce', 'OOH Megacode Practice — VT/Cardioversion (Case 68)', 2, NULL),
  (2, 2, 'scenario', NULL, '874c668d-5e51-43ac-8a7b-41f39e04109d', 'OOH Megacode Practice — Bradycardia (Case 69)', 3, NULL),
  (2, 2, 'scenario', NULL, '082f8a90-7b23-4241-b719-ebb8276a2cf4', 'OOH Megacode Practice — STEMI/Bradycardia (Case 70)', 4, NULL),
  -- Day 2, Section 3 — Megacode Testing (deliberately unlinked slots — see template description)
  (2, 3, 'scenario', 'Megacode Test Station 1', NULL, NULL, 1, 'Scenario drawn from the ACLS testing pool at grading time — see template description for why this is left unlinked.'),
  (2, 3, 'scenario', 'Megacode Test Station 2', NULL, NULL, 2, NULL),
  (2, 3, 'scenario', 'Megacode Test Station 3', NULL, NULL, 3, NULL),
  (2, 3, 'scenario', 'Megacode Test Station 4', NULL, NULL, 4, NULL),
  -- Day 2, Section 4 — Megacode Practice Set 2
  (2, 4, 'scenario', NULL, '446a7141-b3d8-40d8-a588-3acc82d9309a', 'OOH Megacode Practice — Unstable VT (Case 71)', 1, NULL),
  (2, 4, 'scenario', NULL, 'eab99225-3e17-4be0-8506-2bd1aa3a7e51', 'OOH Megacode Practice — Tachycardia (Case 72)', 2, NULL),
  (2, 4, 'scenario', NULL, 'ae039eda-e462-4a01-9595-02b4fcad94b3', 'OOH Megacode Practice — Bradycardia (Case 73)', 3, NULL),
  (2, 4, 'scenario', NULL, 'a6b4c16d-87a9-4287-b2fc-d758c2090ef1', 'OOH Megacode Practice — SVT (Case 74)', 4, NULL)
) AS x(day_number, section_number, station_type, station_name, scenario_id, scenario_title, sort_order, notes)
  ON x.day_number = nt.day_number AND x.section_number = nt.section_number
WHERE NOT EXISTS (
  SELECT 1 FROM lab_template_stations s WHERE s.template_id = nt.id AND s.sort_order = x.sort_order
);

-- ROLLBACK: (pure inserts — safe to delete by the created_by tag)
-- DELETE FROM lab_template_stations WHERE template_id IN (
--   SELECT id FROM lab_day_templates WHERE created_by = 'claude-code-task-handoff-queue:aha-hub-acls-repeatable-phase2'
-- );
-- DELETE FROM lab_day_templates WHERE created_by = 'claude-code-task-handoff-queue:aha-hub-acls-repeatable-phase2';
