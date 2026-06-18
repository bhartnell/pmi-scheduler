#!/usr/bin/env node
/**
 * Build G14's BLS section (Day 1, 10:15-11:00 block) — additive, idempotent.
 * 2 SKILL verification stations, class split in half (2 groups, 2 stations):
 *   1. Adult CPR / AED (combined: CPR + bag-mask + AED)
 *   2. Peds/Infant Choking (combined infant + child)
 * cert_tier = skill (station_type 'skills'); minimal pass/fail via the generic
 * non-blocking grader (no skill_sheet → no detailed rubric). Instructors are
 * assigned per-station via the Edit Station modal (left blank here). Shows on
 * the ACLS Hub like the other sections; NOT a megacode (excluded from TL stats).
 * Combined-station verification follows AHA intent (Cowork-verified).
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
const DATE = '2026-06-18';

const STATIONS = [
  { n: 1, title: 'Adult CPR / AED (combined)', skill: 'Adult CPR + Bag-Mask + AED', notes: 'BLS verification — CPR reinforced across rotations; BLS card alongside ACLS' },
  { n: 2, title: 'Peds/Infant Choking (combined)', skill: 'Pediatric + Infant Choking', notes: 'Combined infant + child choking verification' },
];

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    const semester = (await c.query('SELECT current_semester FROM cohorts WHERE id=$1', [COHORT])).rows[0]?.current_semester ?? null;

    // Next free section_number for the date (idempotent: reuse an existing BLS section).
    const existing = (await c.query(
      "SELECT id, section_number FROM lab_days WHERE cohort_id=$1 AND date=$2 AND section_label='BLS'", [COHORT, DATE]
    )).rows[0];
    let labDayId, sectionNumber;
    if (existing) {
      labDayId = existing.id; sectionNumber = existing.section_number;
      console.log(`EXISTS  BLS section already present (sec${sectionNumber}, ${labDayId}) — ensuring stations`);
    } else {
      const maxSec = (await c.query(
        'SELECT COALESCE(MAX(section_number),0) m FROM lab_days WHERE cohort_id=$1 AND date=$2', [COHORT, DATE]
      )).rows[0].m;
      sectionNumber = maxSec + 1;
      const ins = await c.query(
        `INSERT INTO lab_days (cohort_id, date, section_number, section_label, title, semester, start_time, end_time,
             num_rotations, rotation_duration, lab_mode, cert_course, is_adv_cert_testing, notes)
         VALUES ($1,$2,$3,'BLS','ACLS Day 1 — BLS Skills',$4,'10:15','11:00',2,22,'group_rotations','acls',false,$5) RETURNING id`,
        [COHORT, DATE, sectionNumber, semester, 'BLS skill verification — 2 stations, class split in half']
      );
      labDayId = ins.rows[0].id;
      console.log(`CREATE  BLS section sec${sectionNumber} (${labDayId}) 10:15-11:00 · 2 stations · skills`);
    }

    for (const s of STATIONS) {
      const ex = (await c.query('SELECT id FROM lab_stations WHERE lab_day_id=$1 AND station_number=$2', [labDayId, s.n])).rows[0];
      if (ex) {
        await c.query("UPDATE lab_stations SET station_type='skills', custom_title=$1, skill_name=$2, station_notes=$3 WHERE id=$4",
          [s.title, s.skill, s.notes, ex.id]);
        console.log(`  STN #${s.n} updated: ${s.title}`);
      } else {
        await c.query(
          `INSERT INTO lab_stations (lab_day_id, station_number, station_type, custom_title, skill_name, station_notes, num_rotations, rotation_minutes)
           VALUES ($1,$2,'skills',$3,$4,$5,2,22)`,
          [labDayId, s.n, s.title, s.skill, s.notes]
        );
        console.log(`  STN #${s.n} created: ${s.title}`);
      }
    }

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
