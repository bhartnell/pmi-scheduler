#!/usr/bin/env node
// Backfill missing pmi_schedule_blocks rows for PM G14 + PM G15
// Summer 2026.
//
//   FIX 1: PM G14 EMS 172 — pad Thursdays + Fridays to 14 each
//   FIX 2: PM G15 EMS 141 — pad Mondays + Tuesdays to 14 each
//   FIX 3: PM G15 MTH 142 — pad Mondays + Tuesdays to 14 each
//
// Approach (one pattern, reused per fix):
//   - SELECT one existing block matching the title for the program
//     so we can clone its time / recurring_group_id / instructor /
//     other metadata.
//   - For each target date, INSERT only when no row already exists
//     for (program_schedule_id, semester_id, title, date) — this is
//     the NOT EXISTS guard the user asked for.
//   - Print before + after counts grouped by weekday.
//
// Usage:
//   node scripts/fix-pm-g14-g15-missing-blocks.js
//   node scripts/fix-pm-g14-g15-missing-blocks.js --dry-run

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ---- env loader ----
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

// IDs supplied in the bug report.
const PM_G14_PROGRAM_SCHEDULE_ID = '26d1db7d-edeb-41ce-817b-f74f1b458951';
const PM_G15_PROGRAM_SCHEDULE_ID = '5b2a1825-144a-44fc-9cf5-63f28e4ea992';
const SUMMER_2026_SEMESTER_ID = '638470a7-5320-4c98-b690-1c77aae710f4';

// PM G14 runs Thu+Fri; PM G15 runs Mon+Tue. Week 1 starts May 11.
const PM_G14_THURSDAYS = [
  '2026-05-14','2026-05-21','2026-05-28','2026-06-04','2026-06-11','2026-06-18','2026-06-25',
  '2026-07-02','2026-07-09','2026-07-16','2026-07-23','2026-07-30','2026-08-06','2026-08-13',
];
const PM_G14_FRIDAYS = [
  '2026-05-15','2026-05-22','2026-05-29','2026-06-05','2026-06-12','2026-06-19','2026-06-26',
  '2026-07-03','2026-07-10','2026-07-17','2026-07-24','2026-07-31','2026-08-07','2026-08-14',
];
const PM_G15_MONDAYS = [
  '2026-05-11','2026-05-18','2026-05-25','2026-06-01','2026-06-08','2026-06-15','2026-06-22',
  '2026-06-29','2026-07-06','2026-07-13','2026-07-20','2026-07-27','2026-08-03','2026-08-10',
];
const PM_G15_TUESDAYS = [
  '2026-05-12','2026-05-19','2026-05-26','2026-06-02','2026-06-09','2026-06-16','2026-06-23',
  '2026-06-30','2026-07-07','2026-07-14','2026-07-21','2026-07-28','2026-08-04','2026-08-11',
];

const FIXES = [
  {
    label: 'FIX 1: PM G14 EMS 172 Medical Emergencies',
    programScheduleId: PM_G14_PROGRAM_SCHEDULE_ID,
    titlePattern: '%172%',           // ILIKE — matches "EMS 172 Medical Emergencies", "172 …", etc.
    expectedTitleSubstring: 'EMS 172',
    targetDays: [
      { dow: 4, name: 'Thursday', dates: PM_G14_THURSDAYS },
      { dow: 5, name: 'Friday',   dates: PM_G14_FRIDAYS },
    ],
  },
  {
    label: 'FIX 2: PM G15 EMS 141 Patient Assessment & Diagnostics',
    programScheduleId: PM_G15_PROGRAM_SCHEDULE_ID,
    titlePattern: '%141%',
    expectedTitleSubstring: 'EMS 141',
    targetDays: [
      { dow: 1, name: 'Monday',  dates: PM_G15_MONDAYS },
      { dow: 2, name: 'Tuesday', dates: PM_G15_TUESDAYS },
    ],
  },
  {
    label: 'FIX 3: PM G15 MTH 142 College Algebra',
    programScheduleId: PM_G15_PROGRAM_SCHEDULE_ID,
    titlePattern: '%MTH%',
    expectedTitleSubstring: 'MTH 142',
    targetDays: [
      { dow: 1, name: 'Monday',  dates: PM_G15_MONDAYS },
      { dow: 2, name: 'Tuesday', dates: PM_G15_TUESDAYS },
    ],
  },
];

async function countByWeekday(client, programScheduleId, titlePattern) {
  const { rows } = await client.query(
    `
    SELECT TRIM(TO_CHAR(date, 'Day')) AS weekday, COUNT(*)::int AS n
    FROM pmi_schedule_blocks
    WHERE program_schedule_id = $1
      AND semester_id = $2
      AND title ILIKE $3
    GROUP BY 1
    ORDER BY MIN(date)
    `,
    [programScheduleId, SUMMER_2026_SEMESTER_ID, titlePattern]
  );
  return rows;
}

async function fetchTemplateRow(client, programScheduleId, titlePattern) {
  // Pull one existing block to clone time + recurring_group_id +
  // metadata. ORDER BY date so the earliest-week row wins (more
  // likely to have correct content_notes / sort_order).
  const { rows } = await client.query(
    `
    SELECT
      title, course_name, content_notes, color, sort_order,
      block_type, start_time, end_time, recurring_group_id,
      is_recurring, instructor_id, additional_instructor_id,
      room_id, status
    FROM pmi_schedule_blocks
    WHERE program_schedule_id = $1
      AND semester_id = $2
      AND title ILIKE $3
    ORDER BY date ASC, sort_order ASC NULLS LAST
    LIMIT 1
    `,
    [programScheduleId, SUMMER_2026_SEMESTER_ID, titlePattern]
  );
  return rows[0] || null;
}

