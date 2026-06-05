/*
 * One-shot: update AEMT G2 cohort start_date to 2026-07-14, then
 * verify the runsheet population.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const m = env.match(/SUPABASE_DB_URL=(.+)/);
const url = m[1].replace(/^["']|["']$/g, '').trim();

const COHORT = '6796e139-3add-4bdd-84da-52963ae4eb21';

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();

  const before = (await c.query('SELECT id, start_date FROM cohorts WHERE id = $1', [COHORT])).rows[0];
  console.log('BEFORE:', before);

  await c.query(`UPDATE cohorts SET start_date = '2026-07-14' WHERE id = $1`, [COHORT]);

  const after = (await c.query('SELECT id, start_date FROM cohorts WHERE id = $1', [COHORT])).rows[0];
  console.log('AFTER: ', after);

  // Spot-check Day 1 in DB
  const verify = await c.query(`
    SELECT lds.date, lds.session, lsi.sort_order, lsi.item_type, lsi.estimated_minutes, lsi.title
    FROM lvfr_day_schedule lds
    JOIN lvfr_schedule_items lsi ON lsi.day_schedule_id = lds.id
    WHERE lds.cohort_id = $1 AND lds.date = '2026-07-14'
    ORDER BY lds.session, lsi.sort_order
  `, [COHORT]);
  console.log(`\nDay 1 (2026-07-14) verification — ${verify.rows.length} items:`);
  verify.rows.forEach(r => {
    console.log(`  ${r.session.padEnd(9)} #${String(r.sort_order).padStart(2)}  [${r.item_type.padEnd(7)}]  ${String(r.estimated_minutes || '?').padStart(3)}min  ${r.title}`);
  });

  // Per-day aggregate
  const counts = await c.query(`
    SELECT lds.date, lds.session, COUNT(lsi.id)::int AS items
    FROM lvfr_day_schedule lds
    LEFT JOIN lvfr_schedule_items lsi ON lsi.day_schedule_id = lds.id
    WHERE lds.cohort_id = $1
    GROUP BY 1, 2 ORDER BY 1, 2
  `, [COHORT]);
  console.log(`\nPer-day item counts (${counts.rows.length} day/session rows):`);
  let lastDate = null;
  for (const r of counts.rows) {
    const date = r.date.toISOString().slice(0, 10);
    const sep = (lastDate && lastDate !== date) ? '\n' : '';
    console.log(`${sep}  ${date}  ${r.session.padEnd(9)}  items=${r.items}`);
    lastDate = date;
  }

  // Totals
  const total = (await c.query(`
    SELECT COUNT(DISTINCT lds.id)::int AS days, COUNT(lsi.id)::int AS items
    FROM lvfr_day_schedule lds
    LEFT JOIN lvfr_schedule_items lsi ON lsi.day_schedule_id = lds.id
    WHERE lds.cohort_id = $1
  `, [COHORT])).rows[0];
  console.log(`\nTOTAL: ${total.days} day-schedule rows, ${total.items} items`);

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
