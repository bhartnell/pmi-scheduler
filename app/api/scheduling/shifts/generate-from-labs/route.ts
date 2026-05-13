import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/scheduling/shifts/generate-from-labs
 *
 * Bulk-creates open_shifts rows for every lab_day in a date range
 * (optionally scoped to one cohort). Each shift is linked to the
 * lab_day via open_shifts.lab_day_id so the existing shift-signup
 * flow (open_shifts ← shift_signups) just works for part-timers.
 *
 * Idempotent: lab_days that already have an open_shifts row (joined
 * by lab_day_id) are skipped, not duplicated. Re-running after
 * adding new lab days fills in the gaps without re-creating
 * existing shifts.
 *
 * Body:
 *   {
 *     cohort_id?: string | 'all',
 *     start_date: 'YYYY-MM-DD',
 *     end_date:   'YYYY-MM-DD',
 *     min_instructors?: number,   // default 1
 *     max_instructors?: number,   // default 2
 *     title_prefix?:    string,   // default 'Lab Coverage'
 *     dry_run?: boolean,          // preview without writing
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     preview: [{ lab_day_id, date, title, start_time, end_time, would_skip }],
 *     created: N,   // 0 in dry-run
 *     skipped: M,   // lab days that already had shifts
 *   }
 */

interface CohortInfo {
  cohort_number?: number | null;
  program?: { abbreviation?: string | null } | null;
}

interface LabDayRow {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  cohort_id: string | null;
  coverage_needed: number | null;
  cohort?: CohortInfo | CohortInfo[] | null;
}