function weekNumberForDate(dateStr, weekOneStart) {
  // Inclusive 1-indexed week — assumes weekly cadence and the same
  // weekday slot. weekOneStart should be the program's earliest
  // class day in week 1.
  const ms = new Date(dateStr + 'T00:00:00Z').getTime() -
             new Date(weekOneStart + 'T00:00:00Z').getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 7)) + 1;
}

async function applyFix(client, fix) {
  console.log(`\n──── ${fix.label} ────`);

  // BEFORE counts
  const before = await countByWeekday(client, fix.programScheduleId, fix.titlePattern);
  console.log('  Before:');
  for (const r of before) console.log(`    ${r.weekday.padEnd(10)} ${r.n}`);
  if (before.length === 0) {
    console.log('    (no existing blocks match — skipping fix; need at least one row to clone metadata)');
    return { inserted: 0, skipped: true };
  }

  const tpl = await fetchTemplateRow(client, fix.programScheduleId, fix.titlePattern);
  if (!tpl) {
    console.log('  ⚠ Could not pull a template row — skipping.');
    return { inserted: 0, skipped: true };
  }
  if (!tpl.title.toUpperCase().includes(fix.expectedTitleSubstring.toUpperCase())) {
    console.log(`  ⚠ Sample title "${tpl.title}" does not contain ${fix.expectedTitleSubstring}; ` +
                `the ILIKE pattern probably matched another course. Aborting this fix.`);
    return { inserted: 0, skipped: true };
  }
  console.log(`  Template row: "${tpl.title}" ${tpl.start_time}–${tpl.end_time} ` +
              `(recurring_group_id=${tpl.recurring_group_id ?? 'null'}, status=${tpl.status})`);

  // Insert per target weekday with NOT EXISTS guard.
  let inserted = 0;
  for (const day of fix.targetDays) {
    // Earliest target date for this weekday → defines week 1 for week_number assignment.
    const weekOneStart = day.dates[0];
    for (const dateStr of day.dates) {
      const week = weekNumberForDate(dateStr, weekOneStart);
      // Use NOT EXISTS guard so re-runs are idempotent.
      const sql = `
        INSERT INTO pmi_schedule_blocks (
          semester_id, program_schedule_id, day_of_week, date, week_number,
          recurring_group_id, start_time, end_time, block_type, title,
          course_name, content_notes, color, is_recurring, sort_order,
          instructor_id, additional_instructor_id, room_id, status
        )
        SELECT
          $1, $2, $3, $4::date, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19
        WHERE NOT EXISTS (
          SELECT 1 FROM pmi_schedule_blocks
          WHERE program_schedule_id = $2
            AND semester_id = $1
            AND date = $4::date
            AND title = $10
        )
        RETURNING id
      `;
      const params = [
        SUMMER_2026_SEMESTER_ID, fix.programScheduleId, day.dow, dateStr, week,
        tpl.recurring_group_id, tpl.start_time, tpl.end_time, tpl.block_type, tpl.title,
        tpl.course_name, tpl.content_notes, tpl.color, tpl.is_recurring ?? true, tpl.sort_order ?? 0,
        tpl.instructor_id, tpl.additional_instructor_id, tpl.room_id, tpl.status ?? 'published',
      ];
      if (DRY_RUN) {
        console.log(`    [dry-run] would attempt insert ${dateStr} (${day.name}, wk ${week})`);
        continue;
      }
      const { rows } = await client.query(sql, params);
      if (rows.length > 0) {
        inserted++;
        console.log(`    + inserted ${dateStr} (${day.name}, wk ${week})`);
      } else {
        console.log(`    · already present ${dateStr} (${day.name}, wk ${week})`);
      }
    }
  }

  // AFTER counts
  if (!DRY_RUN) {
    const after = await countByWeekday(client, fix.programScheduleId, fix.titlePattern);
    console.log('  After:');
    for (const r of after) console.log(`    ${r.weekday.padEnd(10)} ${r.n}`);
  }
  console.log(`  ✓ ${fix.label}: inserted ${inserted}`);
  return { inserted, skipped: false };
}

async function summary(client) {
  console.log('\n──── FINAL VERIFICATION ────');
  const sql = `
    SELECT psb.title, TRIM(TO_CHAR(date, 'Day')) AS weekday, COUNT(*)::int AS n
    FROM pmi_schedule_blocks psb
    JOIN pmi_program_schedules pps ON pps.id = psb.program_schedule_id
    JOIN cohorts c ON c.id = pps.cohort_id
    WHERE c.cohort_number IN (14, 15)
      AND psb.title ILIKE ANY(ARRAY['%172%','%141%','%MTH%'])
      AND psb.status = 'published'
    GROUP BY psb.title, TRIM(TO_CHAR(date, 'Day'))
    ORDER BY psb.title, MIN(date)
  `;
  const { rows } = await client.query(sql);
  for (const r of rows) {
    console.log(`  ${r.title.padEnd(60)} ${r.weekday.padEnd(10)} ${r.n}`);
  }
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
  console.log('Connected ✓');

  try {
    let totalInserted = 0;
    for (const fix of FIXES) {
      const r = await applyFix(client, fix);
      totalInserted += r.inserted;
    }
    await summary(client);
    console.log(`\n✓ Done — ${totalInserted} block${totalInserted === 1 ? '' : 's'} inserted total.`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\n❌ Fix failed:', err);
  process.exit(1);
});
