import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/lvfr-aemt/runsheet/[date]/seed
 *
 * Option C from the LVFR revamp spec: convert existing
 * pmi_schedule_blocks for the LVFR cohort on this date into runsheet
 * items. Buckets by start time: <12:00 → morning, ≥12:00 → afternoon.
 *
 * Idempotent — every item inserted carries source_block_id, and we
 * skip any block whose id already has a matching item under either
 * session header. Safe to re-run after the master calendar gains a
 * new block.
 *
 * Returns { success, inserted, skipped }.
 */

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00'));
}

// Heuristic mapping from a block's title to a runsheet item_type.
// Falls back to 'other' when nothing matches. This is presentation-
// only (drives the icon on the runsheet) so a generic catch-all is
// fine for blocks that don't pattern-match.
function guessItemType(title: string | null): string {
  if (!title) return 'other';
  const t = title.toLowerCase();
  if (/\bquiz\b/.test(t)) return 'quiz';
  if (/\bexam|midterm|final|test\b/.test(t)) return 'exam';
  if (/\bchapter\b|\bch\.?\s*\d/.test(t)) return 'chapter';
  if (/\blab\b|\bskill/.test(t)) return 'lab';
  if (/\bbreak\b|\blunch\b/.test(t)) return 'break';
  return 'other';
}

// H2 — checkbox fatigue. Only MAJOR academic tasks get a checkbox
// (requirement 'required'); breaks/lunch and generic transition blocks are
// info-only (no checkbox). PROPOSED CUT (flag for Ben): 'other' is treated as
// info — flip it to 'required' if generic blocks should be tracked.
function requirementForType(itemType: string): 'required' | 'info' {
  if (itemType === 'break' || itemType === 'other') return 'info';
  return 'required';
}

// H4 — schedule. Block times → "HHMM-HHMM" label the runsheet renders as
// "7:30–8:48", giving each item its slot so the day reads as a timeline.
function timeLabelFor(start: string, end: string): string | null {
  const p = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    return m ? `${m[1].padStart(2, '0')}${m[2]}` : null;
  };
  const a = p(start);
  const b = p(end);
  return a && b ? `${a}-${b}` : null;
}

function minutesBetween(start: string, end: string): number | null {
  // start/end come from a Postgres `time` column → 'HH:MM:SS'
  const parse = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };
  const a = parse(start);
  const b = parse(end);
  if (a == null || b == null) return null;
  return Math.max(0, b - a);
}

