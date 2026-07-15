#!/usr/bin/env node
/**
 * G14 PALS — redistribute the flat 12-station Day 1 block into AHA-2025
 * timed sections (mirrors scripts/build-g14-acls-sections.js's approach for
 * ACLS). Source: docs/pals/PALS_2025_Day_Structure.md sections 1-4.
 *
 * PREPARED, NOT AUTO-RUN. Per docs/pals/PALS_Hub_Build_Plan.md ("G14's two
 * PALS days exist ... Ben may restructure into sections himself; ASK before
 * clearing") this touches live stations for a course running 2026-07-16/17 —
 * it needs a human go before landing. Run with --dry-run first (rolls back,
 * prints the plan, no writes) and only with --execute after Ben confirms the
 * mapping below.
 *
 * What it does (all in one transaction, snapshots first):
 *  - Backs up the affected lab_days + lab_stations rows into
 *    _backup_lab_days_g14pals_<ts> / _backup_lab_stations_g14pals_<ts>.
 *  - INSERTs 4 new lab_days section rows: Day1 Section A (learning, 3 new
 *    skills stations) + Section B (practice/Respiratory), Day2 Section C
 *    (practice/Shock) + Section D (practice/Arrhythmia).
 *  - MOVEs 9 existing lab_stations (already correct 2025 scenario_ids, just
 *    sitting in the flat Day-1 block) into their target section via UPDATE
 *    lab_day_id/station_number — scenario_id is never touched, so grading
 *    links and any existing pals_test_attempts.lab_station_id FKs stay valid.
 *  - INSERTs 3 new practice stations for the 3 locked-2025 cases that don't
 *    exist yet anywhere (PALS_PRACTICE_08, PALS_PRACTICE_15, PALS_TEST_CASE_06).
 *  - RENAMEs the existing Day-2 testing lab_day (already correct, T7/T9/T13 —
 *    "keep it" per the build plan) from section_number=1 to section_number=4
 *    ("Section E") — metadata only, its 3 stations are untouched.
 *  - Leaves Day 1's original section-1 row (and its 3 leftover stations —
 *    "PALS Pediatric Megacode Rotations", "PALS Algorithm Review", and
 *    PALS_PRACTICE_01 which isn't in the doc's locked 12-case set) in place,
 *    untouched. Nothing is deleted. Once real sections exist for a date, the
 *    PALS Hub auto-hides that date's section-1 row (display-only filter,
 *    app/labs/pals-hub/page.tsx) so it stops showing without being destroyed.
 *
 * Instructors are intentionally left blank on every new/moved station — same
 * as the ACLS script — assigned afterward via the Edit Station page.
 *
 * Usage: node scripts/build-g14-pals-sections.js --dry-run
 *        node scripts/build-g14-pals-sections.js --execute   (after Ben's go)
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

const execute = process.argv.includes('--execute');
const dryRun = !execute; // default is always a safe dry-run

const COHORT = '8577fdc3-eff6-4000-9302-1ee6e3043eeb'; // G14
const DAY1 = '2026-07-16';
const DAY2 = '2026-07-17';
const DAY1_ID = '6aec40f8-9237-446b-9cb8-15e7ce8c4fa4';
const DAY2_ID = 'e319dc4b-5c60-4ed5-ad1a-7f9f22d4606e';

// New section shells (lab_days rows to INSERT).
const NEW_SECTIONS = [
  { key: 'A', date: DAY1, section_number: 2, section_label: 'Section A — Learning Stations',
    title: 'PALS Day 1 — Section A (Learning Stations)', start: '14:45', end: '15:45',
    num_rotations: 3, rotation_duration: 20, lab_mode: 'group_rotations', testing: false },
  { key: 'B', date: DAY1, section_number: 3, section_label: 'Section B — Practice (Respiratory)',
    title: 'PALS Day 1 — Section B (Practice, Respiratory)', start: '15:50', end: '17:30',
    num_rotations: 4, rotation_duration: 25, lab_mode: 'group_rotations', testing: false },
  { key: 'C', date: DAY2, section_number: 2, section_label: 'Section C — Practice (Shock)',
    title: 'PALS Day 2 — Section C (Practice, Shock)', start: '08:40', end: '10:20',
    num_rotations: 4, rotation_duration: 25, lab_mode: 'group_rotations', testing: false },
  { key: 'D', date: DAY2, section_number: 3, section_label: 'Section D — Practice (Arrhythmia)',
    title: 'PALS Day 2 — Section D (Practice, Arrhythmia)', start: '10:30', end: '12:10',
    num_rotations: 4, rotation_duration: 25, lab_mode: 'group_rotations', testing: false },
];

// Existing lab_stations to MOVE (by their current id) into a target section, in order.
const MOVE_STATIONS = {
  B: ['818cb4bf-e397-4e62-8e97-b9f76f5172b9', '46773aee-351d-4a61-b678-267497206113'], // PRACTICE_04, PRACTICE_03
  C: ['c4d5b23c-bde8-4d76-8ce6-dfe0add08ab2', 'efba2404-a777-4638-b70c-75aed36c722b', '7e07a419-b246-431b-936a-8881f524898c'], // PRACTICE_02, _13, _14
  D: ['e9134562-91fc-4855-9b9b-ccaf6175bcbe', '5750d115-7af1-45a3-964a-c2cd11eb608b', '0cb881fc-0309-4730-866b-68c6d9c512bc', 'a7550ab4-bd97-46c3-8886-e9af634d8b41'], // PRACTICE_05, _12, _10, TEST_CASE_14
};

// New practice stations to INSERT (locked-2025 cases with no existing row).
const NEW_PRACTICE_STATIONS = {
  B: [{ case: 'PALS_TEST_CASE_06' }, { case: 'PALS_PRACTICE_15' }],
  C: [{ case: 'PALS_PRACTICE_08' }],
};

// Section A learning stations (new, no scenario — attestation only).
const SECTION_A_STATIONS = [
  { title: 'Airway Management (7C)', notes: 'High/low-flow O2 (NC max 4 L/min); head tilt-chin lift + jaw thrust; ROSC SpO2 94-99% titration; OPA sizing/insertion; suction <=10s; E-C clamp BMV.' },
  { title: 'Vascular Access / IO (8C)', notes: 'Discuss IO indications AND contraindications, demonstrate IO insertion; 3-way stopcock; rapid IV/IO bolus.' },
  { title: 'Rhythm Disturbances / Electrical Therapy (9C)', notes: 'ECG leads, monitor + rhythm strip, pad placement, defibrillation 2-4 J/kg, synchronized cardioversion 0.5-1 J/kg; one at a time.' },
];

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const plan = [];
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  try {
    await c.query('BEGIN');

    // Snapshot affected rows first (Migration Reversibility rule).
    await c.query(`CREATE TABLE _backup_lab_days_g14pals_${ts} AS SELECT * FROM lab_days WHERE id IN ($1,$2)`, [DAY1_ID, DAY2_ID]);
    await c.query(`CREATE TABLE _backup_lab_stations_g14pals_${ts} AS SELECT * FROM lab_stations WHERE lab_day_id IN ($1,$2)`, [DAY1_ID, DAY2_ID]);
    plan.push(`BACKUP  _backup_lab_days_g14pals_${ts}, _backup_lab_stations_g14pals_${ts}`);

    const semester = (await c.query('SELECT current_semester FROM cohorts WHERE id=$1', [COHORT])).rows[0]?.current_semester ?? null;
    const scenRows = (await c.query(`SELECT id, case_code FROM scenarios WHERE cert_course='pals' AND case_code IS NOT NULL`)).rows;
    const scenByCode = {}; for (const r of scenRows) scenByCode[r.case_code] = r.id;

    const sectionIdByKey = {};
    for (const s of NEW_SECTIONS) {
      const existing = (await c.query(
        'SELECT id FROM lab_days WHERE cohort_id=$1 AND date=$2 AND section_number=$3', [COHORT, s.date, s.section_number]
      )).rows[0];
      if (existing) {
        sectionIdByKey[s.key] = existing.id;
        plan.push(`EXISTS  ${s.date} sec${s.section_number} "${s.section_label}" — skipped (${existing.id})`);
        continue;
      }
      const ins = await c.query(
        `INSERT INTO lab_days (cohort_id, date, section_number, section_label, title, semester, start_time, end_time,
             num_rotations, rotation_duration, lab_mode, cert_course, is_adv_cert_testing, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pals',$12,$13) RETURNING id`,
        [COHORT, s.date, s.section_number, s.section_label, s.title, semester, s.start, s.end,
         s.num_rotations, s.rotation_duration, s.lab_mode, s.testing, `PALS section: ${s.section_label}`]
      );
      sectionIdByKey[s.key] = ins.rows[0].id;
      plan.push(`CREATE  ${s.date} sec${s.section_number} "${s.section_label}" ${s.start}-${s.end}`);
    }

    // Section A — 3 new skills stations.
    let n = 0;
    for (const st of SECTION_A_STATIONS) {
      n++;
      await c.query(
        `INSERT INTO lab_stations (lab_day_id, station_number, station_type, custom_title, station_notes)
         VALUES ($1,$2,'skills',$3,$4)`,
        [sectionIdByKey.A, n, st.title, st.notes]
      );
      plan.push(`  A STN #${n} ${st.title} (skills, attestation-only)`);
    }

    // Move existing scenario stations into B/C/D, then append the new ones.
    for (const key of ['B', 'C', 'D']) {
      let stn = 0;
      for (const id of (MOVE_STATIONS[key] || [])) {
        stn++;
        const row = (await c.query('SELECT station_number, custom_title FROM lab_stations WHERE id=$1', [id])).rows[0];
        if (!row) { plan.push(`  ${key} MOVE ${id} — ⚠ not found, skipped`); continue; }
        await c.query('UPDATE lab_stations SET lab_day_id=$1, station_number=$2 WHERE id=$3', [sectionIdByKey[key], stn, id]);
        plan.push(`  ${key} MOVE  #${stn} ${row.custom_title} (${id})`);
      }
      for (const st of (NEW_PRACTICE_STATIONS[key] || [])) {
        stn++;
        const scenId = scenByCode[st.case] || null;
        if (!scenId) { plan.push(`  ${key} ⚠ scenario not found for ${st.case}, skipped`); continue; }
        await c.query(
          `INSERT INTO lab_stations (lab_day_id, station_number, station_type, scenario_id, custom_title)
           VALUES ($1,$2,'scenario',$3,$4)`,
          [sectionIdByKey[key], stn, scenId, st.case]
        );
        plan.push(`  ${key} NEW   #${stn} ${st.case}`);
      }
    }

    // Rename the existing Day-2 testing lab_day into "Section E" — metadata
    // only, its 3 stations (T7/T9/T13) are untouched per the build plan.
    await c.query(
      `UPDATE lab_days SET section_number=4, section_label='Section E — Case Scenario Testing'
       WHERE id=$1 AND section_number=1`,
      [DAY2_ID]
    );
    plan.push(`RENAME  ${DAY2} lab_day ${DAY2_ID} section 1 -> section 4 "Section E — Case Scenario Testing" (stations untouched)`);

    console.log('--- PLAN ---');
    for (const p of plan) console.log(p);

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back, nothing persisted. Re-run with --execute after Ben confirms the mapping.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally { await c.end(); }
}
main();
