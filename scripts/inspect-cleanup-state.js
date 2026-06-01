/*
 * Quick post-cleanup sanity check.
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

  // Hartnell's coordinator assignments NOW
  const r = (await c.query(`
    SELECT COUNT(*)::int AS n, SUM(CASE WHEN EXTRACT(DOW FROM ld.date) = 1 THEN 1 ELSE 0 END)::int AS mondays
    FROM lab_day_roles ldr
    JOIN lab_days ld ON ld.id = ldr.lab_day_id
    WHERE ldr.instructor_id = '73868ffd-8e56-451f-bc81-5c2ac3a82a99'
      AND ld.date >= '2026-05-28' AND ld.date <= '2026-07-06'
  `)).rows[0];
  console.log('Hartnell coordinator rows in summer window:', r);

  // All EMT G5 lab_days (any date) by DOW
  const r2 = (await c.query(`
    SELECT EXTRACT(DOW FROM date)::int AS dow, COUNT(*)::int AS n
    FROM lab_days ld
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE p.abbreviation = 'EMT' AND c.cohort_number = 5
    GROUP BY 1
    ORDER BY 1
  `)).rows;
  console.log('\nEMT G5 lab_days by DOW (all dates):', r2);

  // Any remaining Monday EMT G5 lab days?
  const r3 = (await c.query(`
    SELECT ld.date, ld.title, ld.week_number, ld.day_number
    FROM lab_days ld
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE p.abbreviation = 'EMT' AND c.cohort_number = 5
      AND EXTRACT(DOW FROM ld.date) = 1
    ORDER BY date
  `)).rows;
  console.log(`\nRemaining MONDAY EMT G5 lab days (${r3.length}):`);
  r3.forEach(r => console.log('  ', r.date.toISOString().slice(0,10), `W${r.week_number} D${r.day_number}`, r.title));

  // Schedule blocks: any 'lab' on a Monday in any cohort?
  const r4 = (await c.query(`
    SELECT p.abbreviation || ' G' || c.cohort_number AS cohort_label,
           pb.day_of_week, pb.block_type, COUNT(*)::int AS n
    FROM pmi_schedule_blocks pb
    JOIN pmi_program_schedules ps ON ps.id = pb.program_schedule_id
    JOIN cohorts c ON c.id = ps.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE pb.block_type = 'lab'
      AND c.is_active = true AND c.is_archived = false
    GROUP BY 1, 2, 3
    ORDER BY 1, 2
  `)).rows;
  console.log(`\nActive cohorts' lab blocks by DOW:`);
  r4.forEach(r => console.log(`  ${r.cohort_label.padEnd(8)}  dow=${r.day_of_week}  ${r.block_type}  ×${r.n}`));

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
