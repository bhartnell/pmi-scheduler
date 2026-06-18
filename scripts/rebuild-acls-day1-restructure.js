#!/usr/bin/env node
/**
 * 2025 "as actually run" restructure of G14 ACLS Day 1 + Day 2 (2026-06-18/19).
 * Reshapes the schedule blocks per Ben's live spec (2026-06-18):
 *  - DROP L4 Technology Review (covered separately for AHA audit).
 *  - DROP the 3 infant-BLS skills blocks (Infant BLS / CPR Skills Test / Choking);
 *    KEEP the BLS Exam (separate BLS class; same format as before).
 *  - ADD L-SA Systematic Approach (after L1) + L1 relabel "Overview + Science".
 *  - ADD "Ryan Intro (temp)" after the L2 BLS station.
 *  - ACS + Stroke → 30-min 3-part videos, moved before lunch (compressed to hit
 *    the hard noon lunch pin; run full-length live).
 *  - L7 HP Teams moved before lunch (the megacode-adjacent video).
 *  - LUNCH hard-pinned 12:00-13:00 (both days).
 *  - SPLIT L8 into Cardiac DIDACTIC (videos+disc) + Cardiac STATION (rotation only).
 *  - SPLIT Brady/Tachy: L5 Brady DIDACTIC + L6 Tachy DIDACTIC (separate lessons) +
 *    Pre-Arrest COMBINED STATION (the existing 4-rotation brady+tachy lab).
 *  - Stations = lab-rotation time ONLY (didactic is its own block).
 *  - Day 2: relabel megacode blocks (NO video; L9 = live demo Lesson 9B + disc +
 *    rotations) and add the noon lunch (Practice -> Break -> Lunch -> Testing -> Exam).
 *
 * Surgical-ish rebuild: deletes the two days' blocks and re-inserts the new set
 * (same approach as rebuild-acls-2025-agenda.js). Re-links lab blocks to their
 * existing sections and re-syncs the section FRAMES. Per-STATION instructor
 * assignments (station_instructors) are untouched; old block-level instructor
 * links (pmi_block_instructors) on the deleted blocks are removed (Ben/Rae/Ryan
 * do people assignment live via the webapp). --dry-run rolls back.
 *
 * REVERT: git state before this = commit 6c9a9c36; the prior block layout can be
 * rebuilt with rebuild-acls-2025-agenda.js + restore-acs-stroke-blocks.js.
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
const D1 = '2026-06-18', D2 = '2026-06-19';
// section lab_day ids
const SEC = {
  d1_cardiac: '657a0e7b-6921-4561-95a3-6a1b9a626192',  // D1 sec2
  d1_prearrest: '2fd5347f-4acc-46c8-9a3a-0c0e0c700ef1', // D1 sec3 (was Brady/Tachy)
  d1_bls: 'a40f9fd6-d338-4020-9979-c6b7612cfc40',        // D1 sec4
  d1_airway: '168b35a4-b738-4f8c-b373-9f1bd1c4d017',     // D1 sec5
  d2_practice: 'aebf842d-f2e4-41b5-8cf5-264cee7ef7ac',   // D2 sec2
  d2_testing: '85808c0a-3afe-4fde-a2a6-fc74824ac417',    // D2 sec3
};
const dow = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); };

const AGENDA = [
  // ── DAY 1 ──
  { date: D1, s: '08:30', e: '08:45', t: 'admin',   title: 'ACLS · Start / Welcome' },
  { date: D1, s: '08:45', e: '09:10', t: 'lecture', title: 'ACLS · L1 Overview + Science of Resuscitation' },
  { date: D1, s: '09:10', e: '09:25', t: 'lecture', title: 'ACLS · L-SA Systematic Approach' },
  { date: D1, s: '09:25', e: '09:45', t: 'exam',    title: 'ACLS · BLS Exam' },
  { date: D1, s: '09:45', e: '10:30', t: 'lab',     title: 'ACLS LAB · L2 High-Quality BLS — STATION (2 groups)', link: { id: SEC.d1_bls, n: 4 } },
  { date: D1, s: '10:30', e: '10:35', t: 'other',   title: 'ACLS · Ryan Intro (temp)' },
  { date: D1, s: '10:35', e: '10:45', t: 'other',   title: 'ACLS · Break' },
  { date: D1, s: '10:45', e: '11:30', t: 'lab',     title: 'ACLS LAB · L3 Airway Management — STATION (2 groups)', link: { id: SEC.d1_airway, n: 5 } },
  { date: D1, s: '11:30', e: '11:45', t: 'lecture', title: 'ACLS · ACS — Acute Coronary Syndromes (3-part video, compressed)' },
  { date: D1, s: '11:45', e: '11:55', t: 'lecture', title: 'ACLS · Acute Stroke (3-part video, compressed)' },
  { date: D1, s: '11:55', e: '12:00', t: 'lecture', title: 'ACLS · L7 High-Performance Teams (video)' },
  { date: D1, s: '12:00', e: '13:00', t: 'other',   title: 'ACLS · Lunch' },
  { date: D1, s: '13:00', e: '13:30', t: 'lecture', title: 'ACLS · L8 Cardiac Arrest & Post-Arrest — Didactic (videos + discussion)' },
  { date: D1, s: '13:30', e: '14:30', t: 'lab',     title: 'ACLS LAB · Cardiac Arrest — STATION (4×15)', link: { id: SEC.d1_cardiac, n: 2 } },
  { date: D1, s: '14:30', e: '15:00', t: 'lecture', title: 'ACLS · L5 Bradycardia — Didactic' },
  { date: D1, s: '15:00', e: '15:30', t: 'lecture', title: 'ACLS · L6 Tachycardia — Didactic' },
  { date: D1, s: '15:30', e: '16:10', t: 'lab',     title: 'ACLS LAB · Pre-Arrest — Combined STATION (Brady+Tachy, 4×10)', link: { id: SEC.d1_prearrest, n: 3 } },
  { date: D1, s: '16:10', e: '16:25', t: 'meeting', title: 'ACLS · End of Day 1' },
  // ── DAY 2 ──
  { date: D2, s: '08:30', e: '11:30', t: 'lab',     title: 'ACLS LAB · L9 Megacode Practice — live instructor demo (Lesson 9B ≤10 min) + discussion + rotations (NO video)', link: { id: SEC.d2_practice, n: 2 } },
  { date: D2, s: '11:30', e: '12:00', t: 'other',   title: 'ACLS · Break / Testing Setup' },
  { date: D2, s: '12:00', e: '13:00', t: 'other',   title: 'ACLS · Lunch' },
  { date: D2, s: '13:00', e: '14:15', t: 'lab',     title: 'ACLS LAB · Megacode Testing — Scored (NO video)', link: { id: SEC.d2_testing, n: 3 } },
  { date: D2, s: '14:15', e: '15:00', t: 'exam',    title: 'ACLS · Written Exam' },
  { date: D2, s: '15:00', e: '15:15', t: 'meeting', title: 'ACLS · End of Day 2' },
];

// section frame re-sync (lab_days start/end[/label])
const FRAMES = [
  { id: SEC.d1_bls,       s: '09:45', e: '10:30' },
  { id: SEC.d1_airway,    s: '10:45', e: '11:30' },
  { id: SEC.d1_cardiac,   s: '13:30', e: '14:30' },
  { id: SEC.d1_prearrest, s: '15:30', e: '16:10', label: 'Pre-Arrest (Combined)' },
  { id: SEC.d2_practice,  s: '08:30', e: '11:30' },
  { id: SEC.d2_testing,   s: '13:00', e: '14:15' },
];

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const old = (await c.query(
      "select psb.id from pmi_schedule_blocks psb join pmi_program_schedules pps on psb.program_schedule_id=pps.id where pps.cohort_id=$1 and psb.date in ($2,$3)", [COHORT, D1, D2]
    )).rows.map(r => r.id);
    if (old.length) {
      await c.query('delete from pmi_block_instructors where schedule_block_id = any($1)', [old]);
      await c.query('delete from pmi_schedule_blocks where id = any($1)', [old]);
    }
    console.log(`removed ${old.length} old blocks`);

    let sort = 0; let lastDate = null;
    for (const b of AGENDA) {
      if (b.date !== lastDate) { sort = 0; lastDate = b.date; }
      sort++;
      await c.query(
        `insert into pmi_schedule_blocks
           (semester_id, program_schedule_id, date, day_of_week, start_time, end_time, block_type, title, course_name, status, sort_order, is_recurring, linked_lab_day_id, linked_section_number)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'ACLS','published',$9,false,$10,$11)`,
        [SEM, PS, b.date, dow(b.date), b.s, b.e, b.t, b.title, sort, b.link?.id || null, b.link?.n || null]
      );
      console.log(`  ${b.date.slice(5)} ${b.s}-${b.e} [${b.t.padEnd(7)}] ${b.title}${b.link ? '  →sec' + b.link.n : ''}`);
    }
    console.log(`inserted ${AGENDA.length} blocks`);

    for (const f of FRAMES) {
      const r = f.label
        ? await c.query('update lab_days set start_time=$1,end_time=$2,section_label=$3 where id=$4', [f.s, f.e, f.label, f.id])
        : await c.query('update lab_days set start_time=$1,end_time=$2 where id=$3', [f.s, f.e, f.id]);
      console.log(`  frame ${r.rowCount}× ${f.id.slice(0, 8)} → ${f.s}-${f.e}${f.label ? ' "' + f.label + '"' : ''}`);
    }

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
