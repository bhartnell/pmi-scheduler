#!/usr/bin/env node
/**
 * Stage 2b — build G14's ACLS lab SECTIONS additively.
 *
 * ADDITIVE ONLY: creates section 2/3 lab_days (+ their stations) alongside the
 * existing section-1 monolithic day. Does NOT touch section 1, the schedule
 * blocks, or any adjusted times. Idempotent — skips a section that already
 * exists (matched by cohort+date+section_number).
 *
 * Instructors are intentionally LEFT BLANK on the new sections — the user
 * assigns them afterward via the Edit Station modal (the path that writes
 * station_instructors and pushes to Google Calendar).
 *
 * Times are the user's CURRENT block times (2026-06-17). Rotation params per the
 * confirmed spec; cardiac-arrest per-station duration is intentionally a GAP.
 *
 * Usage: node scripts/build-g14-acls-sections.js [--dry-run]
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

const dryRun = process.argv.includes('--dry-run');
const COHORT = '8577fdc3-eff6-4000-9302-1ee6e3043eeb'; // G14
const D1 = '2026-06-18';
const D2 = '2026-06-19';
const ROOMS = ['Classroom 1', 'Lab Room 2', 'Back Lab Area', 'Lab Room 1'];

// Section build spec (confirmed with user 2026-06-17).
const SECTIONS = [
  {
    date: D1, section_number: 2, section_label: 'Learning — Cardiac Arrest',
    title: 'ACLS Day 1 — Cardiac Arrest (Learning)',
    start: '14:00', end: '16:00', num_rotations: 4, rotation_duration: null, // per-station = GAP
    lab_mode: 'group_rotations', testing: false, station_rot_min: null,
    stations: [
      { case: 'CASE_34' }, { case: 'CASE_36' }, { case: 'CASE_39' }, { case: 'CASE_40' },
    ],
  },
  {
    date: D1, section_number: 3, section_label: 'Learning — Brady/Tachy',
    title: 'ACLS Day 1 — Brady/Tachy (Learning)',
    start: '16:30', end: '17:15', num_rotations: 4, rotation_duration: 10, // 6 station + 4 debrief
    lab_mode: 'group_rotations', testing: false, station_rot_min: 10,
    stations: [
      { case: null, title: 'Brady/Tachy Scenario 1' }, { case: null, title: 'Brady/Tachy Scenario 2' },
      { case: null, title: 'Brady/Tachy Scenario 3' }, { case: null, title: 'Brady/Tachy Scenario 4' },
    ],
  },
  {
    date: D2, section_number: 2, section_label: 'Megacode Practice',
    title: 'ACLS Day 2 — Megacode Practice',
    start: '09:45', end: '12:00', num_rotations: 2, rotation_duration: 25, // 5 prebrief + 10 + 10
    lab_mode: 'group_rotations', testing: false, station_rot_min: 25,
    stations: [
      { case: 'CASE_48' }, { case: 'CASE_49' }, { case: 'CASE_50' }, { case: 'CASE_51' },
      { case: 'CASE_52' }, { case: 'CASE_53' }, { case: 'CASE_54' }, { case: 'CASE_55' },
    ],
  },
  {
    date: D2, section_number: 3, section_label: 'Megacode Testing',
    title: 'ACLS Day 2 — Megacode Testing (Scored)',
    start: '14:00', end: '15:00', num_rotations: 1, rotation_duration: 10, // 10 min/station
    lab_mode: 'individual_testing', testing: true, station_rot_min: 10,
    stations: [
      { case: 'MEGACODE_TEST_2' }, { case: 'MEGACODE_TEST_4' },
      { case: 'MEGACODE_TEST_9' }, { case: 'MEGACODE_TEST_10' },
    ],
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const plan = [];
  const stats = { sectionsNew: 0, sectionsExist: 0, stations: 0, scenMissing: [] };
  try {
    await c.query('BEGIN');
    const semester = (await c.query('SELECT current_semester FROM cohorts WHERE id=$1', [COHORT])).rows[0]?.current_semester ?? null;
    // case_code -> scenario_id (ACLS)
    const scenRows = (await c.query(`SELECT id, case_code FROM scenarios WHERE cert_course='acls' AND case_code IS NOT NULL`)).rows;
    const scenByCode = {}; for (const r of scenRows) scenByCode[r.case_code] = r.id;

    for (const s of SECTIONS) {
      const existing = (await c.query(
        'SELECT id FROM lab_days WHERE cohort_id=$1 AND date=$2 AND section_number=$3', [COHORT, s.date, s.section_number]
      )).rows[0];
      if (existing) {
        stats.sectionsExist++;
        plan.push(`EXISTS  ${s.date} sec${s.section_number} "${s.section_label}" — skipped (${existing.id})`);
        continue;
      }
      const ins = await c.query(
        `INSERT INTO lab_days (cohort_id, date, section_number, section_label, title, semester, start_time, end_time,
             num_rotations, rotation_duration, lab_mode, cert_course, is_adv_cert_testing, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'acls',$12,$13) RETURNING id`,
        [COHORT, s.date, s.section_number, s.section_label, s.title, semester, s.start, s.end,
         s.num_rotations, s.rotation_duration, s.lab_mode, s.testing, `ACLS section: ${s.section_label}`]
      );
      const labDayId = ins.rows[0].id;
      stats.sectionsNew++;
      plan.push(`CREATE  ${s.date} sec${s.section_number} "${s.section_label}" ${s.start}-${s.end} | rot ${s.num_rotations}x${s.rotation_duration ?? 'GAP'} | ${s.lab_mode}${s.testing ? ' | TESTING' : ''}`);

      let n = 0;
      for (const st of s.stations) {
        n++;
        const room = ROOMS[(n - 1) % ROOMS.length];
        const scenId = st.case ? (scenByCode[st.case] || null) : null;
        if (st.case && !scenId && !stats.scenMissing.includes(st.case)) stats.scenMissing.push(st.case);
        const customTitle = st.title || st.case || null;
        await c.query(
          `INSERT INTO lab_stations (lab_day_id, station_number, station_type, scenario_id, custom_title, room, rotation_minutes, num_rotations, station_notes)
           VALUES ($1,$2,'scenario',$3,$4,$5,$6,$7,$8)`,
          [labDayId, n, scenId, customTitle, room, s.station_rot_min, s.num_rotations, s.section_label]
        );
        stats.stations++;
        plan.push(`  STN #${n} ${room} ${st.case || st.title || ''}${st.case && !scenId ? '  ⚠ scenario not found (kept as title)' : ''} rot=${s.station_rot_min ?? 'GAP'}min`);
      }
    }

    console.log('--- PLAN ---');
    for (const p of plan) console.log(p);
    console.log('--- SUMMARY ---');
    console.log(`sections: ${stats.sectionsNew} new / ${stats.sectionsExist} already existed`);
    console.log(`stations: ${stats.stations} created`);
    if (stats.scenMissing.length) console.log(`note: case codes with no matching scenario (kept as custom_title): ${stats.scenMissing.join(', ')}`);

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back, nothing persisted.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally { await c.end(); }
}
main();
