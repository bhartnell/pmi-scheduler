import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/pals/grading-context
//   (no labDayId)  -> candidate PALS testing days for the picker (cert_course='pals'
//                     testing days first, then recent PALS-tagged days as fallback)
//   (?labDayId=..) -> full context for that day: cohort, stations, groups + members
//                     (with discipline, for the scope/N/A pre-suggest) for the
//                     team-lead / team-member selectors
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const labDayId = request.nextUrl.searchParams.get('labDayId');
  const supabase = getSupabaseAdmin();

  try {
    if (!labDayId) {
      const { data: testingDays } = await supabase
        .from('lab_days')
        .select('id, date, cohort_id, is_adv_cert_testing, cert_course, cohort:cohorts(id, cohort_number)')
        .eq('cert_course', 'pals')
        .eq('is_adv_cert_testing', true)
        .order('date', { ascending: false })
        .limit(60);

      const { data: palsDays } = await supabase
        .from('lab_days')
        .select('id, date, cohort_id, is_adv_cert_testing, cert_course, cohort:cohorts(id, cohort_number)')
        .eq('cert_course', 'pals')
        .order('date', { ascending: false })
        .limit(40);

      const seen = new Set<string>();
      const days = [...(testingDays || []), ...(palsDays || [])].filter((d: any) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });
      return NextResponse.json({ success: true, days });
    }

    const { data: day, error: dErr } = await supabase
      .from('lab_days')
      .select('id, date, cohort_id, is_adv_cert_testing, cert_course, cohort:cohorts(id, cohort_number)')
      .eq('id', labDayId)
      .single();
    if (dErr || !day) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }

    const { data: stations } = await supabase
      .from('lab_stations')
      .select('id, station_number, scenario_id, instructor_name, instructor_id, room, custom_title, station_notes')
      .eq('lab_day_id', labDayId)
      .order('station_number', { ascending: true });

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
        .select('lab_group_id, student:students!lab_group_members_student_id_fkey(id, first_name, last_name, status, discipline)')
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
    console.error('Error loading PALS grading context:', error);
    return NextResponse.json({ success: false, error: 'Failed to load grading context' }, { status: 500 });
  }
}
