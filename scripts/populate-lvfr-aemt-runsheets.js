/*
 * Populate LVFR AEMT day runsheets from the two source-of-truth files
 * that live in data/lvfr-aemt/:
 *   - course_calendar.json       (the 27-day backbone + per-day metadata)
 *   - schedule_build_tracker.md  (the AM/PM time-blocked breakdown)
 *
 * Writes to:
 *   - lvfr_day_schedule   (one row per (date, session) for sessions
 *                          'morning' and 'afternoon')
 *   - lvfr_schedule_items (one row per parsed time block, linked to
 *                          the appropriate day_schedule_id by session)
 *
 * USAGE:
 *   node scripts/populate-lvfr-aemt-runsheets.js
 *     → dry-run (default). Reports counts + first few items per day.
 *   node scripts/populate-lvfr-aemt-runsheets.js --execute
 *     → inserts the rows.
 *
 * IDEMPOTENCY:
 *   The dry-run reports what's already in the DB. On --execute, the
 *   script checks for existing (date, session) rows in the AEMT cohort
 *   and skips them by default. Pass --replace to delete-then-reinsert
 *   for any day already populated. (Items from previously committed
 *   work would be lost; only use --replace if you want to overwrite.)
 *
 * Mapping rules (from the task spec):
 *   item_type:
 *     'lunch' | 'break'                          → 'break'
 *     starts with 'Ch ' / 'lecture' / 'roll call' / 'transition' / 'review'
 *                                                → 'chapter'
 *     'quiz' / 'sub-module exam' / 'final' / 'module exam'
 *                                                → 'exam'   (CHECK allows exam)
 *     'lab' / 'checkoff' / 'skill' / 'practice' / 'stations'
 *                                                → 'skills'
 *     'scenario'                                 → 'lab'
 *     else                                       → 'other'
 *
 *   estimated_minutes: parsed from "(NN min)" trailer, or computed
 *     from the HHMM–HHMM range if no minutes annotation.
 *
 *   sort_order: incremental within (date, session), starting at 0.
 *
 *   title: the activity description, stripped of leading time range.
 *
 *   notes: the original line, preserved for context.
 *
 * STATE CAVEAT:
 *   The existing 96 lvfr_day_schedule rows between 2026-05-21 and
 *   2026-07-07 all have NULL cohort_id and 0 items. This script
 *   creates NEW rows in the 2026-07-14 → 2026-09-10 range with the
 *   AEMT G2 cohort id. It does NOT touch the existing rows.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const m = env.match(/SUPABASE_DB_URL=(.+)/);
const dbUrl = m[1].replace(/^["']|["']$/g, '').trim();

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const REPLACE = args.includes('--replace');

const DATA_DIR = path.join(__dirname, '..', 'data', 'lvfr-aemt');
const CALENDAR_PATH = path.join(DATA_DIR, 'course_calendar.json');
const TRACKER_PATH = path.join(DATA_DIR, 'schedule_build_tracker.md');

const AEMT_COHORT_ID = '6796e139-3add-4bdd-84da-52963ae4eb21';

// ─── Parsing helpers ─────────────────────────────────────────────────

const TIME_RE = /^(\d{2})(\d{2})-(\d{2})(\d{2})\s+/;
const PAREN_MIN_RE = /\((\d+)\s*min\)/i;
const BREAK_ONLY_RE = /^(\d{2})(\d{2})-(\d{2})(\d{2})\s+(BREAK|LUNCH|Transition)\b/i;

function parseDurationMinutes(rangeStart, rangeEnd) {
  const s = parseInt(rangeStart.slice(0, 2)) * 60 + parseInt(rangeStart.slice(2));
  const e = parseInt(rangeEnd.slice(0, 2)) * 60 + parseInt(rangeEnd.slice(2));
  return e >= s ? e - s : null;
}

function classifyItemType(title) {
  const t = title.toLowerCase();
  if (/^break\b|^lunch\b|^transition\b/.test(t)) return 'break';
  if (/scenario/.test(t) && !/stations?/.test(t)) return 'lab';
  if (/\blab\b/.test(t)) return 'lab'; // "Lifting & Moving Lab", "OB Lab"
  if (/checkoff|skill|stations?|practice/.test(t)) return 'skills';
  if (/\bquiz\b|module exam|sub-?module|comprehensive final|★ .*exam/i.test(t)) return 'exam';
  if (/^ch\s*\d+|lecture|review|roll call|announcements|exam prep|preview|day closeout|orientation|setup/.test(t)) return 'chapter';
  return 'other';
}

/**
 * Parse the markdown tracker into per-day AM/PM arrays.
 *
 * The tracker structure (verified against the file):
 *   - Each day starts with: `**Day N — DOW Mmm DD | ...**`
 *   - Followed by a triple-backtick block containing `AM:` then `PM:`
 *     (sometimes `PM — Track A`, `PM — Track B`, `PM — Lab Day ...`)
 *   - Inside each section, lines look like:
 *       0730-0800  Roll Call / Welcome ... (30 min)
 *
 * We capture BOTH track-A and track-B PM items if present; track-B
 * items get `(Track B)` appended to the title and a sort_order that
 * follows track-A so they don't interleave timewise.
 */
