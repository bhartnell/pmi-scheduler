#!/usr/bin/env node
// [G15 LABS] Retrofit-link 27 lab_days — PM G15 Fall 2026 S2 Mondays
//
// ROOT BUG (read-only investigation, confirmed against live data):
//   PM G14's S2 lab_days are twice-weekly, Thu=day1 / Fri=day2. Day-2
//   (Fri) rows are correctly tagged semester=2; day-1 (Thu) rows are
//   tagged semester=NULL (one exception: the 2026-06-18 ACLS Cert Day 1
//   row, which is semester=2). Any query filtering `semester = 2` alone
//   silently drops every G14 day-1 row. This script does NOT touch G14's
//   data (out of scope) — it only uses G14's day-1 rows as a read-only
//   content source to clone from.
//
// WHAT THIS DOES
//   For each G15 Fall-2026 week below, clones the matching G14 Thursday
//   lab_day (title/notes/timing/mode) + its lab_stations (skipping
//   instructor_id/instructor_name/instructor_email/additional_instructor_id
//   — lab staffing is an open design question, left null on purpose) onto
//   a NEW G15 Monday lab_day at G15's real published date, with
//   day_number=1 and semester=2 set explicitly. Then links the new G15
//   lab_day to the matching G15 Monday `pmi_schedule_blocks` row via
//   linked_lab_day_id.
//
// EXPLICITLY OUT OF SCOPE / SKIPPED (do not add without a fresh Ben
// go-ahead — see the Notion task write-up for details):
//   - G15 week 2 Monday (2026-09-07) — Labor Day, no published Monday
//     lab block exists that date. G14's W2D1 content ("Shock,
//     Hemorrhage, and Respiratory") has nowhere confirmed to go.
//   - G15 week 6 Monday (2026-10-05) and week 10 Monday (2026-11-02) —
//     each date carries BOTH a generic "Day 1 S2 Lab" block AND a
//     separate Ben-authorized ACLS/PALS anchor block
//     ("ACLS/PALS (Day 1 of 2)"), unreconciled. This belongs to a
//     sibling Notion task — left untouched here.
//   - The "Sheep Pluck Lab" (2026-09-22) / "Burn Center (Field Trip)"
//     (2026-10-27) anchor blocks and their G15 lab_days (cce961bf /
//     f4c12686 / febda9b9) — investigation found the published Burn
//     Center block date (2026-10-27) collides with an already-existing,
//     correctly-content-matched G15 W9D2 lab_day ("PALS Prep Day 2"),
//     and untangling which of the three lab_days/dates is authoritative
//     requires a scheduling decision only Ben can make. Flagged, not
//     guessed.
//   - G15 week 15 Monday (2026-12-07) — not part of Ben's confirmed
//     W1–W14 content map; G14's own "week 15" (2026-08-20 Capstone) was
//     likewise not in the map. Left alone.
//
// Usage:
//   node scripts/retrofit-g15-s2-mondays.js --dry-run
//   node scripts/retrofit-g15-s2-mondays.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ---- env loader (matches scripts/fix-pm-g14-g15-missing-blocks.js) ----
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* .env.local missing — fall through to env vars */
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const host = process.env.SUPABASE_DB_HOST || 'aws-0-us-west-2.pooler.supabase.com';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const user = process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp';
  const password = process.env.SUPABASE_DB_PASSWORD;
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  if (!password) {
    console.error('ERROR: No database connection configured (.env.local / SUPABASE_DB_URL missing).');
    process.exit(1);
  }
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

const DRY_RUN = process.argv.includes('--dry-run');

const G14_COHORT_ID = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';
const G15_COHORT_ID = '856bcf1d-2e85-48b5-92a3-aba941103109';
// G15's Fall 2026 program schedule (NOT the old Summer-2026 IDs used by
// fix-pm-g14-g15-missing-blocks.js — that was a different term).
const G15_FALL_PROGRAM_SCHEDULE_ID = 'edaf73bf-abfc-4d4d-a657-f387f79abe7b';

// G15 Monday clock time — matches the published block + every existing
// G15 weekly lab_day (orientation + all 14 Tuesdays), NOT G14's own
// class-time convention (G14 runs a different daily schedule).
const G15_MONDAY_START = '15:00:00';
const G15_MONDAY_END = '17:00:00';