function sessionForStart(startTime: string): 'morning' | 'afternoon' {
  const m = /^(\d{1,2}):/.exec(startTime);
  const h = m ? parseInt(m[1], 10) : 0;
  return h < 12 ? 'morning' : 'afternoon';
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { date } = await params;
  if (!isValidDate(date)) {
    return NextResponse.json({ success: false, error: 'invalid date' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Step 1: find the active LVFR cohort. There should be exactly one
  // active LVFR cohort at any time; if multiple we take the most
  // recent by start_date so manual cohort archival errors don't
  // wedge the seed flow.
  const { data: lvfrProgram, error: progErr } = await supabase
    .from('programs')
    .select('id')
    .eq('abbreviation', 'LVFR')
    .single();
  if (progErr || !lvfrProgram) {
    return NextResponse.json(
      { success: false, error: 'LVFR program not configured' },
      { status: 412 },
    );
  }

  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, start_date')
    .eq('program_id', lvfrProgram.id)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1);
  const cohortId = cohorts?.[0]?.id;

  // Step 2: pull master-calendar blocks for this date that belong to
  // an LVFR program_schedule. specific_date is the exception-style
  // date stamp on a block; we filter on it.
  // (The block creator stamps `specific_date` for one-off blocks and
  // `date` for the materialized recurrence — we honor either.)
  const { data: blocks, error: blocksErr } = await supabase
    .from('pmi_schedule_blocks')
    .select(`
      id,
      start_time,
      end_time,
      title,
      course_name,
      block_type,
      specific_date,
      date,
      program_schedule:pmi_program_schedules!inner(
        cohort_id,
        cohort:cohorts!inner(
          program_id
        )
      )
    `)
    .or(`date.eq.${date},specific_date.eq.${date}`)
    .eq('program_schedule.cohort.program_id', lvfrProgram.id);

  if (blocksErr) {
    return NextResponse.json({ success: false, error: blocksErr.message }, { status: 500 });
  }
  const lvfrBlocks = (blocks ?? []) as Array<{
    id: string;
    start_time: string;
    end_time: string;
    title: string | null;
    course_name: string | null;
    block_type: string | null;
  }>;

  // Step 3: ensure both session headers exist + grab their ids. The
  // GET endpoint also auto-creates these but we can't rely on the
  // caller having hit it first, so make seeding self-sufficient.
  const headerRows = [
    { date, session: 'morning' as const, cohort_id: cohortId ?? null },
    { date, session: 'afternoon' as const, cohort_id: cohortId ?? null },
  ];
  await supabase
    .from('lvfr_day_schedule')
    .upsert(headerRows, { onConflict: 'date,session', ignoreDuplicates: true });
  // Patch cohort_id if it was previously null (e.g. created by GET
  // before the cohort lookup ran). Best-effort.
  if (cohortId) {
    await supabase
      .from('lvfr_day_schedule')
      .update({ cohort_id: cohortId })
      .eq('date', date)
      .is('cohort_id', null);
  }

  const { data: sessions } = await supabase
    .from('lvfr_day_schedule')
    .select('id, session')
    .eq('date', date);
  const idBySession: Record<string, string> = {};
  for (const s of sessions ?? []) idBySession[s.session] = s.id;

  // Step 4: figure out which blocks are already seeded so we skip them.
  const sessionIds = Object.values(idBySession);
  const { data: existing } = sessionIds.length
    ? await supabase
        .from('lvfr_schedule_items')
        .select('source_block_id')
        .in('day_schedule_id', sessionIds)
        .not('source_block_id', 'is', null)
    : { data: [] as Array<{ source_block_id: string | null }> };
  const seededBlockIds = new Set((existing ?? []).map(e => e.source_block_id).filter(Boolean) as string[]);

  // Backfill: items seeded BEFORE the H2 change defaulted to requirement
  // 'required' (the column default) — so breaks/lunch and generic transition
  // blocks wrongly showed a checkbox. Downgrade those SEEDED block items
  // (source_block_id set) to info-only so "Re-seed from calendar" also
  // de-clutters already-seeded days. Manual ad-hoc adds (source_block_id null)
  // are left alone — an instructor added those on purpose and wants the
  // checkbox. Academic items (chapter/quiz/exam/lab/skills) are untouched.
  if (sessionIds.length) {
    await supabase
      .from('lvfr_schedule_items')
      .update({ requirement: 'info' })
      .in('day_schedule_id', sessionIds)
      .in('item_type', ['break', 'other'])
      .not('source_block_id', 'is', null)
      .neq('requirement', 'info');
  }

  // Step 5: build the new rows and insert.
  const rows: Array<{
    day_schedule_id: string;
    title: string;
    item_type: string;
    requirement: 'required' | 'info';
    time_label: string | null;
    estimated_minutes: number | null;
    sort_order: number;
    source_block_id: string;
  }> = [];

  for (const b of lvfrBlocks) {
    if (seededBlockIds.has(b.id)) continue;
    const session = sessionForStart(b.start_time);
    const dayScheduleId = idBySession[session];
    if (!dayScheduleId) continue;
    // sort_order = start minute, gives stable chronological ordering
    const startMin = (() => {
      const m = /^(\d{1,2}):(\d{2})/.exec(b.start_time);
      return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
    })();
    const itemType = guessItemType(b.title || b.course_name);
    rows.push({
      day_schedule_id: dayScheduleId,
      title: b.title?.trim() || b.course_name?.trim() || 'Untitled block',
      item_type: itemType,
      requirement: requirementForType(itemType),
      time_label: timeLabelFor(b.start_time, b.end_time),
      estimated_minutes: minutesBetween(b.start_time, b.end_time),
      sort_order: startMin,
      source_block_id: b.id,
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { error: insErr, count } = await supabase
      .from('lvfr_schedule_items')
      .insert(rows, { count: 'exact' });
    if (insErr) {
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
    }
    inserted = count ?? rows.length;
  }

  return NextResponse.json({
    success: true,
    inserted,
    skipped: lvfrBlocks.length - inserted,
    total_blocks: lvfrBlocks.length,
  });
}