function cohortLabel(c: CohortInfo | null | undefined): string {
  if (!c) return 'Cohort';
  const abbr = c.program?.abbreviation ?? '';
  const num = c.cohort_number != null ? String(c.cohort_number) : '?';
  return `${abbr} G${num}`.trim();
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth('lead_instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: {
    cohort_id?: string;
    start_date?: string;
    end_date?: string;
    min_instructors?: number;
    max_instructors?: number;
    title_prefix?: string;
    dry_run?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid body' }, { status: 400 });
  }

  if (!body.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) {
    return NextResponse.json({ success: false, error: 'start_date required (YYYY-MM-DD)' }, { status: 400 });
  }
  if (!body.end_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.end_date)) {
    return NextResponse.json({ success: false, error: 'end_date required (YYYY-MM-DD)' }, { status: 400 });
  }
  if (body.end_date < body.start_date) {
    return NextResponse.json({ success: false, error: 'end_date must be on/after start_date' }, { status: 400 });
  }

  // Bounds-check the slot counts. The default cap of 4 is well above
  // the typical 1-2 the coordinator UI nudges them toward, while
  // still preventing a fat-fingered "999" from creating a chunk of
  // garbage. Floor at min=1 so we never accidentally create a
  // zero-slot shift (which would render as "filled" immediately and
  // be useless).
  const minInstructors = Math.max(1, Math.min(4, body.min_instructors ?? 1));
  const maxInstructors = Math.max(
    minInstructors,
    Math.min(4, body.max_instructors ?? Math.max(minInstructors, 2)),
  );
  const titlePrefix = (body.title_prefix?.trim() || 'Lab Coverage');
  const dryRun = body.dry_run === true;

  const supabase = getSupabaseAdmin();

  // 1) Pull the lab_days in the window, optionally scoped to a cohort.
  let labQuery = supabase
    .from('lab_days')
    .select(`
      id,
      date,
      start_time,
      end_time,
      title,
      cohort_id,
      coverage_needed,
      cohort:cohorts(cohort_number, program:programs(abbreviation))
    `)
    .gte('date', body.start_date)
    .lte('date', body.end_date)
    .order('date');
  if (body.cohort_id && body.cohort_id !== 'all') {
    labQuery = labQuery.eq('cohort_id', body.cohort_id);
  }
  const { data: labDays, error: labErr } = await labQuery;
  if (labErr) {
    return NextResponse.json({ success: false, error: labErr.message }, { status: 500 });
  }
  if (!labDays || labDays.length === 0) {
    return NextResponse.json({
      success: true,
      preview: [],
      created: 0,
      skipped: 0,
      message: 'No lab days found in this date range.',
    });
  }

  // 2) Find which lab_days already have an open_shifts row so we can
  //    skip them. Querying lab_day_id IN (...) is the single-roundtrip
  //    version of "for each, check existence".
  const labDayIds = (labDays as LabDayRow[]).map(l => l.id);
  const { data: existingShifts } = await supabase
    .from('open_shifts')
    .select('lab_day_id')
    .in('lab_day_id', labDayIds)
    .eq('is_cancelled', false);
  const alreadyHasShift = new Set(
    (existingShifts ?? []).map(s => s.lab_day_id).filter(Boolean) as string[],
  );

  // 3) Build the preview / insert list. We skip lab_days that already
  //    have a (non-cancelled) shift, and lab_days that lack a
  //    start_time or end_time — without those, the open_shifts row
  //    would render with bogus default times. Surface that as a
  //    skip reason rather than silently creating a broken record.
  type Preview = {
    lab_day_id: string;
    date: string;
    title: string;
    start_time: string;
    end_time: string;
    would_skip?: 'already_has_shift' | 'missing_times';
  };
  const preview: Preview[] = [];
  const toInsert: Array<{
    title: string;
    description: string | null;
    date: string;
    start_time: string;
    end_time: string;
    lab_day_id: string;
    min_instructors: number;
    max_instructors: number;
    department: string;
    created_by: string | null;
  }> = [];

  for (const ld of labDays as LabDayRow[]) {
    const cohort = Array.isArray(ld.cohort) ? ld.cohort[0] : ld.cohort;
    const label = cohortLabel(cohort);
    const baseTitle = `${titlePrefix} — ${label}${ld.title ? ` · ${ld.title}` : ''}`.trim();

    if (!ld.start_time || !ld.end_time) {
      preview.push({
        lab_day_id: ld.id,
        date: ld.date,
        title: baseTitle,
        start_time: ld.start_time ?? '',
        end_time: ld.end_time ?? '',
        would_skip: 'missing_times',
      });
      continue;
    }
    if (alreadyHasShift.has(ld.id)) {
      preview.push({
        lab_day_id: ld.id,
        date: ld.date,
        title: baseTitle,
        start_time: ld.start_time,
        end_time: ld.end_time,
        would_skip: 'already_has_shift',
      });
      continue;
    }
    // If the lab_day declares a coverage_needed count, honor it as a
    // floor for min_instructors so the coordinator doesn't have to
    // remember which lab needs N people. Cap at the user's chosen
    // max so the slider stays meaningful.
    const minForRow = Math.min(maxInstructors, Math.max(minInstructors, ld.coverage_needed ?? minInstructors));
    preview.push({
      lab_day_id: ld.id,
      date: ld.date,
      title: baseTitle,
      start_time: ld.start_time,
      end_time: ld.end_time,
    });
    toInsert.push({
      title: baseTitle,
      description: null,
      date: ld.date,
      start_time: ld.start_time,
      end_time: ld.end_time,
      lab_day_id: ld.id,
      min_instructors: minForRow,
      max_instructors: maxInstructors,
      department: 'lab',
      created_by: user.id,
    });
  }

  const skipped = preview.filter(p => p.would_skip).length;

  if (dryRun) {
    return NextResponse.json({
      success: true,
      preview,
      created: 0,
      skipped,
    });
  }

  // 4) Bulk insert. open_shifts has no global unique constraint that
  //    can fire here (lab_day_id is nullable + non-unique), so a
  //    plain insert works.
  let created = 0;
  if (toInsert.length > 0) {
    const { error: insErr, count } = await supabase
      .from('open_shifts')
      .insert(toInsert, { count: 'exact' });
    if (insErr) {
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
    }
    created = count ?? toInsert.length;
  }

  return NextResponse.json({
    success: true,
    preview,
    created,
    skipped,
  });
}
