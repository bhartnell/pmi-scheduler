#!/usr/bin/env node
/**
 * ACLS day-builder (build-order step 5).
 *
 * Generates a cohort's ACLS course days from acls_schedule_seed.json:
 *   - practical blocks (learning_station / bls_station / scenario_station)
 *       -> lab_days (+ lab_stations; scenario_id resolved from case_code).
 *       The Day-2 scored block gets is_adv_cert_testing=true.
 *   - teaching blocks (admin / lesson / debrief / exam / remediation)
 *       -> pmi_schedule_blocks (semester_id resolved by date window).
 *   - break / lunch are omitted (per the seed's "or omit").
 *
 * REUSABLE TEMPLATE: block structure/timing come from the seed; cohort,
 * dates, instructors, rooms, and which scenarios run are per-cohort inputs.
 * Run it again for the next paramedic cohort with different --cohort/--day1/2.
 *
 * Idempotent SELECT-then-write: lab_days by (cohort_id, date, title),
 * lab_stations by (lab_day_id, station_number), pmi_schedule_blocks by
 * (date, start_time, title). Re-running updates in place.
 *
 * Instructor names are stored verbatim (instructor_name); the instructor_id
 * FK is set only on a unique lab_users match (prefers non-guest). "All
 * instructors" / "Other" are left unlinked.
 *
 * Usage:
 *   node scripts/build-acls-days.js --schedule <seed.json> \
 *     --cohort <number|uuid> --day1 YYYY-MM-DD --day2 YYYY-MM-DD [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ---- env ----
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

// ---- args ----
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipBlocks = args.includes('--skip-blocks'); // skip pmi_schedule_blocks (teaching) — lab_days+stations only
function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const scheduleFile = arg('schedule');
const cohortArg = arg('cohort');
const dayDates = { 1: arg('day1'), 2: arg('day2') };
if (!scheduleFile || !cohortArg || !dayDates[1] || !dayDates[2]) {
  console.error('Usage: node scripts/build-acls-days.js --schedule <seed.json> --cohort <number|uuid> --day1 YYYY-MM-DD --day2 YYYY-MM-DD [--dry-run]');
  process.exit(1);
}

const TEACHING_TYPES = { admin: 'admin', lesson: 'lecture', debrief: 'meeting', exam: 'exam', remediation: 'other' };
const PRACTICAL_TYPES = new Set(['learning_station', 'bls_station', 'scenario_station']);
const OMIT_TYPES = new Set(['break', 'lunch']);
const GENERIC_INSTRUCTORS = new Set(['all instructors', 'other', '']);

function dowFromDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay(); // 0=Sun..6=Sat
}

async function resolveInstructorId(client, name, cache) {
  if (!name) return null;
  const norm = name.trim().toLowerCase();
  if (GENERIC_INSTRUCTORS.has(norm)) return null;
  if (cache.has(norm)) return cache.get(norm);
  // "F. Last" or "First Last"
  const parts = name.trim().replace(/\./g, '').split(/\s+/);
  const last = parts[parts.length - 1];
  const firstInitial = (parts[0] || '').charAt(0).toLowerCase();
  const rows = (await client.query(
    `SELECT id, name, role FROM lab_users WHERE name ILIKE $1`, ['%' + last + '%']
  )).rows;
  // Require the first initial to match when we have one — otherwise a lone
  // last-name hit for a DIFFERENT person (e.g. "B. Young" vs the only Young,
  // "Ryan Young") must NOT silently bind. No confident initial match -> null.
  let match = rows;
  if (firstInitial) {
    match = rows.filter((r) => (r.name || '').trim().charAt(0).toLowerCase() === firstInitial);
  }
  if (match.length > 1) {
    const nonGuest = match.filter((r) => r.role !== 'guest');
    if (nonGuest.length === 1) match = nonGuest;
  }
  const id = match.length === 1 ? match[0].id : null;
  cache.set(norm, id);
  return id;
}

async function main() {
  const seed = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
  const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const instrCache = new Map();
  const stats = { labDays: 0, labDaysUpd: 0, stations: 0, stationsUpd: 0, blocks: 0, blocksUpd: 0, omitted: 0, scenMissing: [], instrUnresolved: new Set() };
  const plan = [];

  try {
    await client.query('BEGIN');

    // resolve cohort
    let cohort;
    if (/^[0-9a-f-]{36}$/i.test(cohortArg)) {
      cohort = (await client.query('SELECT id, cohort_number, current_semester FROM cohorts WHERE id=$1', [cohortArg])).rows[0];
    } else {
      cohort = (await client.query('SELECT id, cohort_number, current_semester FROM cohorts WHERE cohort_number=$1', [parseFloat(cohortArg)])).rows[0];
    }
    if (!cohort) throw new Error(`Cohort not found: ${cohortArg}`);
    const cohortId = cohort.id;
    const semester = cohort.current_semester ?? null;

    // optional program_schedule for cohort (links teaching blocks)
    const ps = (await client.query('SELECT id FROM pmi_program_schedules WHERE cohort_id=$1 ORDER BY created_at LIMIT 1', [cohortId])).rows[0];
    const programScheduleId = ps?.id || null;

    // scenario case_code -> id map (ACLS)
    const scenRows = (await client.query(`SELECT id, case_code FROM scenarios WHERE cert_course='acls' AND case_code IS NOT NULL`)).rows;
    const scenByCode = {};
    for (const r of scenRows) scenByCode[r.case_code] = r.id;

    for (const day of seed.days || []) {
      const date = dayDates[day.day];
      if (!date) continue;
      const dow = dowFromDate(date);

      // resolve semester_id for the date (year-anchor: override then pmi_semesters)
      let semesterId = (await client.query(
        `SELECT semester_id FROM cohort_semester_overrides WHERE cohort_id=$1 AND start_date<=$2 AND end_date>=$2 ORDER BY start_date LIMIT 1`,
        [cohortId, date]
      )).rows[0]?.semester_id;
      if (!semesterId) {
        semesterId = (await client.query(
          `SELECT id FROM pmi_semesters WHERE start_date<=$1 AND end_date>=$1 AND is_active=true ORDER BY start_date LIMIT 1`, [date]
        )).rows[0]?.id || null;
      }

      const blocks = (day.blocks || []).filter((b) => !OMIT_TYPES.has(b.type));
      stats.omitted += (day.blocks || []).length - blocks.length;

      // ---- ONE lab_day per date (UNIQUE (date, cohort_id)) ----
      // All scenario stations across the day's practical blocks flatten into it;
      // is_adv_cert_testing is day-level (true if ANY block that day is testing).
      const practical = blocks.filter((b) => PRACTICAL_TYPES.has(b.type));
      const stationBlocks = practical.filter((b) => Array.isArray(b.stations) && b.stations.length);
      let labDayId = null;
      if (practical.length) {
        const dayTitle = `ACLS Certification — Day ${day.day}`;
        const isTest = practical.some((b) => !!b.is_adv_cert_testing);
        const starts = practical.map((b) => b.start).sort();
        const ends = practical.map((b) => b.end).sort();
        // Section-aware (Stage 2): this builder emits ONE lab_day per date =
        // section 1. Scope explicitly to section_number=1 so a re-run can't grab
        // a manually-added section 2+, and set it explicitly on insert.
        const ex = (await client.query(
          `SELECT id FROM lab_days WHERE cohort_id=$1 AND date=$2 AND section_number=1`, [cohortId, date]
        )).rows[0];
        if (ex) {
          labDayId = ex.id;
          await client.query(
            `UPDATE lab_days SET title=$1, start_time=$2, end_time=$3, semester=$4, cert_course='acls', is_adv_cert_testing=$5 WHERE id=$6`,
            [dayTitle, starts[0], ends[ends.length - 1], semester, isTest, labDayId]
          );
          stats.labDaysUpd++;
        } else {
          const ins = await client.query(
            `INSERT INTO lab_days (cohort_id, date, title, semester, start_time, end_time, cert_course, is_adv_cert_testing, notes, section_number)
             VALUES ($1,$2,$3,$4,$5,$6,'acls',$7,$8,1) RETURNING id`,
            [cohortId, date, dayTitle, semester, starts[0], ends[ends.length - 1], isTest, `ACLS course Day ${day.day}`]
          );
          labDayId = ins.rows[0].id;
          stats.labDays++;
        }
        plan.push(`LABDAY D${day.day} ${starts[0]}-${ends[ends.length - 1]} ${dayTitle}${isTest ? '  [is_adv_cert_testing]' : ''}`);

        // flatten all scenario stations into the single day
        let num = 0;
        for (const b of stationBlocks) {
          const phase = b.station_label || b.title;
          for (const st of b.stations) {
            num++;
            const scenId = st.scenario_case_code ? scenByCode[st.scenario_case_code] || null : null;
            if (st.scenario_case_code && !scenId && !stats.scenMissing.includes(st.scenario_case_code)) stats.scenMissing.push(st.scenario_case_code);
            const instrId = await resolveInstructorId(client, st.instructor, instrCache);
            if (st.instructor && !instrId && !GENERIC_INSTRUCTORS.has((st.instructor || '').toLowerCase())) stats.instrUnresolved.add(st.instructor);
            const customTitle = st.room ? `${st.room}${st.scenario_case_code ? ' — ' + st.scenario_case_code : ''}` : st.scenario_case_code || null;
            const exs = (await client.query(
              `SELECT id FROM lab_stations WHERE lab_day_id=$1 AND station_number=$2`, [labDayId, num]
            )).rows[0];
            if (exs) {
              await client.query(
                `UPDATE lab_stations SET station_type='scenario', scenario_id=$1, custom_title=$2, instructor_id=$3, instructor_name=$4, room=$5, station_notes=$6 WHERE id=$7`,
                [scenId, customTitle, instrId, st.instructor || null, st.room || null, phase, exs.id]
              );
              stats.stationsUpd++;
            } else {
              await client.query(
                `INSERT INTO lab_stations (lab_day_id, station_number, station_type, scenario_id, custom_title, instructor_id, instructor_name, room, station_notes)
                 VALUES ($1,$2,'scenario',$3,$4,$5,$6,$7,$8)`,
                [labDayId, num, scenId, customTitle, instrId, st.instructor || null, st.room || null, phase]
              );
              stats.stations++;
            }
            plan.push(`  STN  #${num} [${phase}] ${st.room || ''} ${st.scenario_case_code || '(no scenario)'}${scenId ? '' : st.scenario_case_code ? '  ⚠ scenario not found' : ''}`);
          }
        }
      }

      // ---- teaching blocks + no-station practical blocks -> pmi_schedule_blocks ----
      let sortOrder = 0;
      for (const b of (skipBlocks ? [] : blocks)) {
        sortOrder++;
        // Every block gets a calendar block. Practical blocks (incl. the
        // scenario sessions whose stations already live on the lab_day) are
        // 'lab' type and link to the lab_day so the calendar shows the session.
        const blockType = TEACHING_TYPES[b.type] || (PRACTICAL_TYPES.has(b.type) ? 'lab' : 'other');
        if (!semesterId) { plan.push(`SKIP block "${b.title}" (no semester_id for ${date})`); continue; }
        const instrId = await resolveInstructorId(client, b.instructor, instrCache);
        if (b.instructor && !instrId && !GENERIC_INSTRUCTORS.has((b.instructor || '').toLowerCase())) stats.instrUnresolved.add(b.instructor);
        const note = `ACLS Day ${day.day} — ${b.lesson_ref || ''}`.trim();
        // Scope match to THIS cohort's program_schedule so we never touch
        // another cohort's block that happens to share date/time/title.
        const ex = (await client.query(
          `SELECT id FROM pmi_schedule_blocks WHERE date=$1 AND start_time=$2 AND title=$3 AND program_schedule_id IS NOT DISTINCT FROM $4`,
          [date, b.start, b.title, programScheduleId]
        )).rows[0];
        if (ex) {
          await client.query(
            `UPDATE pmi_schedule_blocks SET end_time=$1, block_type=$2, instructor_id=$3, semester_id=$4, day_of_week=$5, sort_order=$6, course_name='ACLS', content_notes=$7, program_schedule_id=COALESCE(program_schedule_id,$8), linked_lab_day_id=COALESCE(linked_lab_day_id,$9), status='published', updated_at=now() WHERE id=$10`,
            [b.end, blockType, instrId, semesterId, dow, sortOrder, note, programScheduleId, PRACTICAL_TYPES.has(b.type) ? labDayId : null, ex.id]
          );
          stats.blocksUpd++;
        } else {
          await client.query(
            `INSERT INTO pmi_schedule_blocks (semester_id, program_schedule_id, start_time, end_time, block_type, title, course_name, content_notes, date, day_of_week, sort_order, instructor_id, linked_lab_day_id, status, is_recurring)
             VALUES ($1,$2,$3,$4,$5,$6,'ACLS',$7,$8,$9,$10,$11,$12,'published',false)`,
            [semesterId, programScheduleId, b.start, b.end, blockType, b.title, note, date, dow, sortOrder, instrId, PRACTICAL_TYPES.has(b.type) ? labDayId : null]
          );
          stats.blocks++;
        }
        plan.push(`BLOCK  D${day.day} ${b.start}-${b.end} [${blockType}] ${b.title}${instrId || !b.instructor || GENERIC_INSTRUCTORS.has((b.instructor||'').toLowerCase()) ? '' : '  (instr unresolved: '+b.instructor+')'}`);
      }
    }

    console.log(`Cohort ${cohort.cohort_number} (${cohortId}) | semester ${semester} | program_schedule ${programScheduleId || 'none'}`);
    console.log(`Dates: Day1=${dayDates[1]} (dow ${dowFromDate(dayDates[1])}), Day2=${dayDates[2]} (dow ${dowFromDate(dayDates[2])})`);
    console.log('--- plan ---');
    for (const p of plan) console.log(p);
    console.log('--- summary ---');
    console.log(`lab_days: ${stats.labDays} new / ${stats.labDaysUpd} updated`);
    console.log(`lab_stations: ${stats.stations} new / ${stats.stationsUpd} updated`);
    console.log(`pmi_schedule_blocks: ${stats.blocks} new / ${stats.blocksUpd} updated`);
    console.log(`omitted (break/lunch): ${stats.omitted}`);
    if (stats.scenMissing.length) console.log(`⚠ scenarios not found for case_codes: ${stats.scenMissing.join(', ')}`);
    if (stats.instrUnresolved.size) console.log(`⚠ instructor names left unlinked (stored as text): ${[...stats.instrUnresolved].join(', ')}`);

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\n🔍 DRY RUN — rolled back, nothing persisted.');
    } else {
      await client.query('COMMIT');
      console.log('\n✅ Committed.');
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
