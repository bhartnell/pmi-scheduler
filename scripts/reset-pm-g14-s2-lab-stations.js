#!/usr/bin/env node
// Reset PM G14 lab_days dated >= 2026-05-11 to a clean slate so
// "Update from Template" can re-apply S2 templates correctly. The
// existing stations were applied while week numbers were still
// misaligned (old S1 → new S2), causing S1 content to land on S2
// lab_days.
//
// Operations (atomic, per spec):
//   1. DELETE FROM lab_stations WHERE lab_day_id IN
//        (SELECT id FROM lab_days WHERE cohort_id = G14 AND date >= 2026-05-11)
//   2. UPDATE lab_days SET title = 'Week N Day M — Content Pending',
//      source_template_id = NULL WHERE cohort_id = G14 AND date >= 2026-05-11
//
// Wraps both in a single transaction so a partial failure doesn't
// leave the cohort half-reset. Prints before/after row counts.

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
const CUTOFF_DATE = '2026-05-11';
const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');

    // Before counts
    const before = await c.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM lab_days
         WHERE cohort_id = $1 AND date >= $2) AS lab_days_count,
        (SELECT COUNT(*)::int FROM lab_stations ls
         JOIN lab_days ld ON ld.id = ls.lab_day_id
         WHERE ld.cohort_id = $1 AND ld.date >= $2) AS station_count
      `,
      [PM_G14_COHORT_ID, CUTOFF_DATE]
    );
    console.log(`Before: ${before.rows[0].lab_days_count} lab_days, ` +
                `${before.rows[0].station_count} stations`);

    // 1. DELETE stations
    const delResult = await c.query(
      `
      DELETE FROM lab_stations
      WHERE lab_day_id IN (
        SELECT id FROM lab_days
        WHERE cohort_id = $1
          AND date >= $2
      )
      `,
      [PM_G14_COHORT_ID, CUTOFF_DATE]
    );
    console.log(`Deleted ${delResult.rowCount} lab_stations rows`);

    // 2. Reset titles + clear source_template_id. Use the same
    //    composed title format the spec specified so the UI shows
    //    "Week 4 Day 2 — Content Pending" everywhere consistently.
    const updResult = await c.query(
      `
      UPDATE lab_days
      SET title = 'Week ' || COALESCE(week_number::text, '?') ||
                  ' Day ' || COALESCE(day_number::text, '?') ||
                  ' — Content Pending',
          source_template_id = NULL
      WHERE cohort_id = $1
        AND date >= $2
      `,
      [PM_G14_COHORT_ID, CUTOFF_DATE]
    );
    console.log(`Updated ${updResult.rowCount} lab_days titles + cleared source_template_id`);

    if (DRY_RUN) {
      console.log('\n[dry-run] rolling back');
      await c.query('ROLLBACK');
    } else {
      await c.query('COMMIT');
      console.log('Committed ✓');
    }

    // After counts (separate connection state since transaction may be done)
    const after = await c.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM lab_days
         WHERE cohort_id = $1 AND date >= $2) AS lab_days_count,
        (SELECT COUNT(*)::int FROM lab_stations ls
         JOIN lab_days ld ON ld.id = ls.lab_day_id
         WHERE ld.cohort_id = $1 AND ld.date >= $2) AS station_count,
        (SELECT COUNT(*)::int FROM lab_days
         WHERE cohort_id = $1 AND date >= $2 AND source_template_id IS NOT NULL) AS still_linked
      `,
      [PM_G14_COHORT_ID, CUTOFF_DATE]
    );
    console.log(`\nAfter: ${after.rows[0].lab_days_count} lab_days, ` +
                `${after.rows[0].station_count} stations, ` +
                `${after.rows[0].still_linked} lab_days still linked to a template (expect 0)`);
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('Failed:', err);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
