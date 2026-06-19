#!/usr/bin/env node
/**
 * Day-2 (2026-06-19) megacode clean structure:
 *   PRACTICE — 2 timed sets:
 *     Set 1 = existing sec2 (relabel "Megacode Practice — Set 1", retime 08:30-10:00),
 *             stations 67/68/69/70 unchanged → keeps its 7 instructor assignments.
 *     Set 2 = NEW section, stations 71/72/73/74 (10:15-11:45). Instructors assigned live.
 *   TESTING — paired (re-point sec3, station rows kept → 7 assignments preserved):
 *     #1 → MEGACODE_TEST_1, #2 → MEGACODE_TEST_1, #3 → MEGACODE_TEST_3, #4 = MEGACODE_TEST_3.
 *     Retest pool MEGACODE_TEST_2 / _4 stays off-station.
 *   MONOLITH — relabel sec1 (5c7f74f6) "[ARCHIVED] ..." (already hub-hidden).
 *   BLOCKS — rebuild Day-2 schedule blocks for the two practice sessions.
 *
 * Re-pointing only changes lab_stations.scenario_id → station rows (and their
 * station_instructors) survive. --dry-run runs in a transaction and ROLLS BACK.
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
const COHORT = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';
const PS = '26d1db7d-edeb-41ce-817b-f74f1b458951';
const SEM = '638470a7-5320-4c98-b690-1c77aae710f4';
const D2 = '2026-06-19';
const SEC2 = 'aebf842d-f2e4-41b5-8cf5-264cee7ef7ac'; // practice (Set 1)
const SEC3 = '85808c0a-3afe-4fde-a2a6-fc74824ac417'; // testing
const SEC1 = '5c7f74f6-7d89-4f8e-8f03-e0b9c45b6b37'; // monolith
const ROOMS = ['Classroom 1', 'Lab Room 2', 'Back Lab Area', 'Lab Room 1'];
const SET2_CASES = ['CASE_71', 'CASE_72', 'CASE_73', 'CASE_74'];
const TESTING_PAIRED = { 1: 'MEGACODE_TEST_1', 2: 'MEGACODE_TEST_1', 3: 'MEGACODE_TEST_3' }; // #4 already TEST_3
const dow = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); };

async function scenId(c, code) {
  const r = (await c.query("select id from scenarios where case_code=$1 and cert_course='acls'", [code])).rows[0];
  if (!r) throw new Error(`scenario ${code} not found`);
  return r.id;
}

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');

    // --- read Set 1 config to mirror for Set 2 ---
    const s2 = (await c.query('select semester, num_rotations, rotation_duration, lab_mode, cert_course from lab_days where id=$1', [SEC2])).rows[0];

    // --- Set 1: relabel + retime ---
    await c.query("update lab_days set section_label='Megacode Practice — Set 1', start_time='08:30', end_time='10:00' where id=$1", [SEC2]);
    console.log('Set 1 (sec2): relabeled + retimed 08:30-10:00 (stations 67-70 + 7 assignments untouched)');

    // --- Set 2: create new section (next section_number) + 4 stations ---
    const maxsec = (await c.query("select coalesce(max(section_number),0)+1 n from lab_days where cohort_id=$1 and date=$2", [COHORT, D2])).rows[0].n;
    const ins = await c.query(
      `insert into lab_days (cohort_id, date, section_number, section_label, title, semester, start_time, end_time,
          num_rotations, rotation_duration, lab_mode, cert_course, is_adv_cert_testing, notes)
       values ($1,$2,$3,'Megacode Practice — Set 2','ACLS Day 2 — Megacode Practice (Set 2)',$4,'10:15','11:45',$5,$6,$7,'acls',false,'ACLS megacode practice Set 2') returning id`,
      [COHORT, D2, maxsec, s2.semester, s2.num_rotations, s2.rotation_duration, s2.lab_mode]
    );
    const SET2 = ins.rows[0].id;
    console.log(`Set 2 (sec${maxsec}): created ${SET2} 10:15-11:45 | rot ${s2.num_rotations}x${s2.rotation_duration}`);
    for (let i = 0; i < SET2_CASES.length; i++) {
      const n = i + 1; const sid = await scenId(c, SET2_CASES[i]);
      await c.query(
        `insert into lab_stations (lab_day_id, station_number, station_type, scenario_id, custom_title, room, rotation_minutes, num_rotations, station_notes)
         values ($1,$2,'scenario',$3,$4,$5,$6,$7,'Megacode Practice — Set 2')`,
        [SET2, n, sid, SET2_CASES[i], ROOMS[i % ROOMS.length], s2.rotation_duration, s2.num_rotations]
      );
      console.log(`   Set 2 #${n} ${ROOMS[i % ROOMS.length]} -> ${SET2_CASES[i]}`);
    }

    // --- Testing: re-point to paired (keep station rows → assignments preserved) ---
    for (const [stn, code] of Object.entries(TESTING_PAIRED)) {
      const sid = await scenId(c, code);
      const r = await c.query('update lab_stations set scenario_id=$1 where lab_day_id=$2 and station_number=$3', [sid, SEC3, Number(stn)]);
      console.log(`Testing #${stn} -> ${code} (${r.rowCount} row)`);
    }

    // --- Monolith: relabel archived ---
    const arch = await c.query(
      "update lab_days set section_label='[ARCHIVED] ACLS Day 2 (superseded by sections)', title='[ARCHIVED] ACLS Certification — Day 2 (superseded)' where id=$1 and coalesce(title,'') not like '[ARCHIVED]%'", [SEC1]
    );
    console.log(`Monolith sec1: ${arch.rowCount ? 'relabeled [ARCHIVED]' : 'already archived'}`);

    // --- Rebuild Day-2 schedule blocks for the two practice sessions ---
    const old = (await c.query(
      "select psb.id from pmi_schedule_blocks psb join pmi_program_schedules pps on psb.program_schedule_id=pps.id where pps.cohort_id=$1 and psb.date=$2", [COHORT, D2]
    )).rows.map(r => r.id);
    if (old.length) {
      await c.query('delete from pmi_block_instructors where schedule_block_id = any($1)', [old]);
      await c.query('delete from pmi_schedule_blocks where id = any($1)', [old]);
    }
    const AG = [
      { s: '08:30', e: '10:00', t: 'lab', title: 'ACLS LAB · Megacode Practice — Set 1 (live demo Lesson 9B + rotations, NO video)', link: SEC2, n: 2 },
      { s: '10:00', e: '10:15', t: 'other', title: 'ACLS · Break' },
      { s: '10:15', e: '11:45', t: 'lab', title: 'ACLS LAB · Megacode Practice — Set 2 (NO video)', link: SET2, n: maxsec },
      { s: '11:45', e: '12:00', t: 'other', title: 'ACLS · Break / Testing Setup' },
      { s: '12:00', e: '13:00', t: 'other', title: 'ACLS · Lunch' },
      { s: '13:00', e: '14:15', t: 'lab', title: 'ACLS LAB · Megacode Testing — Scored, paired (stn 1-2 TEST_1 · stn 3-4 TEST_3; NO video)', link: SEC3, n: 3 },
      { s: '14:15', e: '15:00', t: 'exam', title: 'ACLS · Written Exam' },
      { s: '15:00', e: '15:15', t: 'meeting', title: 'ACLS · End of Day 2' },
    ];
    let sort = 0;
    for (const b of AG) {
      sort++;
      await c.query(
        `insert into pmi_schedule_blocks (semester_id, program_schedule_id, date, day_of_week, start_time, end_time, block_type, title, course_name, status, sort_order, is_recurring, linked_lab_day_id, linked_section_number)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'ACLS','published',$9,false,$10,$11)`,
        [SEM, PS, D2, dow(D2), b.s, b.e, b.t, b.title, sort, b.link || null, b.n || null]
      );
      console.log(`  block ${b.s}-${b.e} [${b.t}] ${b.title}${b.link ? '  →sec' + b.n : ''}`);
    }

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