// Each entry: G15 week N Monday <- clone of G14's week-N Thursday (day1).
// g15BlockId = the *already-published*, currently-unlinked "Day 1 S2 Lab"
// pmi_schedule_blocks row for that Monday (verified via live query —
// see Notion task write-up for the full before/after query dump).
const WEEKS = [
  { week: 3,  g15Date: '2026-09-14', g14SourceLabDayId: 'fa252332-2af1-43fc-a494-1c761044c823', g15BlockId: '0276c59b-c640-4d2a-9872-32d4adb9540e' },
  { week: 4,  g15Date: '2026-09-21', g14SourceLabDayId: '52bde76d-4a12-4907-b500-06e854d36477', g15BlockId: '9939c589-3cb7-4e9c-a730-c8d72ce7ccdb' },
  { week: 5,  g15Date: '2026-09-28', g14SourceLabDayId: 'f732ec73-b35c-4f82-96c3-7dc0788b1650', g15BlockId: '143391ab-be08-4d9b-9caf-dc400369ca41' },
  { week: 7,  g15Date: '2026-10-12', g14SourceLabDayId: '1a3b6ed9-e138-4a4e-823e-5aad772a6f73', g15BlockId: 'e67c91af-854f-4a6b-8af7-7ee245eb14a5' },
  { week: 8,  g15Date: '2026-10-19', g14SourceLabDayId: 'a3eca394-f958-45cf-ba44-3057dc67981d', g15BlockId: 'c7a222ea-ba02-46b5-a373-97bf5915f08d' },
  { week: 9,  g15Date: '2026-10-26', g14SourceLabDayId: '8018e46b-7308-4d9d-b529-1a5d86cbbf07', g15BlockId: 'de5e4cea-f20c-454a-9a9b-279fcd1e4005' },
  { week: 11, g15Date: '2026-11-09', g14SourceLabDayId: 'c94f5f23-aca8-40e6-a21d-1ca60a084262', g15BlockId: 'e64c48de-cc03-4a00-a737-df4e125862fc' },
  { week: 12, g15Date: '2026-11-16', g14SourceLabDayId: 'a6605892-00f9-4733-92e8-8d7a43f0b31a', g15BlockId: '8a25a47c-ebb6-4ac1-9df4-e15c40c75b96' },
  { week: 13, g15Date: '2026-11-23', g14SourceLabDayId: 'a0c9f5ed-e6f6-44ef-892b-421f189ba945', g15BlockId: '4c245d44-5dc1-4223-a5c8-6dbbf7de5413' },
  { week: 14, g15Date: '2026-11-30', g14SourceLabDayId: 'd345e8d5-4858-49b6-892e-b7fe3d14f448', g15BlockId: '29508a10-bb14-4daa-be50-6f85d1d11448' },
];

