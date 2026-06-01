/*
 * Inspect EMT G5's lab days vs. configured lab block days.
 * Read-only — no writes.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const m = env.match(/SUPABASE_DB_URL=(.+)/);
const url = m[1].replace(/^["']|["']$/g, '').trim();

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();

  // 0. ALL EMT G5 cohort rows (in case there's more than one)
  const allEmtG5 = (await c.query(
    `SELECT c.id, c.cohort_number, c.is_active, c.is_archived,
            c.start_date, c.end_date, c.created_at, p.abbreviation
     FROM cohorts c
     JOIN programs p ON p.id = c.program_id
     WHERE p.abbreviation = 'EMT' AND c.cohort_number = 5
     ORDER BY c.created_at`
  )).rows;
  console.log(`ALL EMT G5 COHORTS (${allEmtG5.length}):`);
  allEmtG5.forEach(r => console.log(`  ${r.id} active=${r.is_active} archived=${r.is_archived} start=${r.start_date && r.start_date.toISOString().slice(0,10)} created=${r.created_at && r.created_at.toISOString().slice(0,10)}`));

  // 1. Pick the active/most-recent for the rest of the inspection
  const cohort = allEmtG5.find(r => r.is_active && !r.is_archived) || allEmtG5[0];
  console.log('\nUSING COHORT:', JSON.stringify(cohort, null, 2));

  // 2. Program schedule(s) for EMT G5
  const schedules = (await c.query(
    `SELECT id, cohort_id, semester_id, created_at
     FROM pmi_program_schedules
     WHERE cohort_id = $1
     ORDER BY created_at DESC`,
    [cohort.id]
  )).rows;
  console.log(`\nPROGRAM SCHEDULES: ${schedules.length}`);
  schedules.forEach(s => console.log('  ', s.id, 'semester:', s.semester_id, 'created:', s.created_at));

  // 3. All schedule blocks for those program schedules — grouped by day_of_week + block_type
  for (const s of schedules) {
    const blocks = (await c.query(
      `SELECT day_of_week, block_type, COUNT(*)::int AS n,
              MIN(start_time) AS earliest, MAX(end_time) AS latest,
              array_agg(DISTINCT title ORDER BY title) AS titles
       FROM pmi_schedule_blocks
       WHERE program_schedule_id = $1
       GROUP BY day_of_week, block_type
       ORDER BY day_of_week, block_type`,
      [s.id]
    )).rows;
    console.log(`\nBLOCKS for schedule ${s.id.slice(0, 8)}…:`);
    blocks.forEach(b => {
      const dowName = DOW_NAMES[b.day_of_week] || `?${b.day_of_week}`;
      const titleSample = (b.titles || []).slice(0, 2).join(' / ');
      console.log(`  ${dowName} (${b.day_of_week})  ${b.block_type.padEnd(10)}  ${b.earliest}-${b.latest}  ×${b.n}  ${titleSample}`);
    });
  }

  // 4. Actual lab_days rows for this cohort — group by date and DOW
  const labDays = (await c.query(
    `SELECT date, EXTRACT(DOW FROM date)::int AS dow,
            title, week_number, day_number, start_time, end_time
     FROM lab_days
     WHERE cohort_id = $1
     ORDER BY date`,
    [cohort.id]
  )).rows;
  console.log(`\nLAB_DAYS rows (${labDays.length} total):`);
  // Count by DOW
  const dowCounts = {};
  labDays.forEach(ld => {
    dowCounts[ld.dow] = (dowCounts[ld.dow] || 0) + 1;
  });
  console.log('  By day-of-week:');
  Object.keys(dowCounts).sort().forEach(dow => {
    console.log(`    ${DOW_NAMES[dow]} (${dow}) → ${dowCounts[dow]} lab day(s)`);
  });

  // 5. Hartnell-window subset: 2026-05-28 → 2026-07-06
  console.log('\nLAB_DAYS in summer window (2026-05-28 → 2026-07-06):');
  labDays
    .filter(ld => {
      const d = ld.date.toISOString().slice(0, 10);
      return d >= '2026-05-28' && d <= '2026-07-06';
    })
    .forEach(ld => {
      const dateStr = ld.date.toISOString().slice(0, 10);
      const dowName = DOW_NAMES[ld.dow];
      const flag = ld.dow === 1 ? '  ← MONDAY (suspect)' : ld.dow === 3 ? '  ← Wed (expected)' : '';
      console.log(`  ${dateStr}  ${dowName}  W${ld.week_number || '?'} D${ld.day_number || '?'}  ${ld.title || '(no title)'}${flag}`);
    });

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
