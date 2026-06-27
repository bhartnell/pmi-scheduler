import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');
  const studentId = searchParams.get('studentId');

  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // If requesting for a specific student, return their TL history
    if (studentId) {
      const { data, error } = await supabase
        .from('team_lead_log')
        .select(`
          *,
          lab_day:lab_days(date, week_number, day_number),
          lab_station:lab_stations(station_number, station_type),
          scenario:scenarios(title, category)
        `)
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ success: true, history: data });
    }

    // Otherwise, return stats for all students in cohort
    let studentsQuery = supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('status', 'active');

    if (cohortId) {
      studentsQuery = studentsQuery.eq('cohort_id', cohortId);
    }

    const { data: students, error: studentsError } = await studentsQuery;
    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, stats: [], averageTL: 0, needingTL: [] });
    }

    // Get TL counts
    const studentIds = students.map(s => s.id);
    const { data: tlLogs } = await supabase
      .from('team_lead_log')
      .select('student_id, date')
      .in('student_id', studentIds);

    // Calculate stats
    const countMap: Record<string, { count: number; lastDate: string | null }> = {};
    studentIds.forEach(id => {
      countMap[id] = { count: 0, lastDate: null };
    });

    if (tlLogs) {
      tlLogs.forEach((log) => {
        countMap[log.student_id].count++;
        const currentLastDate = countMap[log.student_id].lastDate;
        if (!currentLastDate || log.date > currentLastDate) {
          countMap[log.student_id].lastDate = log.date;
        }
      });
    }

    const stats = students.map(s => ({
      ...s,
      team_lead_count: countMap[s.id].count,
      last_team_lead_date: countMap[s.id].lastDate,
    }));

    const totalTL = stats.reduce((sum, s) => sum + s.team_lead_count, 0);
    const averageTL = students.length > 0 ? totalTL / students.length : 0;

    const needingTL = stats
      .filter(s => s.team_lead_count < averageTL)
      .sort((a, b) => a.team_lead_count - b.team_lead_count);

    return NextResponse.json({ 
      success: true, 
      stats,
      averageTL: Math.round(averageTL * 10) / 10,
      needingTL
    });
  } catch (error) {
    console.error('Error fetching team lead data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch team lead data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user, session } = auth;

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // student_id, lab_day_id, and date are NOT NULL on team_lead_log. Validate
    // up front and return a readable 400 instead of letting a missing value hit
    // the DB as a 23502 crash (production saw lab_day_id-null from a caller that
    // omitted it).
    if (!body.student_id) {
      return NextResponse.json({ success: false, error: 'student_id is required' }, { status: 400 });
    }
    if (!body.lab_day_id) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }
    if (!body.date) {
      return NextResponse.json({ success: false, error: 'date is required' }, { status: 400 });
    }

    // cohort_id is NOT NULL on team_lead_log (FK -> cohorts). Use the value from
    // the body if provided, else derive it from the student's cohort. Missing it
    // was causing 23502 not-null violations in production.
    let cohortId: string | null = body.cohort_id ?? null;
    if (!cohortId && body.student_id) {
      const { data: stu } = await supabase
        .from('students')
        .select('cohort_id')
        .eq('id', body.student_id)
        .single();
      cohortId = stu?.cohort_id ?? null;
    }
    if (!cohortId) {
      return NextResponse.json(
        { success: false, error: 'cohort_id is required (student has no cohort assigned)' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('team_lead_log')
      .insert({
        student_id: body.student_id,
        cohort_id: cohortId,
        lab_day_id: body.lab_day_id,
        lab_station_id: body.lab_station_id || null,
        scenario_id: body.scenario_id || null,
        date: body.date,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, log: data });
  } catch (error) {
    console.error('Error creating team lead log:', error);
    return NextResponse.json({ success: false, error: 'Failed to create team lead log' }, { status: 500 });
  }
}
