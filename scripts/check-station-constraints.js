#!/usr/bin/env node
// One-shot diagnostic: list all CHECK constraints currently in
// production on lab_stations + lab_template_stations + lab_day_templates.
// The baseline.sql doesn't ship CHECKs but production may have ad-hoc
// ones added later. Need to know before "fixing" the wrong layer.

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

(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const tables = ['lab_stations', 'lab_template_stations', 'lab_day_templates'];
    for (const t of tables) {
      console.log(`\n──── ${t} ────`);
      const { rows: checks } = await c.query(
        `
        SELECT conname, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'c'
        `,
        [t]
      );
      if (checks.length === 0) {
        console.log('  (no CHECK constraints)');
      } else {
        for (const r of checks) {
          console.log(`  ${r.conname}: ${r.definition}`);
        }
      }
      // Distinct station_type values currently in the table
      if (t === 'lab_stations' || t === 'lab_template_stations') {
        const { rows: types } = await c.query(
          `SELECT DISTINCT station_type FROM "${t}" ORDER BY station_type`
        );
        console.log(`  Existing station_type values: ${types.map(r => r.station_type).join(', ')}`);
      }
      if (t === 'lab_day_templates') {
        const { rows: cats } = await c.query(
          `SELECT DISTINCT category FROM lab_day_templates ORDER BY category`
        );
        console.log(`  Existing category values: ${cats.map(r => r.category).join(', ')}`);
      }
    }
  } finally {
    await c.end();
  }
})();
