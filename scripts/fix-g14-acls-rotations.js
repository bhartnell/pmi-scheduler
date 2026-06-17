#!/usr/bin/env node
/**
 * ACLS section corrections (2025 program-tuned params), additive/idempotent.
 *
 *   1. Cardiac Arrest (D1 sec2): rotation_duration=15 (10 station + 5 debrief),
 *      num_rotations=4, 4 stations. (Fills the previously-blank gap.)
 *   2. Megacode Practice (D2 sec2): 15 min/rot × 4 rotations × 4 STATIONS
 *      (was 2 rot × 8 stations). Removes stations beyond #4 — but ONLY after a
 *      hard dependency check (refuses to delete a station with any grading/
 *      assignment rows). Keeps the 4 lowest station_numbers (CASE_48–51).
 *
 * HELD (untouched): Megacode Testing (D2 sec3) — testing exception, awaiting the
 * user's instructor-book confirmation. Brady/Tachy (D1 sec3) — left at its
 * current params; flagged separately (differs from the 15-min standard).
 *
 * Never compresses station length to fit a block. Prints BEFORE state +
 * recomputed rotation-vs-block math with FLAGS. --dry-run rolls back.
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

function mins(t) { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; }

async function depsForStations(c, ids) {
  if (!ids.length) return [];
  // Every table with a FK to lab_stations.
  const fks = (await c.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name='lab_stations' AND ccu.column_name='id'
  `)).rows;
  const hits = [];
  for (const { table_name, column_name } of fks) {
    const n = (await c.query(`SELECT count(*)::int n FROM "${table_name}" WHERE "${column_name}" = ANY($1::uuid[])`, [ids])).rows[0].n;
    if (n > 0) hits.push(`${table_name}.${column_name}=${n}`);
  }
  return hits;
}

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const flags = [];
  try {
    await c.query('BEGIN');

    // Resolve the two target sections.
    const days = (await c.query(
      `SELECT id, date::text, section_number, section_label, start_time::text, end_time::text, num_rotations, rotation_duration
       FROM lab_days WHERE cohort_id=$1 AND cert_course='acls' AND section_label IN ('Learning — Cardiac Arrest','Megacode Practice')
       ORDER BY date, section_number`, [COHORT]
    )).rows;
    const cardiac = days.find(d => d.section_label === 'Learning — Cardiac Arrest');
    const practice = days.find(d => d.section_label === 'Megacode Practice');
    if (!cardiac || !practice) throw new Error('target sections not found');

    console.log('=== BEFORE ===');
    for (const d of days) {
      const st = (await c.query('SELECT station_number, custom_title, rotation_minutes, num_rotations FROM lab_stations WHERE lab_day_id=$1 ORDER BY station_number', [d.id])).rows;
      console.log(`  ${d.section_label} ${d.start_time?.slice(0,5)}-${d.end_time?.slice(0,5)} | ${d.num_rotations}x${d.rotation_duration ?? 'GAP'} | ${st.length} stations: ${st.map(s=>s.custom_title).join(', ')}`);
    }

    // --- 1. Cardiac Arrest: 15 min/rot, 4 rotations, 4 stations ---
    await c.query('UPDATE lab_days SET rotation_duration=15, num_rotations=4 WHERE id=$1', [cardiac.id]);
    await c.query('UPDATE lab_stations SET rotation_minutes=15, num_rotations=4 WHERE lab_day_id=$1', [cardiac.id]);

    // --- 2. Megacode Practice: 15 min/rot, 4 rotations, trim to 4 stations ---
    const pStations = (await c.query('SELECT id, station_number FROM lab_stations WHERE lab_day_id=$1 ORDER BY station_number', [practice.id])).rows;
    const keep = pStations.slice(0, 4).map(s => s.id);
    const remove = pStations.slice(4).map(s => s.id);
    if (remove.length) {
      const deps = await depsForStations(c, remove);
      if (deps.length) throw new Error(`REFUSING to delete ${remove.length} practice stations — dependents exist: ${deps.join(', ')}`);
      await c.query('DELETE FROM lab_stations WHERE id = ANY($1::uuid[])', [remove]);
    }
    await c.query('UPDATE lab_days SET rotation_duration=15, num_rotations=4 WHERE id=$1', [practice.id]);
    await c.query('UPDATE lab_stations SET rotation_minutes=15, num_rotations=4 WHERE id = ANY($1::uuid[])', [keep]);

    // --- compute-and-flag: rotation math vs block ---
    const check = (label, dur, rot, blkMin, blockStr) => {
      const need = dur * rot;
      const fit = need <= blkMin;
      const surplus = blkMin - need;
      const line = `${label}: ${rot}x${dur} = ${need} min vs block ${blockStr} (${blkMin} min) → ${fit ? 'FITS' : '⚠ DOES NOT FIT'}${fit && surplus>0 ? ` (+${surplus} min buffer)` : ''}`;
      flags.push(line);
    };
    check('Cardiac Arrest', 15, 4, mins(cardiac.end_time) - mins(cardiac.start_time), `${cardiac.start_time?.slice(0,5)}-${cardiac.end_time?.slice(0,5)}`);
    check('Megacode Practice', 15, 4, mins(practice.end_time) - mins(practice.start_time), `${practice.start_time?.slice(0,5)}-${practice.end_time?.slice(0,5)}`);

    // Brady/Tachy + Testing flags (not modified here).
    const bt = (await c.query(`SELECT start_time::text,end_time::text,num_rotations,rotation_duration FROM lab_days WHERE cohort_id=$1 AND cert_course='acls' AND section_label='Learning — Brady/Tachy'`, [COHORT])).rows[0];
    if (bt) flags.push(`Brady/Tachy: ${bt.num_rotations}x${bt.rotation_duration} (NOT changed) — 4/4 ✓ but rotation_duration=${bt.rotation_duration} differs from the 15-min standard; at 15 it'd be ${15*bt.num_rotations} min > ${mins(bt.end_time)-mins(bt.start_time)}-min block (won't fit). CONFIRM: leave at ${bt.rotation_duration}, or extend the block?`);
    flags.push('Megacode Testing: HELD per your instruction (testing exception — confirm 3 scenarios / pass 2-of-3 against the instructor book).');

    console.log('\n=== AFTER (rotation math + flags) ===');
    for (const f of flags) console.log('  ' + f);

    if (dryRun) { await c.query('ROLLBACK'); console.log('\n🔍 DRY RUN — rolled back.'); }
    else { await c.query('COMMIT'); console.log('\n✅ Committed.'); }
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally { await c.end(); }
}
main();
