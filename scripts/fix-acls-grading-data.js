#!/usr/bin/env node
/**
 * ACLS grading data fixes (additive, idempotent).
 *   B) Add the `team_leader` segment to the practice scenarios (CASE_48-51) so
 *      practice grades testing-style (captures the TL evaluation). Banks stay
 *      separate — we only ADD the segment link, we do not touch testing scenarios.
 *   EMT-strip) Remove 'EMT' and 'AEMT' from every cert-tagged scenario's
 *      applicable_programs so advanced-cert content stops leaking into EMT/AEMT
 *      pickers (keeps Paramecic/other). ACLS-only.
 *
 * --dry-run rolls back.
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
const TEAM_LEADER_SEG = 'a5a980c2-1a37-487a-b28d-f0135b7e4fff'; // adv_cert_segments key=team_leader, acls
const PRACTICE = ['CASE_48', 'CASE_49', 'CASE_50', 'CASE_51'];

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');

    // ── B) team_leader segment on practice scenarios ──
    console.log('=== B) team_leader segment on practice scenarios ===');
    for (const code of PRACTICE) {
      const s = (await c.query("select id from scenarios where case_code=$1 and cert_course='acls'", [code])).rows[0];
      if (!s) { console.log(`  ${code}: scenario not found — skipped`); continue; }
      const exists = (await c.query(
        'select 1 from adv_cert_scenario_segments where scenario_id=$1 and segment_id=$2', [s.id, TEAM_LEADER_SEG]
      )).rows[0];
      if (exists) { console.log(`  ${code}: already has team_leader — skipped`); continue; }
      // sequence_order 0 so it renders first (existing practice segments are 1-5),
      // matching the testing layout where team_leader leads.
      await c.query(
        'insert into adv_cert_scenario_segments (scenario_id, segment_id, sequence_order) values ($1,$2,0)',
        [s.id, TEAM_LEADER_SEG]
      );
      console.log(`  ${code}: + team_leader (now 6-segment testing-style)`);
    }

    // ── EMT-strip) applicable_programs on cert-tagged scenarios ──
    console.log('\n=== EMT-strip) remove EMT/AEMT from cert scenarios applicable_programs ===');
    const certs = (await c.query(
      "select id, case_code, applicable_programs from scenarios where cert_course is not null"
    )).rows;
    let changed = 0;
    for (const r of certs) {
      const cur = Array.isArray(r.applicable_programs) ? r.applicable_programs : [];
      const next = cur.filter((p) => p !== 'EMT' && p !== 'AEMT');
      if (next.length === cur.length) continue;
      await c.query('update scenarios set applicable_programs=$1 where id=$2', [next, r.id]);
      changed++;
    }
    console.log(`  updated ${changed} of ${certs.length} cert scenarios (removed EMT/AEMT)`);
    const sample = (await c.query(
      "select case_code, applicable_programs from scenarios where cert_course is not null order by case_code limit 4"
    )).rows;
    for (const s of sample) console.log(`    ${s.case_code}: ${JSON.stringify(s.applicable_programs)}`);

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally { await c.end(); }
}
main();
