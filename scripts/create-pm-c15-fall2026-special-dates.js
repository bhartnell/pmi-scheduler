#!/usr/bin/env node
// Create PM C15 (Group 15, Semester 2, Fall 2026) special-date DRAFT
// schedule blocks — Ben-authorized 2026-08-25 (Notion Task Handoff Queue,
// "[SCHEDULE - Fall 2026] Generate PM C15 special-date DRAFT blocks").
//
// Inserts as status='draft' (never published here — Ben publishes via the
// planner UI at /scheduling/workspace). Idempotent: a NOT EXISTS guard on
// (program_schedule_id, semester_id, date, title) makes re-runs a no-op.
//
// NOTE: these dates already carry the normal recurring-template class
// blocks (EMS 172/152/192/182, "Day 1/2 S2 Lab", all status='draft',
// 08:30-17:00) seeded separately. This script does NOT touch or cancel
// those — whether to archive them so the special block is the only thing
// shown on the day is a Ben decision, flagged back on the Notion task.
//
// Usage:
//   node scripts/create-pm-c15-fall2026-special-dates.js
//   node scripts/create-pm-c15-fall2026-special-dates.js --dry-run

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
    console.error('ERROR: No database connection configured.');
    process.exit(1);
  }
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

const DRY_RUN = process.argv.includes('--dry-run');

const PM_C15_PROGRAM_SCHEDULE_ID = 'edaf73bf-abfc-4d4d-a657-f387f79abe7b'; // Mon/Tue, Fall 2026 semester_id
const FALL_2026_SEMESTER_ID = '2a4c3da6-3aae-4cce-b2f6-2a53256e64cd';

// block_type must be one of the live check-constraint values:
// class, lecture, lab, clinical, exam, study, admin, meeting, other.
// (The task note's "special/field_trip/cert" suggestion doesn't match
// the live schema — mapped to the closest real type below.)
const BLOCKS = [
  { date: '2026-09-08', title: 'Neuro Care',              block_type: 'lecture' },
  { date: '2026-09-22', title: 'Sheep Pluck Lab',         block_type: 'lab' },
  { date: '2026-10-05', title: 'ACLS (Day 1 of 2)',       block_type: 'lab' },
  { date: '2026-10-06', title: 'ACLS (Day 2 of 2)',       block_type: 'lab' },
  { date: '2026-10-27', title: 'Burn Center (Field Trip)',block_type: 'other' },
  { date: '2026-11-02', title: 'PALS (Day 1 of 2)',       block_type: 'lab' },
  { date: '2026-11-03', title: 'PALS (Day 2 of 2)',       block_type: 'lab' },
];

// All-day placeholder window — matches the existing "Instructor 1 class"
// all-day convention and spans the full 08:30-17:00 school day these
// dates already carry.
const START_TIME = '08:30:00';
const END_TIME = '17:00:00';

const CONTENT_NOTES =
  'DRAFT special-date placeholder (Ben-authorized 2026-08-25, Notion Task Handoff Queue). ' +
  'Intended to replace the day\'s normal class blocks — Ben to review/reconcile the existing ' +
  'recurring class blocks on this date before publishing.';

function dayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
}

async function main() {
  const connStr = getConnectionString();
  const masked = connStr.replace(/:([^@]+)@/, ':****@');
  console.log(`Connection: ${masked}`);
  console.log(`Dry run: ${DRY_RUN}`);

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected ✓\n');

  try {
    let inserted = 0;
    for (const b of BLOCKS) {
      const dow = dayOfWeek(b.date);
      if (DRY_RUN) {
        console.log(`[dry-run] would insert ${b.date} (dow ${dow}) — "${b.title}" [${b.block_type}]`);
        continue;
      }
      const sql = `
        INSERT INTO pmi_schedule_blocks (
          semester_id, program_schedule_id, day_of_week, date,
          start_time, end_time, block_type, title, content_notes,
          is_recurring, sort_order, status
        )
        SELECT $1, $2, $3, $4::date, $5, $6, $7, $8, $9, false, 0, 'draft'
        WHERE NOT EXISTS (
          SELECT 1 FROM pmi_schedule_blocks
          WHERE program_schedule_id = $2
            AND semester_id = $1
            AND date = $4::date
            AND title = $8
        )
        RETURNING id
      `;
      const params = [
        FALL_2026_SEMESTER_ID, PM_C15_PROGRAM_SCHEDULE_ID, dow, b.date,
        START_TIME, END_TIME, b.block_type, b.title, CONTENT_NOTES,
      ];
      const { rows } = await client.query(sql, params);
      if (rows.length > 0) {
        inserted++;
        console.log(`+ inserted ${b.date} (dow ${dow}) — "${b.title}" [${b.block_type}] id=${rows[0].id}`);
      } else {
        console.log(`· already present ${b.date} — "${b.title}"`);
      }
    }

    if (!DRY_RUN) {
      console.log('\n──── VERIFICATION ────');
      const { rows } = await client.query(
        `SELECT date, title, block_type, status FROM pmi_schedule_blocks
         WHERE program_schedule_id = $1 AND semester_id = $2 AND date = ANY($3::date[])
         ORDER BY date`,
        [PM_C15_PROGRAM_SCHEDULE_ID, FALL_2026_SEMESTER_ID, BLOCKS.map(b => b.date)]
      );
      for (const r of rows) {
        console.log(`  ${r.date.toISOString().slice(0, 10)}  ${r.status.padEnd(10)} ${r.block_type.padEnd(10)} ${r.title}`);
      }
    }

    console.log(`\n✓ Done — ${inserted} block${inserted === 1 ? '' : 's'} inserted.`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\n❌ Failed:', err);
  process.exit(1);
});
