#!/usr/bin/env node
/**
 * PREREQUISITE for the 2025 cardiac-arrest seed import.
 *
 * Renames the existing megacode-practice scenario rows case_code 48-55 -> 67-74
 * (2025 codes), preserving each row's id so the Megacode Practice station links
 * (lab_stations.scenario_id) FOLLOW the rows to 67-70. Records the old code in
 * legacy_code_2020 (reversible). This FREES case_codes 48/49 so the cardiac-arrest
 * seed can INSERT CASE_45/47/48/49 as NEW rows (the importer upserts by case_code;
 * without this rename it would overwrite the megacode-practice 48/49 in place).
 *
 * Idempotent: if CASE_67 already exists, the rename is assumed done and skipped.
 * --dry-run runs inside a transaction and ROLLS BACK.
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
const RENAMES = [
  ['CASE_48', 'CASE_67'], ['CASE_49', 'CASE_68'], ['CASE_50', 'CASE_69'], ['CASE_51', 'CASE_70'],
  ['CASE_52', 'CASE_71'], ['CASE_53', 'CASE_72'], ['CASE_54', 'CASE_73'], ['CASE_55', 'CASE_74'],
];
async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    // additive, reversible column for the old code
    await c.query("ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS legacy_code_2020 text");
    // guard against double-run / partial-run collision
    const targetsExist = (await c.query(
      "select count(*)::int n from scenarios where cert_course='acls' and case_code = any($1)",
      [RENAMES.map(r => r[1])]
    )).rows[0].n;
    if (targetsExist > 0) {
      console.log(`⚠ ${targetsExist} target code(s) 67-74 already exist — renumber appears done; aborting (no-op).`);
      await c.query('ROLLBACK'); return;
    }
    for (const [oldc, newc] of RENAMES) {
      const r = await c.query(
        "update scenarios set case_code=$1, legacy_code_2020=$2 where case_code=$3 and cert_course='acls'",
        [newc, oldc, oldc]
      );
      console.log(`  ${oldc} -> ${newc}  (${r.rowCount} row, legacy_code_2020=${oldc})`);
    }
    // show megacode practice station links now resolve to 67-70 (links unchanged; codes followed)
    const sts = (await c.query(
      "select st.station_number, s.case_code, s.legacy_code_2020 from lab_stations st join scenarios s on s.id=st.scenario_id where st.lab_day_id='aebf842d-f2e4-41b5-8cf5-264cee7ef7ac' order by st.station_number"
    )).rows;
    console.log('  Megacode Practice station now ->', sts.map(r => `#${r.station_number}:${r.case_code}(was ${r.legacy_code_2020})`).join('  '));
    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
