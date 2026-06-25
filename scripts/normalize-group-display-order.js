/**
 * Normalize lab_groups.display_order to match the numeric suffix in the group
 * name ("Group N" -> display_order = N).
 *
 * Root cause of the user-reported "groups show 1,4,2,3" bug: display_order
 * drifted out of sync with the names (e.g. PM G15 had "Group 4" at order=2 and
 * "Group 2" also at order=2 — a tie). The groups API sorts by name (correct for
 * <=9 groups), but any consumer that orders by display_order rendered the
 * drifted 1,4,2,3 sequence. Aligning display_order with the name number fixes
 * the ordering for every consumer regardless of which key it sorts on.
 *
 * Idempotent: only updates rows where display_order != the name's number.
 * Usage:  node scripts/normalize-group-display-order.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}

const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('BEGIN');
  try {
    const rows = (await c.query(
      `select g.id, g.name, g.display_order, c.cohort_number
         from lab_groups g join cohorts c on c.id = g.cohort_id
        order by c.cohort_number, g.name`
    )).rows;

    let updates = 0;
    for (const r of rows) {
      const m = String(r.name || '').match(/(\d+)/);
      if (!m) continue; // skip non-"Group N" custom names
      const want = parseInt(m[1], 10);
      if (r.display_order === want) continue;
      console.log(`G${r.cohort_number} "${r.name}": display_order ${r.display_order} -> ${want}`);
      await c.query('update lab_groups set display_order = $1, updated_at = now() where id = $2', [want, r.id]);
      updates++;
    }

    console.log(`\n${updates} group(s) ${DRY_RUN ? 'WOULD BE' : 'were'} updated.`);
    if (DRY_RUN) {
      await c.query('ROLLBACK');
      console.log('DRY RUN — rolled back.');
    } else {
      await c.query('COMMIT');
      console.log('COMMITTED.');
    }
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
