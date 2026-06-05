/*
 * Read-only inspection of the LVFR AEMT current state.
 * Surfaces:
 *   - LVFR AEMT cohort id
 *   - existing lvfr_day_schedule rows
 *   - per-day schedule-item counts
 *   - whether July 6 (or any other date) is currently stored as a start anchor
 *   - lvfr_schedule_items + lvfr_day_schedule schemas (so the populator
 *     gets columns right when we run it)
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const m = env.match(/SUPABASE_DB_URL=(.+)/);
const url = m[1].replace(/^["']|["']$/g, '').trim();

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();

  // 1. LVFR / AEMT cohorts (the task description hinted that cohort name
  //    pattern may be different than just "AEMT G2" — search broadly).
  const cohorts = (await c.query(
    `SELECT c.id, c.cohort_number, c.start_date, c.end_date, c.is_active, c.is_archived,
            p.abbreviation, p.name AS program_name
     FROM cohorts c
     JOIN programs p ON p.id = c.program_id
     WHERE p.abbreviation = 'AEMT'
        OR p.name ILIKE '%LVFR%'
        OR p.name ILIKE '%AEMT%'
     ORDER BY c.created_at DESC`
  )).rows;
  console.log('AEMT / LVFR cohorts:');
  cohorts.forEach(r => console.log(`  ${r.id}  ${r.abbreviation}/${r.program_name} G${r.cohort_number}  start=${r.start_date && r.start_date.toISOString().slice(0,10)}  end=${r.end_date && r.end_date.toISOString().slice(0,10)}  active=${r.is_active}  archived=${r.is_archived}`));

  // 2. lvfr_day_schedule + lvfr_schedule_items schemas
  const dsCols = (await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'lvfr_day_schedule' ORDER BY ordinal_position`
  )).rows;
  console.log('\nlvfr_day_schedule columns:');
  dsCols.forEach(c => console.log(`  ${c.column_name.padEnd(25)}  ${c.data_type}`));

  const siCols = (await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'lvfr_schedule_items' ORDER BY ordinal_position`
  )).rows;
  console.log('\nlvfr_schedule_items columns:');
  siCols.forEach(c => console.log(`  ${c.column_name.padEnd(25)}  ${c.data_type}`));

  // CHECK constraints — find item_type allowed values etc.
  const cks = (await c.query(`
    SELECT rel.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname IN ('lvfr_day_schedule', 'lvfr_schedule_items')
      AND con.contype = 'c'
    ORDER BY rel.relname, con.conname
  `)).rows;
  console.log('\nCHECK constraints:');
  cks.forEach(r => console.log(`  ${r.table_name} :: ${r.conname}\n     ${r.def}`));

  // 3. Existing day-schedule rows + item counts per day
  const rows = (await c.query(`
    SELECT lds.date,
           EXTRACT(DOW FROM lds.date)::int AS dow,
           lds.id AS day_schedule_id,
           COALESCE(lds.session, '(null)') AS session,
           lds.cohort_id,
           COUNT(lsi.id)::int AS item_count
    FROM lvfr_day_schedule lds
    LEFT JOIN lvfr_schedule_items lsi ON lsi.day_schedule_id = lds.id
    GROUP BY lds.id, lds.date, lds.session, lds.cohort_id
    ORDER BY lds.date, lds.session
  `)).rows;
  console.log(`\nlvfr_day_schedule rows (${rows.length}):`);
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  rows.forEach(r => console.log(`  ${r.date.toISOString().slice(0,10)} ${DOW[r.dow]}  session=${r.session}  items=${r.item_count}  cohort=${(r.cohort_id || '').slice(0,8)}`));

  // 4. Look for any anchor that says July 6 (could indicate the wrong-start-date issue)
  const anchorTables = ['lvfr_platoon_schedule', 'lvfr_aemt_content_blocks', 'pmi_schedule_blocks'];
  for (const t of anchorTables) {
    try {
      const r = (await c.query(`
        SELECT *
        FROM ${t}
        WHERE
          (column_default::text ILIKE '%2026-07%' OR true)
        LIMIT 0
      `));
      // Just verify the table exists; then dump any 2026-07 references in its date-ish columns
    } catch (_) { /* table missing */ }
  }

  // Specifically check lvfr_platoon_schedule for a start-date column
  try {
    const cols = (await c.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'lvfr_platoon_schedule' ORDER BY ordinal_position`
    )).rows;
    console.log('\nlvfr_platoon_schedule columns:');
    cols.forEach(c => console.log(`  ${c.column_name.padEnd(25)}  ${c.data_type}`));
    const sample = (await c.query(`SELECT * FROM lvfr_platoon_schedule LIMIT 5`)).rows;
    console.log(`\nlvfr_platoon_schedule sample rows: ${sample.length}`);
    sample.forEach(r => console.log('  ', JSON.stringify(r).slice(0, 200)));
  } catch (e) {
    console.log('\n(lvfr_platoon_schedule not found: ' + e.message.slice(0, 80) + ')');
  }

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
