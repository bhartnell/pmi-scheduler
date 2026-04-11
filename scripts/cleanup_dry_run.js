const fs = require('fs');
const path = require('path');
const envPath = path.resolve('.env.local');
const env = fs.readFileSync(envPath, 'utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const { Client } = require('pg');

const LAB_DAY_ID = '00b76580-cf4f-4265-845d-62d500e9deb7';
const EXPECTED_COHORT = 'bf6c5853';

const NREMT_SKILLS = [
  { num: 1, name: 'Cardiac Arrest Management / AED',           code: 'E215' },
  { num: 2, name: 'Patient Assessment / Management – Medical', code: 'E202' },
  { num: 3, name: 'Patient Assessment / Management – Trauma',  code: 'E201' },
  { num: 4, name: 'Supine Spinal Immobilization',              code: 'E212' },
  { num: 5, name: 'BVM of Apneic Adult Patient',               code: 'E203' },
  { num: 6, name: 'O2 Administration by Non-Rebreather Mask',  code: 'E204' },
  { num: 7, name: 'Bleeding Control / Shock Management',       code: 'E213' },
];

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();

  // 0. Verify the lab day exists and inspect current state
  const { rows: ldRows } = await c.query(
    'SELECT id, date, is_nremt_testing, cohort_id FROM lab_days WHERE id = $1',
    [LAB_DAY_ID]
  );
  if (ldRows.length === 0) {
    console.error('Lab day not found:', LAB_DAY_ID);
    process.exit(1);
  }
  const ld = ldRows[0];
  console.log('Lab day:', ld.id, 'date:', ld.date, 'nremt:', ld.is_nremt_testing, 'cohort:', ld.cohort_id);

  // Lookup skill sheet IDs by fuzzy name / nremt_code
  const { rows: sheetRows } = await c.query(
    "SELECT id, skill_name, nremt_code FROM skill_sheets WHERE is_nremt = true ORDER BY nremt_code"
  );
  console.log('\nAvailable NREMT skill sheets:');
  for (const s of sheetRows) console.log(' ', s.nremt_code, '-', s.skill_name, '-', s.id);

  // Resolve each target skill by nremt_code first, else fuzzy name match
  const resolved = NREMT_SKILLS.map(target => {
    const byCode = sheetRows.find(s => s.nremt_code === target.code);
    if (byCode) return { ...target, sheet_id: byCode.id, sheet_name: byCode.skill_name };
    const lower = target.name.toLowerCase();
    const byName = sheetRows.find(s => {
      const n = s.skill_name.toLowerCase();
      return n.includes(lower.split('/')[0].trim()) || lower.includes(n.split('/')[0].trim());
    });
    return { ...target, sheet_id: byName?.id || null, sheet_name: byName?.skill_name || null };
  });
  console.log('\nResolved targets:');
  for (const r of resolved) console.log(' ', r.num, r.code, r.name, '=>', r.sheet_id || 'NOT FOUND', r.sheet_name || '');

  const missing = resolved.filter(r => !r.sheet_id);
  if (missing.length) {
    console.error('\nMISSING SHEETS — aborting. Add/check:', missing.map(m => m.code).join(', '));
    await c.end();
    process.exit(1);
  }

  // Count before
  const before = {};
  before.stations = (await c.query('SELECT count(*) FROM lab_stations WHERE lab_day_id=$1', [LAB_DAY_ID])).rows[0].count;
  before.evals = (await c.query('SELECT count(*) FROM student_skill_evaluations WHERE lab_day_id=$1', [LAB_DAY_ID])).rows[0].count;
  before.alerts = (await c.query('SELECT count(*) FROM station_assistance_alerts WHERE lab_day_id=$1', [LAB_DAY_ID])).rows[0].count;
  console.log('\nBefore cleanup:', before);

  await c.query('BEGIN');
  try {
    // Bypass critical-delete + mass-delete guard triggers for this transaction
    await c.query("SET LOCAL app.allow_critical_delete = 'true'");
    await c.query("SET LOCAL app.allow_mass_delete = 'true'");

    // Delete alerts (may reference stations)
    const dAlerts = await c.query('DELETE FROM station_assistance_alerts WHERE lab_day_id=$1', [LAB_DAY_ID]);
    console.log('Deleted alerts:', dAlerts.rowCount);

    // Delete evaluations (may reference stations via FK)
    const dEvals = await c.query('DELETE FROM student_skill_evaluations WHERE lab_day_id=$1', [LAB_DAY_ID]);
    console.log('Deleted evaluations:', dEvals.rowCount);

    // Try to also clean student_queue rows if that table exists (use savepoint so error doesn't abort txn)
    await c.query('SAVEPOINT sp_queue');
    try {
      const dQueue = await c.query('DELETE FROM student_queue WHERE lab_day_id=$1', [LAB_DAY_ID]);
      console.log('Deleted queue entries:', dQueue.rowCount);
      await c.query('RELEASE SAVEPOINT sp_queue');
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT sp_queue');
      console.log('(no student_queue table or other error, skipping):', e.message);
    }

    // Delete stations last
    const dStations = await c.query('DELETE FROM lab_stations WHERE lab_day_id=$1', [LAB_DAY_ID]);
    console.log('Deleted stations:', dStations.rowCount);

    // Ensure is_nremt_testing = true
    await c.query('UPDATE lab_days SET is_nremt_testing = true WHERE id = $1', [LAB_DAY_ID]);

    // Inspect lab_stations columns to know what to insert
    const { rows: colRows } = await c.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='lab_stations' ORDER BY ordinal_position"
    );
    console.log('\nlab_stations columns:');
    for (const cr of colRows) console.log(' ', cr.column_name, cr.data_type, cr.is_nullable === 'NO' ? 'NOT NULL' : '', cr.column_default || '');

    // Insert 7 clean stations
    const insertedIds = [];
    for (const r of resolved) {
      const metadata = { skill_sheet_id: r.sheet_id };
      const { rows: ins } = await c.query(
        `INSERT INTO lab_stations (lab_day_id, station_number, skill_name, skill_sheet_id, station_type, metadata)
         VALUES ($1, $2, $3, $4, 'skills', $5)
         RETURNING id, station_number, skill_name, station_type`,
        [LAB_DAY_ID, r.num, r.sheet_name, r.sheet_id, metadata]
      );
      insertedIds.push(ins[0]);
      console.log('Inserted station', ins[0].station_number, '-', ins[0].skill_name, '-', ins[0].id);
    }

    await c.query('COMMIT');

    // Re-verify lab day state
    const { rows: ldAfter } = await c.query(
      'SELECT id, is_nremt_testing, cohort_id FROM lab_days WHERE id = $1',
      [LAB_DAY_ID]
    );
    console.log('\nAfter — is_nremt_testing:', ldAfter[0].is_nremt_testing, 'cohort_id:', ldAfter[0].cohort_id);
    console.log('Cohort matches expected prefix', EXPECTED_COHORT, '?', String(ldAfter[0].cohort_id).startsWith(EXPECTED_COHORT));

    console.log('\n=== SUMMARY ===');
    console.log('7 new station IDs:');
    for (const s of insertedIds) console.log(' ', s.station_number, s.skill_name, '=>', s.id);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK:', e.message, e.stack);
    process.exit(1);
  } finally {
    await c.end();
  }
})().catch(e => { console.error(e); process.exit(1); });
