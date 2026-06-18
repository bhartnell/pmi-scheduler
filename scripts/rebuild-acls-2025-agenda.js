#!/usr/bin/env node
/**
 * Re-time G14 ACLS schedule blocks to the 2025 agenda (content unchanged;
 * timing/sequence only). Clean rebuild of the Day-1 + Day-2 pmi_schedule_blocks
 * to the 2025 structure, re-linking lab blocks to the existing sections.
 *
 * NOTE: this replaces the block set, so block-level instructor links
 * (pmi_block_instructors) on the OLD blocks are removed. Per-STATION instructor
 * assignments (station_instructors) are untouched. --dry-run rolls back.
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
const PS = '26d1db7d-edeb-41ce-817b-f74f1b458951';   // program_schedule_id
const SEM = '638470a7-5320-4c98-b690-1c77aae710f4';  // semester_id
const SEC = {
  cardiac: '657a0e7b-6921-4561-95a3-6a1b9a626192',   // D1 sec2
  bradytachy: '2fd5347f-4acc-46c8-9a3a-0c0e0c700ef1', // D1 sec3
  bls: 'a40f9fd6-d338-4020-9979-c6b7612cfc40',         // D1 sec4
  practice: 'aebf842d-f2e4-41b5-8cf5-264cee7ef7ac',    // D2 sec2
  testing: '85808c0a-3afe-4fde-a2a6-fc74824ac417',     // D2 sec3
};
const dow = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); };

// 2025 agenda. end = next block's start. link = {id, n} for lab blocks.
const D1 = '2026-06-18', D2 = '2026-06-19';
const AGENDA = [
  // Day 1
  { date: D1, s: '08:30', e: '08:45', t: 'admin',   title: 'ACLS · Start / Welcome' },
  { date: D1, s: '08:45', e: '09:10', t: 'lecture', title: 'ACLS · L1 Course Overview' },
  { date: D1, s: '09:10', e: '09:35', t: 'lab',     title: 'ACLS · Infant BLS' },
  { date: D1, s: '09:35', e: '09:55', t: 'lab',     title: 'ACLS · Infant CPR Skills Test' },
  { date: D1, s: '09:55', e: '10:05', t: 'lab',     title: 'ACLS · Relief of Choking' },
  { date: D1, s: '10:05', e: '10:30', t: 'exam',    title: 'ACLS · BLS Exam (if required)' },
  { date: D1, s: '10:30', e: '10:40', t: 'other',   title: 'ACLS · Break' },
  { date: D1, s: '10:40', e: '11:25', t: 'lab',     title: 'ACLS LAB · L2 High-Quality BLS (2 groups)', link: { id: SEC.bls, n: 4 } },
  { date: D1, s: '11:25', e: '12:10', t: 'lab',     title: 'ACLS LAB · L3 Airway Management (2 groups)' },
  { date: D1, s: '12:10', e: '12:25', t: 'lecture', title: 'ACLS · L4 Technology Review' },
  { date: D1, s: '12:25', e: '13:20', t: 'other',   title: 'ACLS · Lunch' },
  { date: D1, s: '13:20', e: '15:20', t: 'lab',     title: 'ACLS LAB · L5/6 Brady & Tachy (2 groups, swap 14:20)', link: { id: SEC.bradytachy, n: 3 } },
  { date: D1, s: '15:20', e: '15:35', t: 'other',   title: 'ACLS · Break' },
  { date: D1, s: '15:35', e: '16:05', t: 'lecture', title: 'ACLS · L7 High-Performance Teams' },
  { date: D1, s: '16:05', e: '18:45', t: 'lab',     title: 'ACLS LAB · L8 Cardiac Arrest & Post-Arrest (2 groups)', link: { id: SEC.cardiac, n: 2 } },
  { date: D1, s: '18:45', e: '19:00', t: 'meeting', title: 'ACLS · End of Day 1' },
  // Day 2
  { date: D2, s: '08:30', e: '11:25', t: 'lab',     title: 'ACLS LAB · L9 Megacode Practice (2 groups)', link: { id: SEC.practice, n: 2 } },
  { date: D2, s: '11:25', e: '11:40', t: 'other',   title: 'ACLS · Break' },
  { date: D2, s: '11:40', e: '12:55', t: 'lab',     title: 'ACLS LAB · Megacode Testing + Details (2 groups)', link: { id: SEC.testing, n: 3 } },
  { date: D2, s: '12:55', e: '13:40', t: 'exam',    title: 'ACLS · Written Exam' },
  { date: D2, s: '13:40', e: '14:00', t: 'meeting', title: 'ACLS · End of Day 2' },
];

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    // Remove old blocks (+ their block-instructor links) for these two days.
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
      console.log(`  ${b.date.slice(5)} ${b.s}-${b.e} [${b.t}] ${b.title}${b.link ? '  →sec' + b.link.n : ''}`);
    }
    console.log(`inserted ${AGENDA.length} blocks`);

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
