/*
 * Audit: lab_days whose day-of-week doesn't match a 'lab' block in
 * the cohort's program_schedules.
 *
 * Background — root cause of the EMT G5 Monday lab days bug:
 *
 * The semester generator at /api/scheduling/planner/generate accepts
 * `lab_day_index` ('day1' | 'day2' | 'both' | 'none') and a
 * `day_mapping` like { "1": 1, "2": 3 } (Day 1 → Mon, Day 2 → Wed).
 * It then creates lab_days for every (week, allowed day_number)
 * combination, mapping day_number → weekday via day_mapping.
 *
 * If the operator (or the UI presets) picks lab_day_index='both' for
 * a cohort whose day_mapping covers both a lecture day AND a lab day
 * (EMT G5: Mon=lecture, Wed=lab), the generator creates lab_days on
 * BOTH days — including the lecture-only weekday. The generator
 * doesn't cross-check against pmi_schedule_blocks.block_type='lab',
 * so the Monday "lab day" lands without any warning.
 *
 * This script flags those mismatches so the operator can clean them
 * up. Read-only — no writes. Run periodically (or after generating a
 * new cohort's semester).
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

  // 1. Build per-cohort set of "lab DOWs" from pmi_schedule_blocks.
  const labBlocks = (await c.query(`
    SELECT c.id AS cohort_id,
           p.abbreviation || ' G' || c.cohort_number AS cohort_label,
           pb.day_of_week
    FROM pmi_schedule_blocks pb
    JOIN pmi_program_schedules ps ON ps.id = pb.program_schedule_id
    JOIN cohorts c ON c.id = ps.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE pb.block_type = 'lab'
      AND c.is_active = true
      AND c.is_archived = false
      AND pb.day_of_week IS NOT NULL
    GROUP BY 1, 2, 3
    ORDER BY 2, 3
  `)).rows;

  const cohortLabDows = new Map(); // cohort_id → Set<dow>
  const cohortLabels = new Map(); // cohort_id → label
  for (const r of labBlocks) {
    if (!cohortLabDows.has(r.cohort_id)) cohortLabDows.set(r.cohort_id, new Set());
    cohortLabDows.get(r.cohort_id).add(r.day_of_week);
    cohortLabels.set(r.cohort_id, r.cohort_label);
  }

  console.log('CONFIGURED LAB DOWs PER COHORT:');
  for (const [cohortId, dows] of cohortLabDows) {
    const dowList = [...dows].sort().map(d => `${DOW_NAMES[d]}(${d})`).join(', ');
    console.log(`  ${cohortLabels.get(cohortId).padEnd(10)}  ${dowList}`);
  }

  // 2. Pull all lab_days for active cohorts and bucket by mismatch.
  const labDays = (await c.query(`
    SELECT c.id AS cohort_id,
           p.abbreviation || ' G' || c.cohort_number AS cohort_label,
           ld.id AS lab_day_id,
           ld.date,
           EXTRACT(DOW FROM ld.date)::int AS dow,
           ld.title,
           ld.week_number,
           ld.day_number
    FROM lab_days ld
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN programs p ON p.id = c.program_id
    WHERE c.is_active = true AND c.is_archived = false
    ORDER BY 2, 4
  `)).rows;

  const mismatches = [];
  for (const ld of labDays) {
    const allowed = cohortLabDows.get(ld.cohort_id);
    if (!allowed) {
      mismatches.push({ ...ld, reason: 'no_schedule_blocks' });
    } else if (!allowed.has(ld.dow)) {
      mismatches.push({ ...ld, reason: 'dow_not_in_schedule' });
    }
  }

  console.log(`\nMISMATCHES (${mismatches.length} of ${labDays.length} total lab_days):`);
  if (mismatches.length === 0) {
    console.log('  Clean — every lab_day lands on a configured lab DOW. ✓');
  } else {
    let lastCohort = '';
    for (const m of mismatches) {
      if (m.cohort_label !== lastCohort) {
        const allowed = cohortLabDows.get(m.cohort_id);
        const allowedStr = allowed ? [...allowed].sort().map(d => DOW_NAMES[d]).join(',') : '(none)';
        console.log(`\n  ${m.cohort_label}  (configured lab DOWs: ${allowedStr})`);
        lastCohort = m.cohort_label;
      }
      const dateStr = m.date.toISOString().slice(0, 10);
      const reason = m.reason === 'no_schedule_blocks'
        ? 'cohort has NO lab blocks in any program_schedule'
        : `${DOW_NAMES[m.dow]} not in cohort's lab DOWs`;
      console.log(`    ${dateStr}  ${DOW_NAMES[m.dow]}  W${m.week_number || '?'} D${m.day_number || '?'}  ${m.title || '(no title)'}  ← ${reason}`);
      console.log(`      lab_day_id: ${m.lab_day_id}`);
    }
    console.log('\nTo remove a mismatch: delete the lab_days row. lab_day_roles,');
    console.log('station rows, etc. cascade via FK ON DELETE CASCADE.');
  }

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
