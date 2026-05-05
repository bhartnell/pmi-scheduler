#!/usr/bin/env node
// Memorial Day — Mon 2026-05-25 — full day off for PM G15.
// Delete every schedule block + any lab_day on that date.
//
// Per the corrected spec: PM G14 May 28/29 is NOT touched.

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

const PM_G15_PROGRAM_SCHEDULE_ID = '5b2a1825-144a-44fc-9cf5-63f28e4ea992';
const PM_G15_COHORT_ID = '856bcf1d-2e85-48b5-92a3-aba941103109';
const MEMORIAL_DAY = '2026-05-25';

(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');

    // Before
    const before = await c.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM pmi_schedule_blocks
         WHERE program_schedule_id = $1 AND date = $3) AS block_count,
        (SELECT COUNT(*)::int FROM lab_days
         WHERE cohort_id = $2 AND date = $3) AS lab_day_count,
        (SELECT COUNT(*)::int FROM lab_stations ls
         JOIN lab_days ld ON ld.id = ls.lab_day_id
         WHERE ld.cohort_id = $2 AND ld.date = $3) AS station_count
      `,
      [PM_G15_PROGRAM_SCHEDULE_ID, PM_G15_COHORT_ID, MEMORIAL_DAY]
    );
    console.log(
      `Before: ${before.rows[0].block_count} schedule_blocks, ` +
      `${before.rows[0].lab_day_count} lab_days, ` +
      `${before.rows[0].station_count} lab_stations`
    );

    // Stations first (FK to lab_days), then lab_days, then schedule blocks.
    const delStations = await c.query(
      `
      DELETE FROM lab_stations
      WHERE lab_day_id IN (
        SELECT id FROM lab_days
        WHERE cohort_id = $1 AND date = $2
      )
      `,
      [PM_G15_COHORT_ID, MEMORIAL_DAY]
    );
    console.log(`Deleted ${delStations.rowCount} lab_stations`);

    const delLabDays = await c.query(
      `
      DELETE FROM lab_days
      WHERE cohort_id = $1 AND date = $2
      `,
      [PM_G15_COHORT_ID, MEMORIAL_DAY]
    );
    console.log(`Deleted ${delLabDays.rowCount} lab_days`);

    const delBlocks = await c.query(
      `
      DELETE FROM pmi_schedule_blocks
      WHERE program_schedule_id = $1 AND date = $2
      `,
      [PM_G15_PROGRAM_SCHEDULE_ID, MEMORIAL_DAY]
    );
    console.log(`Deleted ${delBlocks.rowCount} pmi_schedule_blocks`);

    await c.query('COMMIT');
    console.log('Committed ✓');

    // After
    const after = await c.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM pmi_schedule_blocks
         WHERE program_schedule_id = $1 AND date = $3) AS block_count,
        (SELECT COUNT(*)::int FROM lab_days
         WHERE cohort_id = $2 AND date = $3) AS lab_day_count,
        (SELECT COUNT(*)::int FROM lab_stations ls
         JOIN lab_days ld ON ld.id = ls.lab_day_id
         WHERE ld.cohort_id = $2 AND ld.date = $3) AS station_count
      `,
      [PM_G15_PROGRAM_SCHEDULE_ID, PM_G15_COHORT_ID, MEMORIAL_DAY]
    );
    console.log(
      `\nAfter:  ${after.rows[0].block_count} schedule_blocks, ` +
      `${after.rows[0].lab_day_count} lab_days, ` +
      `${after.rows[0].station_count} lab_stations  (expect 0/0/0)`
    );

    // Sanity check that May 28/29 PM G14 is UNTOUCHED.
    const g14 = await c.query(
      `
      SELECT date::text AS date, COUNT(*)::int AS n
      FROM pmi_schedule_blocks
      WHERE program_schedule_id = '26d1db7d-edeb-41ce-817b-f74f1b458951'
        AND date IN ('2026-05-28', '2026-05-29')
      GROUP BY date
      ORDER BY date
      `
    );
    console.log(`\nSanity — PM G14 May 28/29 (must remain):`);
    for (const r of g14.rows) {
      console.log(`  ${r.date}: ${r.n} blocks`);
    }
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('Failed:', err);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