function parseTracker(text) {
  const days = [];
  // Split by day headers
  const dayBlocks = text.split(/(?=\*\*Day\s+\d+\s+—\s+)/g);

  for (const block of dayBlocks) {
    const dayHeaderMatch = block.match(/\*\*Day\s+(\d+)\s+—\s+(\w+)\s+(\w+)\s+(\d+)\b/);
    if (!dayHeaderMatch) continue;
    const dayNumber = parseInt(dayHeaderMatch[1]);
    // Extract the schedule code-fence body
    const codeMatch = block.match(/```([\s\S]*?)```/);
    if (!codeMatch) continue;
    const body = codeMatch[1];

    // Split into AM section and PM sections. Track A / Track B / Lab Day
    // sections are all PM variants — we keep Track A as the canonical
    // PM and append Track B items (when distinct) at the end.
    const lines = body.split('\n');
    let section = 'pre'; // 'pre' | 'am' | 'pm-a' | 'pm-b'
    let sawTrackB = false;
    const am = [];
    const pmA = [];
    const pmB = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // Section headers
      if (/^AM:\s*$/i.test(line)) { section = 'am'; continue; }
      if (/^PM\b/i.test(line) && /no cadre|track\s*b|fallback/i.test(line)) {
        section = 'pm-b';
        sawTrackB = true;
        continue;
      }
      if (/^PM\b/i.test(line)) { section = 'pm-a'; continue; }
      if (/^Cadre need:/i.test(line)) { section = 'post'; continue; }
      if (/^★|^Cadre need/i.test(line)) { section = 'post'; continue; }
      if (section === 'pre' || section === 'post') continue;

      // Skip free-text descriptions (continuation lines under a timed item).
      // Real items begin with HHMM-HHMM.
      if (!TIME_RE.test(line) && !/^1530\s+END/.test(line)) continue;
      if (/^1530\s+END/.test(line)) continue; // ignore END marker

      const [, sh, sm, eh, em] = line.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})/);
      const rangeStart = `${sh}${sm}`;
      const rangeEnd = `${eh}${em}`;
      const rest = line.replace(TIME_RE, '').trim();
      const parenMin = rest.match(PAREN_MIN_RE);
      const titleStripped = rest.replace(PAREN_MIN_RE, '').replace(/\s+—\s+.*lead.*$/i, '').trim();
      const minutes = parenMin ? parseInt(parenMin[1]) : parseDurationMinutes(rangeStart, rangeEnd);

      const item = {
        rangeStart,
        rangeEnd,
        title: titleStripped,
        minutes,
        rawLine: line,
      };

      if (section === 'am') am.push(item);
      else if (section === 'pm-a') pmA.push(item);
      else if (section === 'pm-b') pmB.push(item);
    }

    // Build the PM list. If Track A and Track B both exist and differ,
    // keep Track A as the canonical PM and append a single marker
    // "Track B alternative" + the Track B items with notes.
    const pmCombined = [...pmA];
    if (sawTrackB && pmB.length > 0) {
      // Detect whether Track B is just identical text (same first
      // 3 items match) — if so, no need to duplicate.
      const same = pmA.length === pmB.length &&
        pmA.every((a, i) => a.title === pmB[i].title && a.rangeStart === pmB[i].rangeStart);
      if (!same) {
        // Insert a header item then the divergent items.
        pmCombined.push({
          rangeStart: pmB[0].rangeStart,
          rangeEnd: pmB[0].rangeEnd,
          title: '— Track B (no cadre) alternative —',
          minutes: 0,
          rawLine: '(track-B header)',
          isTrackBHeader: true,
        });
        for (const it of pmB) {
          pmCombined.push({ ...it, title: `${it.title} (Track B)` });
        }
      }
    }

    days.push({ dayNumber, am, pm: pmCombined });
  }

  return days;
}

