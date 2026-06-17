import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/adv-cert/grading-context
//   (no labDayId)  -> candidate testing days for the picker (adv-cert days first,
//                     then recent lab days as a fallback so a day can always be chosen)
//   (?labDayId=..) -> full context for that day: cohort, groups, and each group's
//                     members (students), for the team-lead / team-member selectors
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const labDayId = request.nextUrl.searchParams.get('labDayId');
  const supabase = getSupabaseAdmin();

  try {
    if (!labDayId) {
      // Candidate days: adv-cert testing days first, then recent days.
      const { data: advDays } = await supabase
        .from('lab_days')
        .select('id, date, cohort_id, is_adv_cert_testing, cert_course, cohort:cohorts(id, cohort_number)')
        .eq('is_adv_cert_testing', true)
        .order('date', { ascending: false })
        .limit(60);

      const { data: recentDays } = await supabase
        .from('lab_days')
        .select('id, date, cohort_id, is_adv_cert_testing, cert_course, cohort:cohorts(id, cohort_number)')
        .order('date', { ascending: false })
        .limit(40);

      const seen = new Set<string>();
      const days = [...(advDays || []), ...(recentDays || [])].filter((d: any) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });
      return NextResponse.json({ success: true, days });
    }

    // Full context for one day.
    const { data: day, error: dErr } = await supabase
      .from('lab_days')
      .select('id, date, cohort_id, is_adv_cert_testing, cert_course, cohort:cohorts(id, cohort_number)')
      .eq('id', labDayId)
      .single();
    if (dErr || !day) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }

    // Stations on the day (each may carry a default drawn scenario_id).
    // instructor_name/room/custom_title/station_notes power the coordinator
    // tracker's "who's teaching / where / what phase" plan-state view.
    const { data: stations } = await supabase
      .from('lab_stations')
      .select('id, station_number, scenario_id, instructor_name, instructor_id, room, custom_title, station_notes')
      .eq('lab_day_id', labDayId)
      .order('station_number', { ascending: true });

    // Groups for the cohort + members.
    const { data: groups } = await supabase
      .from('lab_groups')
      .select('id, name, cohort_id')
      .eq('cohort_id', day.cohort_id)
      .order('name', { ascending: true });

    const groupIds = (groups || []).map((g: any) => g.id);
    let membersByGroup: Record<string, any[]> = {};
    if (groupIds.length) {
      const { data: members } = await supabase
        .from('lab_group_members')
        .select('lab_group_id, student:students!lab_group_members_student_id_fkey(id, first_name, last_name, status)')
        .in('lab_group_id', groupIds);
      for (const m of members || []) {
        const s: any = (m as any).student;
        if (!s) continue;
        (membersByGroup[(m as any).lab_group_id] ??= []).push(s);
      }
    }

    return NextResponse.json({
      success: true,
      day,
      stations: stations || [],
      groups: (groups || []).map((g: any) => ({
        ...g,
        members: (membersByGroup[g.id] || []).sort((a, b) =>
          `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
        ),
      })),
    });
  } catch (error) {
    console.error('Error loading adv-cert grading context:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load grading context' },
      { status: 500 }
    );
  }
}
