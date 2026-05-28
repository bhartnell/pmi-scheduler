/*
 * Bulk-assign Benjamin Hartnell as coordinator to all upcoming
 * lab days for active cohorts (PM G14, PM G15, EMT G5) between
 * today and 2026-07-06.
 *
 * Pass --execute to actually insert. Default is dry-run.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const dbUrlMatch = envText.match(/SUPABASE_DB_URL=(.+)/);
if (!dbUrlMatch) {
  console.error('Missing SUPABASE_DB_URL in .env.local');
  process.exit(1);
}
const dbUrl = dbUrlMatch[1].replace(/^["']|["']$/g, '').trim();

const EXECUTE = process.argv.includes('--execute');
const EMAIL = 'bhartnell@pmi.edu';
const START_DATE = '2026-05-28'; // today
const END_DATE = '2026-07-06';
const COHORTS = ['G14', 'G15', 'G5']; // PM G14, PM G15, EMT G5

(async () => {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();

  // 1. Find user
  const u = await c.query('SELECT id, email, name, role FROM lab_users WHERE email = $1', [EMAIL]);
  if (u.rows.length === 0) {
    console.error(`User ${EMAIL} not found`);
    process.exit(1);
  }
  const user = u.rows[0];
  console.log('USER:', JSON.stringify(user, null, 2));

  // 2. Inspect role constraint on lab_day_roles
  const cc = await c.query(`
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'lab_day_roles' AND con.contype = 'c'
  `);
  console.log('\nCHECK CONSTRAINTS:');
  cc.rows.forEach(r => console.log('  ', r.conname, '=>', r.def));

  // 3. Columns
  const cols = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'lab_day_roles'
    ORDER BY ordinal_position
  `);
  console.log('\nCOLUMNS:');
  cols.rows.forEach(r => console.log('  ', r.column_name, r.data_type, r.is_nullable === 'NO' ? 'NOT NULL' : 'NULL', r.column_default ? `default ${r.column_default}` : ''));

  // 4. Existing roles in production for context
  const existingRoles = await c.query(`
    SELECT DISTINCT role FROM lab_day_roles ORDER BY role
  `);
  console.log('\nEXISTING ROLES IN USE:', existingRoles.rows.map(r => r.role).join(', '));

  // 5. Find target lab days
  const cohortFilter = COHORTS.map((_, i) => `$${i + 3}`).join(',');
  const labDays = await c.query(
    `
    SELECT ld.id, ld.date, ld.title, c.cohort_number, p.abbreviation AS program
    FROM lab_days ld
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE ld.date >= $1
      AND ld.date <= $2
      AND CONCAT(p.abbreviation, ' G', c.cohort_number) = ANY(ARRAY[${COHORTS.map((_, i) => `$${i + 3}`).join(',')}])
    ORDER BY ld.date, p.abbreviation, c.cohort_number
    `,
    [START_DATE, END_DATE, ...COHORTS.map(g => g.startsWith('G') ? `PM ${g}` : g)]
  );

  // Different shape — simpler: filter by program abbr + cohort number explicitly.
  const filtered = await c.query(
    `
    SELECT ld.id, ld.date, ld.title, c.cohort_number, p.abbreviation AS program,
      EXISTS (
        SELECT 1 FROM lab_day_roles ldi
        WHERE ldi.lab_day_id = ld.id AND ldi.instructor_id = $1
      ) AS already_assigned
    FROM lab_days ld
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE ld.date >= $2
      AND ld.date <= $3
      AND (
           (p.abbreviation = 'PM' AND c.cohort_number IN (14, 15))
        OR (p.abbreviation = 'EMT' AND c.cohort_number = 5)
      )
    ORDER BY ld.date, p.abbreviation, c.cohort_number
    `,
    [user.id, START_DATE, END_DATE]
  );

  console.log(`\nTARGET LAB DAYS: ${filtered.rows.length} between ${START_DATE} and ${END_DATE}`);
  filtered.rows.forEach(r => {
    const flag = r.already_assigned ? '[ALREADY ASSIGNED]' : '[would insert]';
    console.log(`  ${r.date.toISOString().slice(0,10)}  ${r.program} G${r.cohort_number}  "${r.title || '(no title)'}"  ${flag}`);
  });

  const toInsert = filtered.rows.filter(r => !r.already_assigned);
  console.log(`\nWILL INSERT ${toInsert.length} new assignments (skipping ${filtered.rows.length - toInsert.length} duplicates).`);

  if (!EXECUTE) {
    console.log('\nDRY RUN — re-run with --execute to insert.');
    await c.end();
    return;
  }

  if (toInsert.length === 0) {
    console.log('Nothing to insert.');
    await c.end();
    return;
  }

  console.log('\nINSERTING...');
  let inserted = 0;
  for (const r of toInsert) {
    try {
      await c.query(
        `INSERT INTO lab_day_roles (lab_day_id, instructor_id, role, notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [r.id, user.id, 'coordinator', 'Bulk-assigned 2026-05-28 — Hartnell coordinator coverage through 2026-07-06']
      );
      inserted++;
    } catch (err) {
      console.error(`  FAILED for ${r.id} (${r.date.toISOString().slice(0,10)} ${r.program} G${r.cohort_number}):`, err.message);
    }
  }
  console.log(`\nINSERTED ${inserted} rows.`);

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