// ─── Main ────────────────────────────────────────────────────────────

(async () => {
  if (!fs.existsSync(CALENDAR_PATH)) throw new Error(`Missing ${CALENDAR_PATH}`);
  if (!fs.existsSync(TRACKER_PATH)) throw new Error(`Missing ${TRACKER_PATH}`);

  const calendar = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf8'));
  const trackerText = fs.readFileSync(TRACKER_PATH, 'utf8');

  console.log(`Course: ${calendar.course.name}`);
  console.log(`Start: ${calendar.course.start_date}  End: ${calendar.course.end_date}`);
  console.log(`Days in JSON: ${calendar.days.length}\n`);

  const trackerDays = parseTracker(trackerText);
  const trackerByNumber = new Map(trackerDays.map(d => [d.dayNumber, d]));
  console.log(`Days parsed from tracker: ${trackerDays.length}`);

  // Join calendar days with tracker schedule.
  const merged = calendar.days.map(d => {
    const t = trackerByNumber.get(d.day_number);
    return { ...d, am: t ? t.am : [], pm: t ? t.pm : [] };
  });

  // Summary BEFORE any writes.
  let totalAm = 0, totalPm = 0;
  let daysWithAny = 0;
  for (const d of merged) {
    totalAm += d.am.length;
    totalPm += d.pm.length;
    if (d.am.length || d.pm.length) daysWithAny++;
  }
  console.log(`\nMerged summary:`);
  console.log(`  Days with parsed items: ${daysWithAny}/${merged.length}`);
  console.log(`  Total AM items: ${totalAm}`);
  console.log(`  Total PM items: ${totalPm}`);
  console.log(`  Total items overall: ${totalAm + totalPm}`);

  // Preview first 3 days fully + any day with 0 parsed items.
  console.log(`\nPreview (first 3 days):`);
  for (const d of merged.slice(0, 3)) {
    console.log(`\n  Day ${d.day_number} · ${d.date} (${d.dow}) — ${d.title}`);
    console.log(`    AM (${d.am.length} items):`);
    d.am.forEach((it, i) => {
      const itype = classifyItemType(it.title);
      console.log(`      ${i}. ${it.rangeStart}-${it.rangeEnd}  [${itype.padEnd(7)}]  ${it.minutes != null ? it.minutes : '?'}min  ${it.title}`);
    });
    console.log(`    PM (${d.pm.length} items):`);
    d.pm.forEach((it, i) => {
      const itype = classifyItemType(it.title);
      console.log(`      ${i}. ${it.rangeStart}-${it.rangeEnd}  [${itype.padEnd(7)}]  ${it.minutes != null ? it.minutes : '?'}min  ${it.title}`);
    });
  }

  const zeroDays = merged.filter(d => d.am.length === 0 && d.pm.length === 0);
  if (zeroDays.length > 0) {
    console.log(`\n⚠️  Days with no parsed items (will create empty runsheet shells):`);
    zeroDays.forEach(d => console.log(`     Day ${d.day_number} · ${d.date}`));
  }

  // Connect.
  const c = new Client({ connectionString: dbUrl });
  await c.connect();

  // Check for existing rows in our target window for the AEMT cohort.
  const existing = (await c.query(
    `SELECT date, session, COUNT(*)::int AS n
     FROM lvfr_day_schedule
     WHERE cohort_id = $1
       AND date >= $2 AND date <= $3
     GROUP BY date, session
     ORDER BY date, session`,
    [AEMT_COHORT_ID, calendar.course.start_date, calendar.course.end_date]
  )).rows;
  if (existing.length > 0) {
    console.log(`\nExisting AEMT cohort rows in target window: ${existing.length}`);
    if (!REPLACE) {
      console.log(`  Will SKIP those (date, session) pairs. Pass --replace to overwrite.`);
    } else {
      console.log(`  --replace passed: those rows + their items will be DELETED before reinsert.`);
    }
    existing.slice(0, 5).forEach(r => console.log(`    ${r.date.toISOString().slice(0,10)} ${r.session}`));
    if (existing.length > 5) console.log(`    ... and ${existing.length - 5} more`);
  } else {
    console.log(`\nNo existing AEMT cohort rows in target window. Clean insert.`);
  }

  // Also probe for orphan rows with NULL cohort_id on the same dates
  // (those 96 pre-existing rows we found earlier — they're outside the
  // 7/14 → 9/10 window but worth confirming).
  const overlap = (await c.query(
    `SELECT COUNT(*)::int AS n FROM lvfr_day_schedule
     WHERE date >= $1 AND date <= $2 AND cohort_id IS NULL`,
    [calendar.course.start_date, calendar.course.end_date]
  )).rows[0].n;
  console.log(`Null-cohort orphan rows in window: ${overlap} (won't be touched)`);

  if (!EXECUTE) {
    console.log(`\n[DRY RUN] No writes. Re-run with --execute to insert.`);
    await c.end();
    return;
  }

  // EXECUTE path.
  console.log(`\n[EXECUTE] Inserting ${daysWithAny} day-schedule pairs...`);
  let insertedDays = 0, insertedItems = 0, skipped = 0;

  for (const d of merged) {
    const date = d.date;
    for (const session of ['morning', 'afternoon']) {
      const items = session === 'morning' ? d.am : d.pm;

      // Skip / replace logic.
      const existingRow = (await c.query(
        `SELECT id FROM lvfr_day_schedule
         WHERE cohort_id = $1 AND date = $2 AND session = $3`,
        [AEMT_COHORT_ID, date, session]
      )).rows[0];

      let dayScheduleId;
      if (existingRow) {
        if (!REPLACE) {
          skipped++;
          continue;
        }
        // --replace: delete items + the row, then re-insert.
        await c.query(`DELETE FROM lvfr_schedule_items WHERE day_schedule_id = $1`, [existingRow.id]);
        await c.query(`DELETE FROM lvfr_day_schedule WHERE id = $1`, [existingRow.id]);
      }

      // Build notes string (per-day metadata into the parent row).
      const dayNotes = [
        `Day ${d.day_number} — ${d.dow}`,
        d.title ? `Title: ${d.title}` : null,
        d.primary_instructor ? `Primary: ${d.primary_instructor}` : null,
        d.instructor_note ? `Note: ${d.instructor_note}` : null,
        d.cadre_needed ? `Cadre: ${d.cadre_needed}` : null,
        d.has_exam ? `★ ${d.exam_name} (${d.exam_questions}q)` : null,
        d.has_lab && d.lab_name ? `Lab: ${d.lab_name}` : null,
      ].filter(Boolean).join(' · ');

      const ins = await c.query(
        `INSERT INTO lvfr_day_schedule (date, cohort_id, session, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [date, AEMT_COHORT_ID, session, dayNotes]
      );
      dayScheduleId = ins.rows[0].id;
      insertedDays++;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itype = classifyItemType(it.title);
        await c.query(
          `INSERT INTO lvfr_schedule_items
             (day_schedule_id, title, item_type, estimated_minutes, sort_order, notes, is_completed)
           VALUES ($1, $2, $3, $4, $5, $6, false)`,
          [dayScheduleId, it.title, itype, it.minutes, i, it.rawLine]
        );
        insertedItems++;
      }
    }
  }

  console.log(`\nInserted ${insertedDays} day-schedule rows and ${insertedItems} items.`);
  console.log(`Skipped ${skipped} (date, session) pairs that already existed.`);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
