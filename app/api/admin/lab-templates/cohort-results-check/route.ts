import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/lab-templates/cohort-results-check
 *
 * Returns whether a cohort has ANY result/sign-off/assessment
 * records attached to its lab_days, so the UI can disable
 * Force Regenerate before the operator does something
 * irreversible.
 *
 * Tables checked (any non-zero count → has_results=true):
 *   - scenario_assessments
 *   - skill_assessments
 *   - student_skill_evaluations
 *   - skill_signoffs
 *   - scenario_participation
 *   - peer_evaluations
 *   - student_lab_ratings
 *   - lab_day_attendance
 *   - lab_day_debrief_notes
 *   - lab_day_debriefs
 *   - lab_day_signups
 *   - student_lab_signups
 *
 * The list mirrors what /apply force=true would destroy
 * (CASCADE delete on lab_day_id from 20260318_lab_days_fk_cascade.sql)
 * plus SET NULL tables (scenario_assessments, student_skill_evaluations)
 * since orphaning those is still a destructive outcome.
 *
 * Body: { cohort_id: string; semester?: number }
 *   - semester optional; when set, narrows the lab_day filter so
 *     the gate doesn't block a Force Regenerate on Semester 2 just
 *     because Semester 1 has completed results.
 *
 * Response: {
 *   has_results: boolean,
 *   counts: { [table_name]: number },  // tables with > 0 rows
 *   lab_day_count: number,             // total lab_days inspected
 * }
 *
 * Permission: admin+ (matches the apply endpoint).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    let body: { cohort_id?: string; semester?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const cohortId = body.cohort_id;
    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch lab_day ids for the cohort (optionally semester).
    //    Empty result → has_results=false trivially.
    let labDayQ = supabase.from('lab_days').select('id').eq('cohort_id', cohortId);
    if (body.semester != null) {
      labDayQ = labDayQ.eq('semester', body.semester);
    }
    const { data: labDays, error: labDaysErr } = await labDayQ;
    if (labDaysErr) {
      return NextResponse.json({ error: labDaysErr.message }, { status: 500 });
    }
    const labDayIds = (labDays ?? []).map(d => d.id);

    if (labDayIds.length === 0) {
      return NextResponse.json({
        has_results: false,
        counts: {},
        lab_day_count: 0,
      });
    }

    // 2. Count rows per table that reference these lab_day ids.
    //    We use .select with head:true + count:'exact' so Supabase
    //    returns just the count, no row payload. Fire them in
    //    parallel — each is independent.
    const tables = [
      'scenario_assessments',
      'skill_assessments',
      'student_skill_evaluations',
      'skill_signoffs',
      'scenario_participation',
      'peer_evaluations',
      'student_lab_ratings',
      'lab_day_attendance',
      'lab_day_debrief_notes',
      'lab_day_debriefs',
      'lab_day_signups',
      'student_lab_signups',
    ] as const;

    const counts: Record<string, number> = {};
    const results = await Promise.allSettled(
      tables.map(async t => {
        const { count, error } = await supabase
          .from(t)
          .select('*', { count: 'exact', head: true })
          .in('lab_day_id', labDayIds);
        if (error) {
          // Table may not exist in this environment or column may
          // differ — treat as 0 and keep going. The check is
          // best-effort: any non-zero we DO find still blocks Force,
          // so silently dropping a missing table can't unblock
          // anything we needed to block.
          console.warn(`[cohort-results-check] ${t} failed:`, error.message);
          return { table: t, count: 0 };
        }
        return { table: t, count: count ?? 0 };
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.count > 0) {
        counts[r.value.table] = r.value.count;
      }
    }

    return NextResponse.json({
      has_results: Object.keys(counts).length > 0,
      counts,
      lab_day_count: labDayIds.length,
    });
  } catch (e) {
    console.error('[cohort-results-check] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
