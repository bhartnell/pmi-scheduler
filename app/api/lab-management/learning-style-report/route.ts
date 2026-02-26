import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * GET /api/lab-management/learning-style-report
 *
 * Query params (one required):
 *   ?lab_day_id=<uuid>   — return distribution for a specific lab day's cohort
 *   ?cohort_id=<uuid>    — return distribution for an entire cohort
 *
 * Returns:
 *   totals          – count of each primary_style across all students
 *   byStation       – (only when lab_day_id provided) per-station breakdown
 *   diversityScore  – 0-1; 1 = perfectly mixed, 0 = all same style
 *   assessedCount   – students with a learning style record
 *   totalStudents   – all active students in the cohort
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Auth: instructor or above can view learning style data
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const labDayId = searchParams.get('lab_day_id');
  const cohortId = searchParams.get('cohort_id');

  if (!labDayId && !cohortId) {
    return NextResponse.json(
      { error: 'lab_day_id or cohort_id is required' },
      { status: 400 }
    );
  }

  try {
    // Resolve cohort from lab_day if lab_day_id was supplied
    let resolvedCohortId = cohortId;
    let stations: { id: string; station_number: number; custom_title: string | null; scenario_title: string | null }[] = [];

    if (labDayId) {
      const { data: labDay, error: labDayErr } = await supabase
        .from('lab_days')
        .select(`
          cohort_id,
          stations:lab_stations(
            id,
            station_number,
            custom_title,
            scenario:scenarios(title)
          )
        `)
        .eq('id', labDayId)
        .single();

      if (labDayErr || !labDay) {
        return NextResponse.json({ error: 'Lab day not found' }, { status: 404 });
      }

      resolvedCohortId = labDay.cohort_id;
      stations = (labDay.stations || []).map((s: any) => ({
        id: s.id,
        station_number: s.station_number,
        custom_title: s.custom_title,
        scenario_title: s.scenario?.title || null,
      }));
      stations.sort((a, b) => a.station_number - b.station_number);
    }

    if (!resolvedCohortId) {
      return NextResponse.json({ error: 'Could not resolve cohort' }, { status: 400 });
    }

    // Fetch all active students in the cohort
    const { data: allStudents, error: studentsErr } = await supabase
      .from('students')
      .select('id')
      .eq('cohort_id', resolvedCohortId)
      .eq('status', 'active');

    if (studentsErr) throw studentsErr;

    const totalStudents = (allStudents || []).length;
    const studentIds = (allStudents || []).map((s: any) => s.id);

    // Fetch learning styles for these students
    const { data: learningStyles, error: lsErr } = await supabase
      .from('student_learning_styles')
      .select('student_id, primary_style, social_style')
      .in('student_id', studentIds);

    if (lsErr) throw lsErr;

    const styleMap = new Map<string, { primary_style: string; social_style: string }>();
    for (const ls of learningStyles || []) {
      styleMap.set(ls.student_id, ls);
    }

    // Calculate overall totals
    const totals: Record<string, number> = {
      audio: 0,
      visual: 0,
      kinesthetic: 0,
      unknown: 0,
    };

    for (const studentId of studentIds) {
      const ls = styleMap.get(studentId);
      if (!ls) {
        totals.unknown++;
      } else {
        const style = ls.primary_style?.toLowerCase() || 'unknown';
        totals[style] = (totals[style] || 0) + 1;
      }
    }

    const assessedCount = (learningStyles || []).length;

    // Diversity score = 1 - sum(p_i^2) where p_i = proportion of style i
    // (Simpson's diversity index; 1 = maximally diverse)
    const knownCount = assessedCount;
    let diversityScore = 0;
    if (knownCount > 1) {
      const styleKeys = Object.keys(totals).filter(k => k !== 'unknown');
      const sumSquares = styleKeys.reduce((acc, k) => {
        const p = totals[k] / knownCount;
        return acc + p * p;
      }, 0);
      diversityScore = Math.round((1 - sumSquares) * 100) / 100;
    }

    // Per-station breakdown (only when lab_day_id is available)
    let byStation: Array<{
      station_id: string;
      station_number: number;
      label: string;
      counts: Record<string, number>;
      diversityScore: number;
      isDiverse: boolean;
    }> = [];

    if (labDayId && stations.length > 0) {
      // Fetch scenario participation (team assignments) for this lab day
      const { data: participation } = await supabase
        .from('team_lead_log')
        .select('student_id, station_id')
        .eq('lab_day_id', labDayId);

      // Build a map of station_id -> student_ids
      const stationStudentMap = new Map<string, string[]>();
      for (const p of participation || []) {
        if (!p.station_id) continue;
        if (!stationStudentMap.has(p.station_id)) {
          stationStudentMap.set(p.station_id, []);
        }
        stationStudentMap.get(p.station_id)!.push(p.student_id);
      }

      byStation = stations.map((station) => {
        const sStudents = stationStudentMap.get(station.id) || [];
        const counts: Record<string, number> = {
          audio: 0,
          visual: 0,
          kinesthetic: 0,
          unknown: 0,
        };

        for (const sid of sStudents) {
          const ls = styleMap.get(sid);
          if (!ls) {
            counts.unknown++;
          } else {
            const style = ls.primary_style?.toLowerCase() || 'unknown';
            counts[style] = (counts[style] || 0) + 1;
          }
        }

        const sKnown = sStudents.length - counts.unknown;
        let sDiversity = 0;
        if (sKnown > 1) {
          const styleKeys = Object.keys(counts).filter(k => k !== 'unknown');
          const sumSq = styleKeys.reduce((acc, k) => {
            const p = counts[k] / sKnown;
            return acc + p * p;
          }, 0);
          sDiversity = Math.round((1 - sumSq) * 100) / 100;
        }

        // "Diverse" if at least 2 different styles are represented
        const represented = Object.entries(counts)
          .filter(([k, v]) => k !== 'unknown' && v > 0).length;
        const isDiverse = represented >= 2;

        return {
          station_id: station.id,
          station_number: station.station_number,
          label: station.custom_title || station.scenario_title || `Station ${station.station_number}`,
          counts,
          diversityScore: sDiversity,
          isDiverse,
        };
      });
    }

    return NextResponse.json({
      success: true,
      cohortId: resolvedCohortId,
      totalStudents,
      assessedCount,
      totals,
      diversityScore,
      byStation,
    });
  } catch (error) {
    console.error('Error in learning-style-report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
