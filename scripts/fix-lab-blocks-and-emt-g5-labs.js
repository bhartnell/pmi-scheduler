#!/usr/bin/env node
// Two coordinated data fixes.
//
//   ISSUE 1: PM G14 + PM G15 — lab_days exist but no matching
//   pmi_schedule_blocks row with block_type='lab'. The lab_day
//   shows on the cohort hub (orange bar) but no time block lands
//   on the master calendar. Insert one lab-type block per missing
//   pair, cloning recurring_group_id from any existing lab block
//   of the same series so the calendar treats the new row as part
//   of the same recurring series.
//
//     PM G14 Day 1 (Thu, dow 4): 15:00–17:00  "Day 1 S2 Lab"
//     PM G14 Day 2 (Fri, dow 5): 15:00–17:00  "Day 2 S2 Lab"
//     PM G15        (Mon dow 1 / Tue dow 2): 14:40–17:00  "S1 Lab"
//
//   ISSUE 2: EMT G5 — Wednesday lab_days missing. The cohort runs
//   labs every Wednesday May 13 → Aug 12, weeks 1-14 (no week 15).
//   Insert any missing rows with the canonical
//   "Week N — Content Pending" title.

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.substring(0, eq).trim();
    const v = t.substring(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const conn =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres.mkrqpwncfjpppxyntdtp'}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`;

const SUMMER = '638470a7-5320-4c98-b690-1c77aae710f4';
const PM_G14_PROGRAM_SCHEDULE_ID = '26d1db7d-edeb-41ce-817b-f74f1b458951';
const PM_G15_PROGRAM_SCHEDULE_ID = '5b2a1825-144a-44fc-9cf5-63f28e4ea992';
const PM_G14_COHORT_ID = '8577fdc3-eff6-4000-9302-1ee6e3043eeb';
const PM_G15_COHORT_ID = '856bcf1d-2e85-48b5-92a3-aba941103109';
const EMT_G5_COHORT_ID = '67080313-0c52-411b-8e88-2ae6e99eb6c6';

const DRY_RUN = process.argv.includes('--dry-run');

// Title + time rules per cohort. day_of_week is derived from the
// actual lab_day.date column (not from day_number) because each
// cohort uses day_number as a logical "first/second class day"
// label — PM G14 day_number=1 = Thursday, PM G15 day_number=1 =
// Tuesday, etc. Hardcoding day_of_week here would break that.
function titleFor(programScheduleId, dayNumber) {
  if (programScheduleId === PM_G14_PROGRAM_SCHEDULE_ID) {
    return `Day ${dayNumber ?? 1} S2 Lab`;
  }
  if (programScheduleId === PM_G15_PROGRAM_SCHEDULE_ID) {
    return 'S1 Lab';
  }
  return null;
}
function timesFor(programScheduleId) {
  if (programScheduleId === PM_G14_PROGRAM_SCHEDULE_ID) {
    return { start_time: '15:00:00', end_time: '17:00:00' };
  }
  if (programScheduleId === PM_G15_PROGRAM_SCHEDULE_ID) {
    return { start_time: '14:40:00', end_time: '17:00:00' };
  }
  return null;
}

async function findExistingLabSeries(c, programScheduleId, title) {
  // Lookup by program_schedule + title only. The series may run
  // on any weekday; we just need any row to clone its
  // recurring_group_id and stylistic metadata.
  const { rows } = await c.query(
    `
    SELECT recurring_group_id, start_time, end_time, title, course_name,
           color, sort_order, is_recurring, instructor_id,
           additional_instructor_id, room_id, status, content_notes
    FROM pmi_schedule_blocks
    WHERE program_schedule_id = $1
      AND semester_id = $2
      AND block_type = 'lab'
      AND title = $3
    ORDER BY date ASC
    LIMIT 1
    `,
    [programScheduleId, SUMMER, title]
  );
  return rows[0] || null;
}

async function fixIssue1(c) {
  console.log('\n──── ISSUE 1: lab_days without matching schedule_blocks lab row ────');

  const { rows: missing } = await c.query(
    `
    SELECT ld.id AS lab_day_id, ld.date::text AS date,
           ld.week_number, ld.day_number,
           EXTRACT(DOW FROM ld.date)::int AS day_of_week,
           c.cohort_number, pps.id AS program_schedule_id, c.id AS cohort_id
    FROM lab_days ld
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN pmi_program_schedules pps ON pps.cohort_id = c.id
    WHERE c.cohort_number IN (14, 15)
      AND ld.date >= '2026-05-11'
      AND NOT EXISTS (
        SELECT 1 FROM pmi_schedule_blocks psb
        WHERE psb.program_schedule_id = pps.id
          AND psb.date = ld.date
          AND psb.block_type = 'lab'
          AND psb.status = 'published'
      )
    ORDER BY c.cohort_number, ld.date
    `
  );
  console.log(`  Found ${missing.length} lab_days missing a paired lab block.`);

  // Cache existing series row per (program_schedule_id, title) so
  // we only do the lookup once per series.
  const seriesCache = new Map();
  let inserted = 0;

  for (const m of missing) {
    const title = titleFor(m.program_schedule_id, m.day_number);
    const times = timesFor(m.program_schedule_id);
    if (!title || !times) {
      console.log(`    ⚠ ${m.date} G${m.cohort_number}: no rule for program_schedule_id=${m.program_schedule_id} — skipping`);
      continue;
    }

    const cacheKey = `${m.program_schedule_id}|${title}`;
    let seriesRow = seriesCache.get(cacheKey);
    if (seriesRow === undefined) {
      seriesRow = await findExistingLabSeries(c, m.program_schedule_id, title);
      seriesCache.set(cacheKey, seriesRow);
    }

    const startTime = seriesRow?.start_time || times.start_time;
    const endTime = seriesRow?.end_time || times.end_time;
    // Clone recurring_group_id when found so the new row joins the
    // existing series; otherwise mint a new uuid via the DB so all
    // future rows can still pivot together.
    const recurringGroupId = seriesRow?.recurring_group_id || null;

    const sql = `
      INSERT INTO pmi_schedule_blocks (
        semester_id, program_schedule_id, day_of_week, date, week_number,
        recurring_group_id, start_time, end_time, block_type, title,
        course_name, content_notes, color, is_recurring, sort_order,
        instructor_id, additional_instructor_id, room_id, status,
        linked_lab_day_id
      )
      SELECT
        $1, $2, $3, $4::date, $5,
        COALESCE($6::uuid, gen_random_uuid()), $7, $8, 'lab', $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, 'published',
        $18
      WHERE NOT EXISTS (
        SELECT 1 FROM pmi_schedule_blocks
        WHERE program_schedule_id = $2
          AND semester_id = $1
          AND date = $4::date
          AND block_type = 'lab'
      )
      RETURNING id
    `;
    const params = [
      SUMMER,
      m.program_schedule_id,
      m.day_of_week,
      m.date,
      m.week_number ?? 1,
      recurringGroupId,
      startTime,
      endTime,
      title,
      seriesRow?.course_name ?? title,
      seriesRow?.content_notes ?? null,
      seriesRow?.color ?? null,
      seriesRow?.is_recurring ?? true,
      seriesRow?.sort_order ?? 99, // labs sort late in the day
      seriesRow?.instructor_id ?? null,
      seriesRow?.additional_instructor_id ?? null,
      seriesRow?.room_id ?? null,
      m.lab_day_id, // pre-link the new schedule_block to its lab_day
    ];

    if (DRY_RUN) {
      console.log(`    [dry-run] G${m.cohort_number} ${m.date} W${m.week_number}D${m.day_number} dow=${m.day_of_week} → "${title}" ${startTime}–${endTime}` +
                  `  recurring_group_id=${recurringGroupId ? recurringGroupId.slice(0,8)+'…' : '(new)'}`);
      continue;
    }

    const { rows: insertResult } = await c.query(sql, params);
    if (insertResult.length > 0) {
      inserted++;
      console.log(`    + G${m.cohort_number} ${m.date} W${m.week_number}D${m.day_number} dow=${m.day_of_week} → "${title}"`);
    } else {
      console.log(`    · G${m.cohort_number} ${m.date} already has a lab block (race-skip)`);
    }
  }

  console.log(`  Inserted ${inserted} lab schedule blocks.`);
}

async function fixIssue2(c) {
  console.log('\n──── ISSUE 2: EMT G5 missing Wednesday lab_days ────');

  // generate_series of every Wed from May 13 → Aug 12 (14 dates).
  const { rows: missing } = await c.query(
    `
    SELECT gs.d::date AS date,
           ((gs.d::date - DATE '2026-05-13') / 7 + 1)::int AS week_number
    FROM generate_series(
      DATE '2026-05-13',
      DATE '2026-08-12',
      INTERVAL '7 days'
    ) AS gs(d)
    WHERE NOT EXISTS (
      SELECT 1 FROM lab_days ld
      WHERE ld.cohort_id = $1
        AND ld.date = gs.d::date
    )
    ORDER BY gs.d
    `,
    [EMT_G5_COHORT_ID]
  );
  console.log(`  Found ${missing.length} missing Wednesday lab_days for EMT G5.`);

  let inserted = 0;
  for (const r of missing) {
    if (DRY_RUN) {
      console.log(`    [dry-run] EMT G5 ${r.date.toISOString().slice(0,10)} → Week ${r.week_number}`);
      continue;
    }
    const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date;
    const sql = `
      INSERT INTO lab_days (cohort_id, date, week_number, day_number, title, created_at)
      SELECT $1, $2::date, $3, 1, $4, now()
      WHERE NOT EXISTS (
        SELECT 1 FROM lab_days
        WHERE cohort_id = $1 AND date = $2::date
      )
      RETURNING id
    `;
    const title = `Week ${r.week_number} — Content Pending`;
    const { rows: ins } = await c.query(sql, [EMT_G5_COHORT_ID, dateStr, r.week_number, title]);
    if (ins.length > 0) {
      inserted++;
      console.log(`    + EMT G5 ${dateStr} Week ${r.week_number}`);
    } else {
      console.log(`    · EMT G5 ${dateStr} already exists (race-skip)`);
    }
  }
  console.log(`  Inserted ${inserted} EMT G5 lab_days.`);
}

async function summary(c) {
  console.log('\n──── VERIFICATION ────');

  // 1. PM G14/G15 still-missing pairs
  const { rows: stillMissing } = await c.query(
    `
    SELECT c.cohort_number, COUNT(*)::int AS still_missing
    FROM lab_days ld
    JOIN cohorts c ON c.id = ld.cohort_id
    JOIN pmi_program_schedules pps ON pps.cohort_id = c.id
    WHERE c.cohort_number IN (14, 15)
      AND ld.date >= '2026-05-11'
      AND NOT EXISTS (
        SELECT 1 FROM pmi_schedule_blocks psb
        WHERE psb.program_schedule_id = pps.id
          AND psb.date = ld.date
          AND psb.block_type = 'lab'
          AND psb.status = 'published'
      )
    GROUP BY c.cohort_number
    `
  );
  if (stillMissing.length === 0) {
    console.log('  PM G14/G15: every lab_day has a paired lab schedule_block ✓');
  } else {
    for (const r of stillMissing) {
      console.log(`  PM G${r.cohort_number}: ${r.still_missing} lab_days STILL missing a lab block`);
    }
  }

  // 2. EMT G5 Wed coverage
  const { rows: emtCheck } = await c.query(
    `
    SELECT COUNT(*)::int AS lab_day_count,
           MIN(date) AS first_date,
           MAX(date) AS last_date
    FROM lab_days
    WHERE cohort_id = $1
      AND date BETWEEN '2026-05-13' AND '2026-08-12'
    `,
    [EMT_G5_COHORT_ID]
  );
  const r = emtCheck[0];
  console.log(`  EMT G5 May 13–Aug 12: ${r.lab_day_count} lab_days (expect 14)  ` +
              `range ${r.first_date?.toISOString?.().slice(0,10) ?? r.first_date} → ` +
              `${r.last_date?.toISOString?.().slice(0,10) ?? r.last_date}`);
}

(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`Dry run: ${DRY_RUN}`);
  try {
    await c.query('BEGIN');
    await fixIssue1(c);
    await fixIssue2(c);
    if (DRY_RUN) {
      await c.query('ROLLBACK');
      console.log('\n[dry-run] rolled back');
    } else {
      await c.query('COMMIT');
      console.log('\nCommitted ✓');
    }
    await summary(c);
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('\nFailed:', err);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
