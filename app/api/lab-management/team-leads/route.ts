import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohortId');
  const studentId = searchParams.get('studentId');

  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
      tlLogs.forEach((log: any) => {
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

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    const { data, error } = await supabase
      .from('team_lead_log')
      .insert({
        student_id: body.student_id,
        lab_day_id: body.lab_day_id,
        lab_station_id: body.lab_station_id || null,
        scenario_id: body.scenario_id || null,
        date: body.date,
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