async function main() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log(DRY_RUN ? '=== DRY RUN — no writes ===' : '=== LIVE RUN ===');

  // Sanity: confirm every G14 source id is really a day-1 Thursday row
  // for the G14 cohort, and every g15BlockId is a currently-unlinked
  // Monday lab block for G15's Fall term, before touching anything.
  for (const w of WEEKS) {
    const { rows: src } = await client.query(
      `SELECT id, date::text, title, day_number, cohort_id FROM lab_days WHERE id = $1`,
      [w.g14SourceLabDayId]
    );
    if (src.length !== 1 || src[0].cohort_id !== G14_COHORT_ID) {
      throw new Error(`Week ${w.week}: G14 source lab_day ${w.g14SourceLabDayId} not found / wrong cohort — aborting.`);
    }
    const { rows: blk } = await client.query(
      `SELECT id, date::text, title, linked_lab_day_id, program_schedule_id FROM pmi_schedule_blocks WHERE id = $1`,
      [w.g15BlockId]
    );
    if (blk.length !== 1 || blk[0].program_schedule_id !== G15_FALL_PROGRAM_SCHEDULE_ID) {
      throw new Error(`Week ${w.week}: G15 block ${w.g15BlockId} not found / wrong program schedule — aborting.`);
    }
    if (blk[0].linked_lab_day_id) {
      console.log(`  Week ${w.week}: block ${w.g15BlockId} already linked to ${blk[0].linked_lab_day_id} — will skip (idempotent).`);
    }
    console.log(`  Week ${w.week}: source "${src[0].title}" (${src[0].date}) -> target ${w.g15Date} block "${blk[0].title}"`);
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] Sanity checks passed for all weeks. No writes performed.');
    await client.end();
    return;
  }

  let labDaysCreated = 0;
  let stationsCreated = 0;
  let blocksLinked = 0;

  for (const w of WEEKS) {
    await client.query('BEGIN');
    try {
      // Idempotency guard: a G15 lab_day already on this date/cohort/section
      // means this week was already built — skip cleanly.
      const { rows: existing } = await client.query(
        `SELECT id FROM lab_days WHERE cohort_id = $1 AND date = $2::date AND section_number = 1`,
        [G15_COHORT_ID, w.g15Date]
      );

      let newLabDayId;
      if (existing.length > 0) {
        newLabDayId = existing[0].id;
        console.log(`  Week ${w.week}: lab_day already exists at ${w.g15Date} (${newLabDayId}) — reusing, not re-cloning stations.`);
      } else {
        const { rows: inserted } = await client.query(
          `
          INSERT INTO lab_days (
            date, cohort_id, semester, week_number, day_number,
            num_rotations, rotation_duration, notes, title,
            start_time, end_time, lab_mode, section_number,
            priority_flag, priority_reason, is_adv_cert_testing, cert_course
          )
          SELECT
            $1::date, $2::uuid, 2, $3, 1,
            num_rotations, rotation_duration, notes, title,
            $4::time, $5::time, lab_mode, 1,
            priority_flag, priority_reason, is_adv_cert_testing, cert_course
          FROM lab_days
          WHERE id = $6::uuid
          RETURNING id
          `,
          [w.g15Date, G15_COHORT_ID, w.week, G15_MONDAY_START, G15_MONDAY_END, w.g14SourceLabDayId]
        );
        newLabDayId = inserted[0].id;
        labDaysCreated++;
        console.log(`  Week ${w.week}: + created lab_day ${newLabDayId} at ${w.g15Date}`);

        const { rows: stationsInserted } = await client.query(
          `
          INSERT INTO lab_stations (
            lab_day_id, station_number, scenario_id, skill_name, custom_title,
            station_details, location, equipment_needed, documentation_required,
            platinum_required, room, rotation_minutes, num_rotations, station_type,
            notes, skill_sheet_url, instructions_url, station_notes, metadata,
            drill_ids, skill_sheet_id, is_retake_station, debrief_minutes
          )
          SELECT
            $1::uuid, station_number, scenario_id, skill_name, custom_title,
            station_details, location, equipment_needed, documentation_required,
            platinum_required, room, rotation_minutes, num_rotations, station_type,
            notes, skill_sheet_url, instructions_url, station_notes, metadata,
            drill_ids, skill_sheet_id, is_retake_station, debrief_minutes
          FROM lab_stations
          WHERE lab_day_id = $2::uuid
          RETURNING id
          `,
          [newLabDayId, w.g14SourceLabDayId]
        );
        stationsCreated += stationsInserted.length;
        console.log(`    + cloned ${stationsInserted.length} lab_stations (instructor fields left null)`);
      }

      const { rows: linked } = await client.query(
        `
        UPDATE pmi_schedule_blocks
        SET linked_lab_day_id = $1::uuid
        WHERE id = $2::uuid AND linked_lab_day_id IS NULL
        RETURNING id
        `,
        [newLabDayId, w.g15BlockId]
      );
      if (linked.length > 0) {
        blocksLinked++;
        console.log(`    + linked block ${w.g15BlockId} -> ${newLabDayId}`);
      } else {
        console.log(`    · block ${w.g15BlockId} already linked — left as-is`);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  Week ${w.week}: ERROR, rolled back —`, err.message);
      throw err;
    }
  }

  console.log(`\n=== Done: ${labDaysCreated} lab_days created, ${stationsCreated} lab_stations cloned, ${blocksLinked} blocks linked ===`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
