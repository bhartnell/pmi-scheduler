#!/usr/bin/env node
// Read-only inspection ahead of two destructive actions:
//
//   1. Wipe PM G14 lab_stations for lab_days >= 2026-05-11 and
//      reset their titles to "Content Pending" so "Update from
//      Template" can re-apply S2 cleanly (week numbers are now
//      correct after earlier fixes).
//
//   2. Decide what to do with Memorial Day (May 25) PM G15 blocks
//      and the May 28/29 PM G14 blocks the user flagged as
//      no-lab days.
//
// This script only reports — never deletes. Run before
// fix-pm-g14-s2-stations.js so the operator knows exactly what
// they're approving.

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.substring(0, eq).trim();
    const v = t.substring(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const conn =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp'}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`;

const PM_G14_COHORT_ID = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';
const PM_G14_PROGRAM_SCHEDULE_ID = '26d1db7d-edeb-41ce-817b-f74f1b458951';
const PM_G15_PROGRAM_SCHEDULE_ID = '5b2a1825-144a-44fc-9cf5-63f28e4ea992';

(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    // ── 1. PM G14 lab_days >= 2026-05-11 ────────────────────────────
    console.log('\n──── PM G14 lab_days from 2026-05-11 onward ────');
    const { rows: labDays } = await c.query(
      `
      SELECT ld.id, ld.date::text AS date, ld.title, ld.week_number, ld.day_number,
             ld.source_template_id,
             (SELECT COUNT(*) FROM lab_stations ls WHERE ls.lab_day_id = ld.id)::int AS station_count
      FROM lab_days ld
      WHERE ld.cohort_id = $1
        AND ld.date >= '2026-05-11'
      ORDER BY ld.date
      `,
      [PM_G14_COHORT_ID]
    );
    console.log(`  Found ${labDays.length} lab_days. Total stations across them: ` +
                `${labDays.reduce((s, r) => s + r.station_count, 0)}`);
    for (const r of labDays) {
      console.log(
        `    ${r.date}  W${r.week_number ?? '?'}D${r.day_number ?? '?'}` +
        `  stations=${r.station_count}` +
        `  src_tpl=${r.source_template_id ? r.source_template_id.slice(0, 8) + '…' : 'null'}` +
        `  "${r.title}"`
      );
    }

    // ── 2. PM G15 May 25 (Memorial Day, Monday) ─────────────────────
    console.log('\n──── PM G15 schedule blocks on Mon 2026-05-25 (Memorial Day) ────');
    const { rows: g15Mon } = await c.query(
      `
      SELECT id, date::text AS date, title, start_time, end_time, status
      FROM pmi_schedule_blocks
      WHERE program_schedule_id = $1
        AND date = '2026-05-25'
      ORDER BY start_time
      `,
      [PM_G15_PROGRAM_SCHEDULE_ID]
    );
    if (g15Mon.length === 0) {
      console.log('  (none — Memorial Day already clear)');
    } else {
      for (const r of g15Mon) {
        console.log(
          `    id=${r.id}  ${r.start_time}–${r.end_time}  ${r.status}  "${r.title}"`
        );
      }
    }

    // ── 3. PM G14 May 28 (Thu) + May 29 (Fri) — operator says no lab ─
    console.log('\n──── PM G14 schedule blocks on Thu 2026-05-28 & Fri 2026-05-29 ────');
    const { rows: g14ThuFri } = await c.query(
      `
      SELECT id, date::text AS date, title, block_type, start_time, end_time, status
      FROM pmi_schedule_blocks
      WHERE program_schedule_id = $1
        AND date IN ('2026-05-28', '2026-05-29')
      ORDER BY date, start_time
      `,
      [PM_G14_PROGRAM_SCHEDULE_ID]
    );
    if (g14ThuFri.length === 0) {
      console.log('  (none)');
    } else {
      for (const r of g14ThuFri) {
        console.log(
          `    id=${r.id}  ${r.date}  ${r.start_time}–${r.end_time}  ${r.block_type}  ${r.status}  "${r.title}"`
        );
      }
    }

    // ── 4. PM G14 lab_days on those same dates ──────────────────────
    console.log('\n──── PM G14 lab_days on May 28 / May 29 ────');
    const { rows: g14LabDates } = await c.query(
      `
      SELECT ld.id, ld.date::text AS date, ld.title,
             (SELECT COUNT(*) FROM lab_stations ls WHERE ls.lab_day_id = ld.id)::int AS station_count
      FROM lab_days ld
      WHERE ld.cohort_id = $1
        AND ld.date IN ('2026-05-28', '2026-05-29')
      `,
      [PM_G14_COHORT_ID]
    );
    if (g14LabDates.length === 0) {
      console.log('  (no lab_days exist on those dates)');
    } else {
      for (const r of g14LabDates) {
        console.log(`    id=${r.id}  ${r.date}  stations=${r.station_count}  "${r.title}"`);
      }
    }

    // ── 5. PM G15 May 26 (Tue) — Memorial Day fallthrough check ─────
    // Tucson observes Memorial Day as a Monday-only holiday but
    // some programs shift Monday content to Tuesday. List Tue
    // blocks too so the operator can spot any double-bookings.
    console.log('\n──── PM G15 schedule blocks on Tue 2026-05-26 (the day after MD) ────');
    const { rows: g15Tue } = await c.query(
      `
      SELECT id, date::text AS date, title, start_time, end_time, status
      FROM pmi_schedule_blocks
      WHERE program_schedule_id = $1
        AND date = '2026-05-26'
      ORDER BY start_time
      `,
      [PM_G15_PROGRAM_SCHEDULE_ID]
    );
    if (g15Tue.length === 0) {
      console.log('  (none)');
    } else {
      for (const r of g15Tue) {
        console.log(`    id=${r.id}  ${r.start_time}–${r.end_time}  ${r.status}  "${r.title}"`);
      }
    }
  } finally {
    await c.end();
  }
})();
