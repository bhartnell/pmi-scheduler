import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * GET /api/peer-evaluations/aggregate
 * Returns aggregated peer evaluation scores per student.
 * Requires instructor or higher role.
 *
 * Query params:
 *   ?cohort_id=<uuid>       - filter by cohort
 *   ?lab_day_id=<uuid>      - filter by specific lab day
 *   ?date_from=YYYY-MM-DD   - filter evaluations from this date
 *   ?date_to=YYYY-MM-DD     - filter evaluations up to this date
 *
 * Returns per-student averages for communication, teamwork, and leadership,
 * plus total evaluation count and whether self-evals are included.
 */

async function getCurrentLabUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const labUser = await getCurrentLabUser(session.user.email);
    if (!labUser || !hasMinRole(labUser.role, 'instructor')) {
      return NextResponse.json(
        { success: false, error: 'Instructor access required' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');
    const labDayId = searchParams.get('lab_day_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    // Build peer_evaluations query
    let query = supabase
      .from('peer_evaluations')
      .select(`
        id,
        evaluator_id,
        evaluated_id,
        is_self_eval,
        communication_score,
        teamwork_score,
        leadership_score,
        comments,
        created_at,
        evaluated:students!peer_evaluations_evaluated_id_fkey(
          id,
          first_name,
          last_name,
          cohort_id,
          cohort:cohorts(id, name)
        ),
        lab_day:lab_days!peer_evaluations_lab_day_id_fkey(id, date, title)
      `);

    if (labDayId) {
      query = query.eq('lab_day_id', labDayId);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      // Include the full last day
      query = query.lte('created_at', dateTo + 'T23:59:59Z');
    }

    const { data: rawEvals, error } = await query;
    if (error) throw error;

    const evaluations = rawEvals || [];

    // Filter by cohort after fetch (since cohort is nested in evaluated student)
    const filtered = cohortId
      ? evaluations.filter((e: any) => e.evaluated?.cohort_id === cohortId)
      : evaluations;

    // Aggregate scores per student (exclude self-evals from peer averages)
    const studentMap: Record<string, {
      student: { id: string; first_name: string; last_name: string; cohort_id: string | null; cohort: any };
      peer_evals: { communication: number[]; teamwork: number[]; leadership: number[] };
      self_eval: { communication: number | null; teamwork: number | null; leadership: number | null } | null;
      total_peer_evals: number;
      comments: string[];
    }> = {};

    for (const ev of filtered) {
      const evaluated = ev.evaluated as any;
      if (!evaluated) continue;
      const sid = evaluated.id;

      if (!studentMap[sid]) {
        studentMap[sid] = {
          student: {
            id: evaluated.id,
            first_name: evaluated.first_name,
            last_name: evaluated.last_name,
            cohort_id: evaluated.cohort_id,
            cohort: evaluated.cohort,
          },
          peer_evals: { communication: [], teamwork: [], leadership: [] },
          self_eval: null,
          total_peer_evals: 0,
          comments: [],
        };
      }

      if (ev.is_self_eval) {
        studentMap[sid].self_eval = {
          communication: ev.communication_score,
          teamwork: ev.teamwork_score,
          leadership: ev.leadership_score,
        };
      } else {
        if (ev.communication_score != null) studentMap[sid].peer_evals.communication.push(ev.communication_score);
        if (ev.teamwork_score != null) studentMap[sid].peer_evals.teamwork.push(ev.teamwork_score);
        if (ev.leadership_score != null) studentMap[sid].peer_evals.leadership.push(ev.leadership_score);
        studentMap[sid].total_peer_evals += 1;
        if (ev.comments?.trim()) studentMap[sid].comments.push(ev.comments.trim());
      }
    }

    const avg = (arr: number[]) =>
      arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;

    const aggregated = Object.values(studentMap).map(entry => ({
      student: entry.student,
      total_peer_evals: entry.total_peer_evals,
      averages: {
        communication: avg(entry.peer_evals.communication),
        teamwork: avg(entry.peer_evals.teamwork),
        leadership: avg(entry.peer_evals.leadership),
        overall: avg([
          ...entry.peer_evals.communication,
          ...entry.peer_evals.teamwork,
          ...entry.peer_evals.leadership,
        ]),
      },
      self_eval: entry.self_eval,
      comments: entry.comments,
    }));

    // Sort by overall average descending, then by name
    aggregated.sort((a, b) => {
      const aScore = a.averages.overall ?? 0;
      const bScore = b.averages.overall ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return `${a.student.last_name} ${a.student.first_name}`.localeCompare(
        `${b.student.last_name} ${b.student.first_name}`
      );
    });

    // Fetch cohorts for filter dropdown
    const { data: cohorts } = await supabase
      .from('cohorts')
      .select('id, name')
      .eq('is_archived', false)
      .order('name');

    return NextResponse.json({
      success: true,
      aggregated,
      total_evaluations: filtered.length,
      cohorts: cohorts || [],
    });
  } catch (error) {
    console.error('Error fetching peer evaluation aggregates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch aggregated evaluations' },
      { status: 500 }
    );
  }
}
