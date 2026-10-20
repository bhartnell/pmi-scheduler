import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// lab_users.primary_program -> programs.abbreviation
const PROGRAM_ABBREVIATION: Record<string, string> = {
  paramedic: 'PM',
  aemt: 'AEMT',
  emt: 'EMT',
};

// Home -> Grade: every scheduled lab day for the caller's program over the
// next 7 days (plus any day they hold a station or role on), with the station
// list embedded so the widget can offer a Grade button per station.
// Read-only; reuses lab_days / lab_stations / lab_day_roles as-is.
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const todayParam = request.nextUrl.searchParams.get('today');
  const start = todayParam && /^\d{4}-\d{2}-\d{2}$/.test(todayParam)
    ? todayParam
    : new Date().toISOString().slice(0, 10);
  const endDate = new Date(start + 'T12:00:00');
  endDate.setDate(endDate.getDate() + 7);
  const end = endDate.toISOString().slice(0, 10);

  try {
    const supabase = getSupabaseAdmin();

    const { data: me } = await supabase
      .from('lab_users')
      .select('id, primary_program')
      .ilike('email', user.email)
      .maybeSingle();

    const programAbbr = me?.primary_program ? PROGRAM_ABBREVIATION[me.primary_program] : null;

    const { data: labDays, error } = await supabase
      .from('lab_days')
      .select(`
        id, date, title, start_time, section_label,
        cohort:cohorts(id, cohort_number, program:programs(abbreviation)),
        stations:lab_stations(
          id, station_number, custom_title, instructor_name, instructor_email,
          scenario:scenarios(id, title)
        ),
        roles:lab_day_roles(instructor_id)
      `)
      .eq('is_archived', false)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    const myEmail = user.email.toLowerCase();
    const days = (labDays || [])
      .map((ld: any) => {
        const stations = [...(ld.stations || [])]
          .map((s: any) => ({
            id: s.id,
            station_number: s.station_number,
            title: s.custom_title || s.scenario?.title || null,
            instructor_name: s.instructor_name || null,
            is_mine: !!s.instructor_email && s.instructor_email.toLowerCase() === myEmail,
          }))
          .sort((a, b) => Number(b.is_mine) - Number(a.is_mine) || (a.station_number || 0) - (b.station_number || 0));
        const hasRole = !!me?.id && (ld.roles || []).some((r: any) => r.instructor_id === me.id);
        const inProgram = !programAbbr || ld.cohort?.program?.abbreviation === programAbbr;
        return {
          id: ld.id,
          date: ld.date,
          title: ld.title,
          section_label: ld.section_label,
          start_time: ld.start_time,
          cohort_number: ld.cohort?.cohort_number ?? null,
          program: ld.cohort?.program?.abbreviation ?? null,
          stations,
          include: inProgram || hasRole || stations.some(s => s.is_mine),
        };
      })
      .filter(d => d.include)
      .map(({ include: _include, ...d }) => d);

    return NextResponse.json({ success: true, today: start, labDays: days });
  } catch (error) {
    console.error('Error fetching my labs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch labs' }, { status: 500 });
  }
}
