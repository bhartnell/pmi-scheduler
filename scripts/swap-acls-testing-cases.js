#!/usr/bin/env node
/**
 * Surgical: switch the Megacode Testing section to the OOH testing set
 * (1/2/3/4). The section's stations referenced MEGACODE_TEST_9/10 (dropped);
 * re-point those to MEGACODE_TEST_1/3 (keep 2/4). Deactivate the orphaned 9/10
 * scenarios so they leave the megacode pool. Idempotent, dry-run.
 *
 * Done surgically instead of re-running build-acls-days.js with the updated
 * schedule seed — that would clobber the re-linked/retimed schedule blocks.
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
const COHORT = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';
const SWAP = { MEGACODE_TEST_9: 'MEGACODE_TEST_1', MEGACODE_TEST_10: 'MEGACODE_TEST_3' };

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    // scenario id/title by case_code
    const sc = (await c.query("select id, case_code from scenarios where case_code = any($1)",
      [['MEGACODE_TEST_1', 'MEGACODE_TEST_2', 'MEGACODE_TEST_3', 'MEGACODE_TEST_4', 'MEGACODE_TEST_9', 'MEGACODE_TEST_10']])).rows
      .reduce((m, r) => (m[r.case_code] = r, m), {});

    // sec3 (Megacode Testing) stations
    const stations = (await c.query(
      `select ls.id, ls.station_number, ls.custom_title, ls.scenario_id
       from lab_stations ls join lab_days ld on ls.lab_day_id=ld.id
       where ld.cohort_id=$1 and ld.cert_course='acls' and ld.section_label='Megacode Testing'
       order by ls.station_number`, [COHORT])).rows;

    let swapped = 0;
    for (const st of stations) {
      const curCode = Object.keys(sc).find(code => sc[code].id === st.scenario_id);
      const target = curCode && SWAP[curCode];
      if (target && sc[target]) {
        await c.query('update lab_stations set scenario_id=$1, custom_title=$2 where id=$3',
          [sc[target].id, target, st.id]);
        console.log(`  SWAP station #${st.station_number}: ${curCode} → ${target}`);
        swapped++;
      } else {
        console.log(`  keep station #${st.station_number}: ${curCode || st.custom_title || '(?)'} `);
      }
    }

    // deactivate orphaned 9/10
    const deact = await c.query("update scenarios set is_active=false where case_code in ('MEGACODE_TEST_9','MEGACODE_TEST_10') and is_active=true returning case_code");
    for (const r of deact.rows) console.log(`  DEACTIVATE orphaned scenario ${r.case_code}`);

    // verify final set
    const final = (await c.query(
      `select ls.custom_title from lab_stations ls join lab_days ld on ls.lab_day_id=ld.id
       where ld.cohort_id=$1 and ld.cert_course='acls' and ld.section_label='Megacode Testing' order by ls.station_number`, [COHORT])).rows;
    console.log('  Testing section now: ' + final.map(f => f.custom_title).join(', '));
    console.log(`--- swapped: ${swapped}, deactivated: ${deact.rowCount} ---`);

    if (dryRun) { await c.query('ROLLBACK'); console.log('🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ FAILED (rolled back):', e.message); process.exitCode = 1;
  } finally { await c.end(); }
}
main();
