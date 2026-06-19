#!/usr/bin/env node
/**
 * Post-import cleanup for the ACLS 2025 consolidated push (runs AFTER
 * renumber-megacode-practice-67-74.js + import-acls-seed.js acls_scenario_seed.json).
 *
 *  A) Dedup duplicate team_leader assembly rows: cases 67-70 (former 48-51) carried
 *     a legacy team_leader at sequence_order 0 from the earlier dedup; the seed
 *     re-inserts the canonical team_leader at order 1, so order-0 is now a duplicate.
 *     Canonical megacode assembly is orders 1-6 → delete any sequence_order=0 row on
 *     acls megacode scenarios. (Safe: megacode is Day-2/tomorrow, zero attempts yet —
 *     guarded below.)
 *  B) Re-point the Day-1 Cardiac Arrest station (sec2) to the 2025 OOH set:
 *     #1 CASE_45 (VF/pVT), #2 CASE_48 (VF/pVT), #3 CASE_47 (Asystole/PEA), #4 CASE_49.
 *  C) Deactivate the orphaned 2020 cardiac cases CASE_34/36/39/40 (reversible).
 *
 * --dry-run runs in a transaction and ROLLS BACK.
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
const CARDIAC_SEC = '657a0e7b-6921-4561-95a3-6a1b9a626192'; // D1 sec2 Cardiac Arrest
const CARDIAC_ORDER = ['CASE_45', 'CASE_48', 'CASE_47', 'CASE_49']; // station #1..#4
const ORPHANS = ['CASE_34', 'CASE_36', 'CASE_39', 'CASE_40'];

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');

    // safety guard: confirm no megacode attempts exist before touching assemblies
    let attempts = 0;
    try { attempts = (await c.query("select count(*)::int n from adv_cert_test_attempts")).rows[0].n; } catch (e) { attempts = -1; }
    console.log(`adv_cert_test_attempts: ${attempts === -1 ? '(table not found)' : attempts}`);
    if (attempts > 0) { console.log('⚠ attempts exist — ABORTING dedup to avoid orphaning results.'); await c.query('ROLLBACK'); return; }

    // A) dedup seq-0 team_leader on acls megacode scenarios
    const dd = await c.query(
      `delete from adv_cert_scenario_segments sss
       using scenarios s
       where sss.scenario_id = s.id and s.cert_course='acls'
         and s.cert_tier in ('megacode_practice','megacode_testing')
         and sss.sequence_order = 0`
    );
    console.log(`A) deduped ${dd.rowCount} stray sequence_order=0 assembly row(s)`);

    // B) re-point cardiac station
    const ids = {};
    for (const code of CARDIAC_ORDER) {
      const r = (await c.query("select id from scenarios where case_code=$1 and cert_course='acls'", [code])).rows[0];
      if (!r) throw new Error(`cardiac case ${code} not found (import incomplete?)`);
      ids[code] = r.id;
    }
    for (let i = 0; i < CARDIAC_ORDER.length; i++) {
      const code = CARDIAC_ORDER[i]; const n = i + 1;
      const r = await c.query(
        "update lab_stations set scenario_id=$1 where lab_day_id=$2 and station_number=$3",
        [ids[code], CARDIAC_SEC, n]
      );
      console.log(`B) station #${n} -> ${code} (${r.rowCount} row)`);
    }

    // C) deactivate orphaned 2020 cardiac cases
    const de = await c.query(
      "update scenarios set is_active=false where case_code = any($1) and cert_course='acls'", [ORPHANS]
    );
    console.log(`C) deactivated ${de.rowCount} orphaned 2020 case(s): ${ORPHANS.join(', ')}`);

    // verify cardiac station now resolves to 2025 set
    const v = (await c.query(
      "select st.station_number, s.case_code, s.title from lab_stations st join scenarios s on s.id=st.scenario_id where st.lab_day_id=$1 order by st.station_number", [CARDIAC_SEC]
    )).rows;
    console.log('  cardiac station now:', v.map(r => `#${r.station_number}:${r.case_code}`).join('  '));

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
