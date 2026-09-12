#!/usr/bin/env node
// [G15 LABS] Retrofit-link ACLS/PALS Day-1 cert labs — PM G15 Fall 2026 S2
//
// CONTEXT — follow-on to scripts/retrofit-g15-s2-mondays.js (PR #78), which
// explicitly left weeks 6 and 10 unbuilt because each date carried BOTH a
// generic "Day 1 S2 Lab" block AND a separate Ben-authorized ACLS/PALS
// anchor block ("ACLS/PALS (Day 1 of 2)"), unreconciled.
//
// RESOLVED (this script, 2026-09-01): live query of pmi_schedule_blocks
// shows the Tuesday side of each pair (10/6, 11/3) has ONLY the anchor
// block ("ACLS/PALS (Day 2 of 2)") — no generic duplicate — and those
// Tuesday blocks are ALREADY linked to hand-built G15 "ACLS/PALS
// Certification — Day 2" lab_days. That establishes the pattern: the
// anchor block is the correct one to link; the generic "Day 1 S2 Lab"
// block sitting alongside it on Monday is a stray duplicate from the
// recurring-pattern generator, left unlinked/untouched here (flagged to
// Ben for cleanup, not deleted).
//
// CONTENT SOURCE — same rule as PR #78: verified live G14 data, NOT the
// lab_day_templates catalog (a sibling task flagged Day-1 templates as
// possibly guessed/unverified provenance). G14's real "ACLS Certification
// — Day 1" (id 9df60c8b, semester=2 — the one documented exception to the
// day1=semester-NULL bug) and "PALS Certification — Day 1" (id 6aec40f8,
// semester=NULL per the bug, but real content) are the source, matching
// exactly how G15's own already-existing Day-2 cert lab_days are titled.
//
// EXPLICITLY OUT OF SCOPE / NOT TOUCHED BY THIS SCRIPT:
//   - G15 week 2 (2026-09-07 Labor Day / 2026-09-08 Neurocore all-day) —
//     Ben's "push W2's content forward" instruction needs a concrete
//     mechanics decision (merge into W3 vs. cascade-shift every later
//     week) that isn't safely inferrable — held for Ben/Claude AI.
//   - Sheep Pluck (2026-09-22) / Burn Center (2026-10-27) date/content
//     entanglement — still needs Ben's call per the sibling LAB PIPELINE
//     task; not a simple two-way swap.
//   - The stray generic "Day 1 S2 Lab" blocks left unlinked on 10/5 and
//     11/2 (ids 7916be61-2d19-4bee-b384-5bec7dbc0a99 and
//     e489bff3-b3a4-483e-b857-3bcc5d4827cf) — flagged for Ben to archive
//     if confirmed as dead recurring-pattern artifacts.
//
// Usage:
//   node scripts/retrofit-g15-s2-acls-pals-day1.js --dry-run
//   node scripts/retrofit-g15-s2-acls-pals-day1.js
//
// NOTE: executed live via Supabase MCP this session (no local DB
// credentials available in this sandbox); committed as the auditable,
// idempotent, re-runnable record per repo convention (see PR #78).

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
const G15_FALL_PROGRAM_SCHEDULE_ID = 'edaf73bf-abfc-4d4d-a657-f387f79abe7b';

// Anchor cert blocks run the AHA all-day clock (08:30-17:00), matching
// G15's already-built Day-2 counterparts — NOT the generic Monday
// 15:00-17:00 slot used by scripts/retrofit-g15-s2-mondays.js.
const CERT_START = '08:30:00';
const CERT_END = '17:00:00';

const WEEKS = [
  {
    week: 6,
    g15Date: '2026-10-05',
    g14SourceLabDayId: '9df60c8b-325c-4ecc-ad96-7588f392f182', // G14 "ACLS Certification — Day 1"
    g15BlockId: '2efd7769-f5ad-4c00-bc4b-c452808bb288', // "ACLS (Day 1 of 2)" anchor block
  },
  {
    week: 10,
    g15Date: '2026-11-02',
    g14SourceLabDayId: '6aec40f8-9237-446b-9cb8-15e7ce8c4fa4', // G14 "PALS Certification — Day 1"
    g15BlockId: '4d877edc-84f8-4738-bc3e-f85052a980d3', // "PALS (Day 1 of 2)" anchor block
  },
];

async function main() {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log(DRY_RUN ? '=== DRY RUN — no writes ===' : '=== LIVE RUN ===');

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
          [w.g15Date, G15_COHORT_ID, w.week, CERT_START, CERT_END, w.g14SourceLabDayId]
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
