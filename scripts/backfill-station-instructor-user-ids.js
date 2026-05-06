#!/usr/bin/env node
// One-shot data fix: 73 rows in station_instructors have NULL
// user_id but a populated user_email that resolves to a real
// lab_users row. The calendar-sync findBlocksForInstructor helper
// joins on instructor uuid only, so these rows were invisible to
// the per-user sync — Josh Lomonaco's 10+ EMS lab station
// assignments never landed in his Google Calendar despite him
// being the named instructor.
//
// Backfills si.user_id = lu.id by case-insensitive email match.
// Idempotent — only touches NULL rows.

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

const conn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp'}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`;

const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const before = await c.query(
      `SELECT COUNT(*)::int AS n
       FROM station_instructors
       WHERE user_id IS NULL
         AND EXISTS (SELECT 1 FROM lab_users lu WHERE LOWER(lu.email) = LOWER(station_instructors.user_email))`
    );
    console.log(`Backfillable rows: ${before.rows[0].n}`);

    // Surface a sample so the operator knows who's affected.
    const sample = await c.query(
      `SELECT si.id, si.user_email, si.user_name, lu.id AS lab_user_id, lu.name AS lab_user_name
       FROM station_instructors si
       JOIN lab_users lu ON LOWER(lu.email) = LOWER(si.user_email)
       WHERE si.user_id IS NULL
       ORDER BY si.user_email
       LIMIT 10`
    );
    console.log('Sample (first 10):');
    for (const r of sample.rows) console.log(' ', r);

    if (DRY_RUN) {
      console.log('\n[dry-run] no changes written');
      return;
    }

    await c.query('BEGIN');
    const updated = await c.query(
      `UPDATE station_instructors si
       SET user_id = lu.id
       FROM lab_users lu
       WHERE si.user_id IS NULL
         AND LOWER(lu.email) = LOWER(si.user_email)`
    );
    await c.query('COMMIT');
    console.log(`\nUpdated ${updated.rowCount} rows`);

    const after = await c.query(
      `SELECT COUNT(*)::int AS n
       FROM station_instructors
       WHERE user_id IS NULL
         AND EXISTS (SELECT 1 FROM lab_users lu WHERE LOWER(lu.email) = LOWER(station_instructors.user_email))`
    );
    console.log(`Remaining backfillable rows: ${after.rows[0].n} (expect 0)`);
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('Failed:', err);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
