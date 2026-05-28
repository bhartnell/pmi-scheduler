/*
 * Inspect existing calendar-sync state for lab_day_roles.
 * Pure inspection — no writes.
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

  // Inventory of source_types currently in use
  const r1 = await c.query(
    `SELECT source_type, COUNT(*) FROM google_calendar_events GROUP BY source_type ORDER BY 1`
  );
  console.log('SOURCE TYPES IN USE:');
  r1.rows.forEach(r => console.log('  ', r.source_type, '→', r.count));

  // Hartnell calendar status
  const r2 = await c.query(
    `SELECT email, google_calendar_connected, google_calendar_scope
     FROM lab_users WHERE email = 'bhartnell@pmi.edu'`
  );
  console.log('\nHARTNELL CAL STATUS:', JSON.stringify(r2.rows[0], null, 2));

  // Existing lab_day_role mappings for Hartnell
  const r3 = await c.query(
    `SELECT COUNT(*) FROM google_calendar_events
     WHERE LOWER(user_email) = 'bhartnell@pmi.edu' AND source_type = 'lab_day_role'`
  );
  console.log('\nEXISTING lab_day_role MAPPINGS FOR HARTNELL:', r3.rows[0].count);

  // Sample lab_day times for Hartnell's coordinator assignments
  const r4 = await c.query(`
    SELECT ld.id, ld.date, ld.start_time, ld.end_time, ld.title,
           p.abbreviation || ' G' || c.cohort_number AS cohort_label
    FROM lab_day_roles ldr
    JOIN lab_days ld ON ld.id = ldr.lab_day_id
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE ldr.instructor_id = '73868ffd-8e56-451f-bc81-5c2ac3a82a99'
      AND ld.date >= '2026-05-28' AND ld.date <= '2026-07-06'
    ORDER BY ld.date
    LIMIT 10
  `);
  console.log('\nFIRST 10 LAB DAYS FOR HARTNELL:');
  r4.rows.forEach(r => {
    const date = r.date.toISOString().slice(0, 10);
    console.log(
      `  ${date}  ${r.cohort_label.padEnd(8)}  ${(r.start_time || '(no start)').toString().padEnd(10)} → ${(r.end_time || '(no end)').toString().padEnd(10)}  ${r.title || '(no title)'}`
    );
  });

  // Aggregate
  const r5 = await c.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(ld.start_time)::int AS with_start,
      COUNT(ld.end_time)::int AS with_end
    FROM lab_day_roles ldr
    JOIN lab_days ld ON ld.id = ldr.lab_day_id
    WHERE ldr.instructor_id = '73868ffd-8e56-451f-bc81-5c2ac3a82a99'
      AND ld.date >= '2026-05-28' AND ld.date <= '2026-07-06'
  `);
  console.log('\nTIME COVERAGE:', JSON.stringify(r5.rows[0]));

  // Per-cohort time defaults (if any are set)
  const r6 = await c.query(`
    SELECT DISTINCT p.abbreviation || ' G' || c.cohort_number AS cohort_label,
           ld.start_time, ld.end_time, COUNT(*)::int AS n
    FROM lab_day_roles ldr
    JOIN lab_days ld ON ld.id = ldr.lab_day_id
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE ldr.instructor_id = '73868ffd-8e56-451f-bc81-5c2ac3a82a99'
      AND ld.date >= '2026-05-28' AND ld.date <= '2026-07-06'
    GROUP BY 1, 2, 3
    ORDER BY 1, 2
  `);
  console.log('\nPER-COHORT TIME PATTERNS:');
  r6.rows.forEach(r => console.log(`  ${r.cohort_label}  ${r.start_time || '(null)'} → ${r.end_time || '(null)'}  ×${r.n}`));

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
