-- Migration: pals_certification_template_seed
--
-- PALS Hub Build Plan (docs/pals/PALS_Hub_Build_Plan.md), Phase 5 — content
-- population. Seeds the AHA-2025 Section A/B/C/D/E structure (from
-- docs/pals/PALS_2025_Day_Structure.md sections 1-4 + the locked selections
-- in docs/pals/pals_scenario_seed.json's program_testing_selection /
-- program_practice_selection) as a NEW set of lab_day_templates +
-- lab_template_stations rows, so lib/aha-course-generator.ts can stand up a
-- properly-sectioned PALS course for any FUTURE cohort. Mirrors the ACLS
-- certification template seed (20260713_acls_certification_template_seed.sql)
-- exactly in shape and guardrail posture.
--
-- Does NOT touch G14's live PALS lab_days (6aec40f8-... 7/16 practice,
-- e319dc4b-...5c60... 7/17 testing) or their 15 lab_stations rows, and does
-- NOT touch the two pre-existing cert_course='pals' stub templates Ben
-- created by hand (e980c3e6-... "PALS Certification — Day 1" flat/12-station,
-- 07501712-... "PALS Certification — Day 2" flat/3-station) that those G14
-- days already link to via source_template_id — those are read-only
-- reference here, left completely alone. Pure new INSERTs.
--
-- ⚠ FLAGGED FOR BEN (not resolved here, needs a decision before this
-- template is used to generate a future cohort): once this A-E template is
-- ready to become the live PALS generation path, the two old flat stub
-- templates should have cert_course set to NULL (exactly like the two old
-- ACLS stubs b0b27a24-.../3b12db4b-... were left NULL) so
-- generateAhaCourseForCohort's `.eq('cert_course','pals')` query picks up
-- ONLY this 5-section template, not both flat-stub days AND the 5 sections
-- (which would double-create a future cohort's PALS days). Not done here —
-- it's a switch-over decision about live generation, not a data-safety
-- no-brainer, and touches rows Ben authored directly.
--
-- ⚠ SECTION B/C/D CASE-TO-STATION ASSIGNMENT IS DELIBERATELY LEFT OPEN.
-- PALS_2025_Day_Structure.md section 4 locks WHICH 12 cases make up the
-- practice set (4 Respiratory / 4 Shock / 4 Arrhythmia,
-- program_practice_selection in pals_scenario_seed.json) and locks the 3
-- TESTING rounds (07/09/13, program_testing_selection) — but it does NOT
-- say which 4 of the 12 practice cases run in Section B vs C vs D. Inventing
-- that split would be fabricated scheduling content per the source doc, so
-- every B/C/D station here is a "case TBD" scenario slot carrying the full
-- locked pool in its metadata/description; the instructor picks per station
-- via the normal Assign UI (same instructor-selection posture the source
-- doc already prescribes for Section E instead of AHA's random draw).
--
-- ⚠ GRADING-MODEL GAP (flagged, NOT fixed here): PALS_2025_Day_Structure.md
-- requires practice (Sections B/C/D) to be graded formative — NO PASS/NR,
-- 0-4 team-leader rubric instead (pals_scenario_seed.json
-- grading_model.practice). The live schema (pals_test_attempts.result CHECK
-- IN ('PASS','NR'), NOT NULL, no rubric column) and /labs/pals/grade both
-- force every attempt — practice or testing — through the same PASS/NR
-- flow. pals_test_attempts has 0 rows in production, so this is a low-risk
-- schema change, but it also rewrites live grading-page UI/behavior days
-- before G14's actual PALS course (7/16-7/17) — flagged to Ben rather than
-- rushed through here.
--
-- Additive + idempotent (guarded on cert_course+day_number+section_number /
-- template_id+sort_order, matching the generator's own idempotency key).

WITH new_templates AS (
  INSERT INTO lab_day_templates
    (name, description, category, program, day_number, section_number, section_label,
     cert_course, is_adv_cert_testing, lab_mode, instructor_count, is_anchor, template_data, created_by)
  SELECT v.name, v.description, v.category, v.program, v.day_number, v.section_number, v.section_label,
         v.cert_course, v.is_adv_cert_testing, v.lab_mode, v.instructor_count, v.is_anchor, '{}'::jsonb,
         'claude-code-task-handoff-queue:pals-hub-build-plan-phase5'
  FROM (VALUES
    ('PALS Certification — Day 1, Section A (Learning Stations)'::text,
     'AHA 2025: 3 stations, 20 min each, ratio 6:1 (max 8:1). NOT graded in the app — attestation + printable competency sheet (pals_skill_completions table exists, no capture UI yet — flagged separately, out of Phase 5/6 scope). 2025 runs only ONE rhythm station (2020 ran two).'::text,
     'certification'::text, 'paramedic'::text, 1, 2, 'Section A — Learning Stations'::text, 'pals'::text, false, 'group_rotations'::text, 3, true),
    ('PALS Certification — Day 1, Section B (Case Scenario Practice)',
     'AHA 2025: 4 stations, rotate, NEW team leader each rotation, 25 min/case (5 prebrief / 10 sim / 10 debrief). Graded formative (checklist mirrors testing + 0-4 TL rubric, NO PASS/NR — see grading-model-gap note on this migration). Case-to-station assignment is instructor-selected from the locked 12-case practice pool (docs/pals/pals_scenario_seed.json -> program_practice_selection) — AHA_2025_Day_Structure.md section 4 does not assign specific cases to B vs C vs D, so none is fabricated here.',
     'certification', 'paramedic', 1, 3, 'Section B — Case Scenario Practice (4 cases)', 'pals', false, 'group_rotations', 4, true),
    ('PALS Certification — Day 2, Section C (Case Scenario Practice)',
     'AHA 2025: 4 stations, rotate, NEW team leader each rotation, 25 min/case (5 prebrief / 10 sim / 10 debrief). Graded formative, NO PASS/NR. Case-to-station assignment instructor-selected from the same locked 12-case practice pool as Section B — see that section''s description.',
     'certification', 'paramedic', 2, 2, 'Section C — Case Scenario Practice (4 cases)', 'pals', false, 'group_rotations', 4, true),
    ('PALS Certification — Day 2, Section D (Case Scenario Practice)',
     'AHA 2025: 4 stations, rotate, NEW team leader each rotation, 25 min/case (5 prebrief / 10 sim / 10 debrief). Graded formative, NO PASS/NR. Case-to-station assignment instructor-selected from the same locked 12-case practice pool as Section B — see that section''s description. Practice total across B+C+D = 4+4+4 = 12 cases (4 Respiratory / 4 Shock / 4 Arrhythmia), AHA-compliant.',
     'certification', 'paramedic', 2, 3, 'Section D — Case Scenario Practice (4 cases)', 'pals', false, 'group_rotations', 4, true),
    ('PALS Certification — Day 2, Section E (Case Scenario Testing)',
     'AHA 2025: 4 physical stations x 3 synchronized rounds, 25 min/round, all 4 stations run the SAME case per round (program uses instructor-SELECTED cases, not AHA''s random draw — pals_scenario_seed.json.selection_policy). One graded Team Leader per station per round, others = team members. PASS 2 of 3. The 3 rounds are locked (program_testing_selection): Round 1 Shock/PALS_TEST_CASE_07, Round 2 Cardiac/PALS_TEST_CASE_09, Round 3 Respiratory/PALS_TEST_CASE_13 — matches G14''s live 7/17 testing day exactly. Modeled here as 3 round-slots (not 4 physical-station rows) since pals_test_attempts grades by student+scenario+lab_day, not by physical station — same round-centric shape G14''s live day already uses successfully.',
     'certification', 'paramedic', 2, 4, 'Section E — Case Scenario Testing', 'pals', true, 'individual_testing', 4, true)
  ) AS v(name, description, category, program, day_number, section_number, section_label, cert_course, is_adv_cert_testing, lab_mode, instructor_count, is_anchor)
  WHERE NOT EXISTS (
    SELECT 1 FROM lab_day_templates t
    WHERE t.cert_course = 'pals' AND t.day_number = v.day_number AND t.section_number = v.section_number
  )
  RETURNING id, day_number, section_number
)
INSERT INTO lab_template_stations (template_id, station_type, station_name, scenario_id, scenario_title, sort_order, notes, metadata)
SELECT nt.id, x.station_type, x.station_name, x.scenario_id, x.scenario_title, x.sort_order, x.notes, x.metadata
FROM new_templates nt
JOIN (VALUES
  -- Day 1, Section A — Learning Stations (3, NOT graded, attestation only)
  (1, 2, 'skills'::text, 'Airway Management (Lesson 7C)'::text, NULL::uuid, NULL::text, 1,
    'High- vs low-flow O2 (NC max 4 L/min); head tilt-chin lift + jaw thrust; titrate FiO2 to SpO2 94-99% post-ROSC; OPA indications/sizing/insertion; suction <=10s; mask sizing; E-C clamp bag-mask ventilation.'::text,
    '{"duration_minutes":20,"ratio":"6:1 (max 8:1)","grading":"attestation_only","equipment":"2-3 pediatric intubatable airway manikins + intubation equipment"}'::jsonb),
  (1, 2, 'skills', 'Vascular Access / IO (Lesson 8C)', NULL, NULL, 2,
    'Discuss indications AND contraindications for IO, and demonstrate IO insertion; 3-way stopcock; rapid IV/IO bolus.',
    '{"duration_minutes":20,"ratio":"6:1 (max 8:1)","grading":"attestation_only","equipment":"IO-capable infant manikins + IO drills"}'::jsonb),
  (1, 2, 'skills', 'Rhythm Disturbances / Electrical Therapy (Lesson 9C)', NULL, NULL, 3,
    'ECG leads, monitor + rhythm strip, pad placement, defibrillation 2-4 J/kg, synchronized cardioversion 0.5-1 J/kg, rhythm recognition. Students demonstrate one at a time. 2025 has only ONE rhythm station (2020 ran two) — program choice to run more is a throughput decision, not an AHA structure.',
    '{"duration_minutes":20,"ratio":"6:1 (max 8:1)","grading":"attestation_only","equipment":"ALS Baby + rhythm generator, or high-fidelity manikin"}'::jsonb),

  -- Day 1, Section B — Case Scenario Practice (case TBD, instructor-selected from locked pool)
  (1, 3, 'scenario', 'Practice Station 1 (case TBD — instructor selects from locked pool)', NULL, NULL, 1,
    'Locked 12-case practice pool (program_practice_selection): Respiratory = PALS_PRACTICE_04, PALS_PRACTICE_03, PALS_TEST_CASE_06, PALS_PRACTICE_15. Shock = PALS_PRACTICE_02, PALS_PRACTICE_08, PALS_PRACTICE_13, PALS_PRACTICE_14. Arrhythmia = PALS_PRACTICE_05, PALS_PRACTICE_12, PALS_PRACTICE_10, PALS_TEST_CASE_14. Assign via the section''s Edit/Assign page.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)","practice_pool":["PALS_PRACTICE_04","PALS_PRACTICE_03","PALS_TEST_CASE_06","PALS_PRACTICE_15","PALS_PRACTICE_02","PALS_PRACTICE_08","PALS_PRACTICE_13","PALS_PRACTICE_14","PALS_PRACTICE_05","PALS_PRACTICE_12","PALS_PRACTICE_10","PALS_TEST_CASE_14"]}'::jsonb),
  (1, 3, 'scenario', 'Practice Station 2 (case TBD — instructor selects from locked pool)', NULL, NULL, 2, 'See Station 1 notes for the full locked pool.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (1, 3, 'scenario', 'Practice Station 3 (case TBD — instructor selects from locked pool)', NULL, NULL, 3, 'See Station 1 notes for the full locked pool.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (1, 3, 'scenario', 'Practice Station 4 (case TBD — instructor selects from locked pool)', NULL, NULL, 4, 'See Station 1 notes for the full locked pool.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),

  -- Day 2, Section C — Case Scenario Practice
  (2, 2, 'scenario', 'Practice Station 1 (case TBD — instructor selects from locked pool)', NULL, NULL, 1,
    'Same locked 12-case pool as Day 1 Section B (see that section''s description). Assign via the section''s Edit/Assign page.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (2, 2, 'scenario', 'Practice Station 2 (case TBD — instructor selects from locked pool)', NULL, NULL, 2, 'Same locked 12-case pool as Day 1 Section B.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (2, 2, 'scenario', 'Practice Station 3 (case TBD — instructor selects from locked pool)', NULL, NULL, 3, 'Same locked 12-case pool as Day 1 Section B.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (2, 2, 'scenario', 'Practice Station 4 (case TBD — instructor selects from locked pool)', NULL, NULL, 4, 'Same locked 12-case pool as Day 1 Section B.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),

  -- Day 2, Section D — Case Scenario Practice
  (2, 3, 'scenario', 'Practice Station 1 (case TBD — instructor selects from locked pool)', NULL, NULL, 1,
    'Same locked 12-case pool as Day 1 Section B (see that section''s description). Assign via the section''s Edit/Assign page.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (2, 3, 'scenario', 'Practice Station 2 (case TBD — instructor selects from locked pool)', NULL, NULL, 2, 'Same locked 12-case pool as Day 1 Section B.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (2, 3, 'scenario', 'Practice Station 3 (case TBD — instructor selects from locked pool)', NULL, NULL, 3, 'Same locked 12-case pool as Day 1 Section B.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),
  (2, 3, 'scenario', 'Practice Station 4 (case TBD — instructor selects from locked pool)', NULL, NULL, 4, 'Same locked 12-case pool as Day 1 Section B.',
    '{"duration_minutes":25,"structure":"5 prebrief / 10 simulation / 10 debrief","tl_rule":"new team leader each rotation","grading":"formative — mirrors testing checklist + 0-4 TL rubric, NO PASS/NR (app gap, flagged)"}'::jsonb),

  -- Day 2, Section E — Case Scenario Testing (locked rounds, matches G14's live 7/17 day)
  (2, 4, 'scenario', 'Round 1 — Shock (PALS_TEST_CASE_07)', '4c40c57e-3f99-45f5-9b56-362c8a471ac6'::uuid, 'Distributive Shock (Infant; Septic)', 1,
    'All 4 physical stations run this SAME case in round 1. One graded Team Leader per station; others = team members.',
    '{"round":1,"category":"Shock","physical_stations":4,"duration_minutes":25,"pass_rule":"PASS 2 of 3","selection_mode":"instructor_selected_not_random_draw"}'::jsonb),
  (2, 4, 'scenario', 'Round 2 — Cardiac (PALS_TEST_CASE_09)', '8c541c3c-09b3-4698-afde-fea805c0a88e'::uuid, 'Supraventricular Tachycardia (Infant, 3 mo)', 2,
    'All 4 physical stations run this SAME case in round 2. One graded Team Leader per station; others = team members.',
    '{"round":2,"category":"Cardiac","physical_stations":4,"duration_minutes":25,"pass_rule":"PASS 2 of 3","selection_mode":"instructor_selected_not_random_draw"}'::jsonb),
  (2, 4, 'scenario', 'Round 3 — Respiratory (PALS_TEST_CASE_13)', '1005de23-d826-4466-97e2-8f3fa0a7fe18'::uuid, 'Disordered Control of Breathing (Child)', 3,
    'All 4 physical stations run this SAME case in round 3. One graded Team Leader per station; others = team members.',
    '{"round":3,"category":"Respiratory","physical_stations":4,"duration_minutes":25,"pass_rule":"PASS 2 of 3","selection_mode":"instructor_selected_not_random_draw"}'::jsonb)
) AS x(day_number, section_number, station_type, station_name, scenario_id, scenario_title, sort_order, notes, metadata)
  ON x.day_number = nt.day_number AND x.section_number = nt.section_number
WHERE NOT EXISTS (
  SELECT 1 FROM lab_template_stations s WHERE s.template_id = nt.id AND s.sort_order = x.sort_order
);

-- ROLLBACK: (pure inserts — safe to delete by the created_by tag)
-- DELETE FROM lab_template_stations WHERE template_id IN (
--   SELECT id FROM lab_day_templates WHERE created_by = 'claude-code-task-handoff-queue:pals-hub-build-plan-phase5'
-- );
-- DELETE FROM lab_day_templates WHERE created_by = 'claude-code-task-handoff-queue:pals-hub-build-plan-phase5';
