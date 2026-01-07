// app/api/lab-management/team-leads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const studentId = searchParams.get('studentId');

    // Get team lead counts for the cohort
    if (cohortId) {
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, photo_url')
        .eq('cohort_id', cohortId)
        .eq('status', 'active')
        .order('last_name')
        .order('first_name');

      if (studentsError) throw studentsError;

      // Get counts from the view
      const { data: counts, error: countsError } = await supabase
        .from('team_lead_counts')
        .select('*')
        .eq('cohort_id', cohortId);

      if (countsError) throw countsError;

      const countMap = new Map(counts?.map(c => [c.student_id, c]) || []);

      // Merge data
      const studentsWithCounts = students.map(student => ({
        ...student,
        team_lead_count: countMap.get(student.id)?.team_lead_count || 0,
        last_team_lead_date: countMap.get(student.id)?.last_team_lead_date || null,
      }));

      // Calculate statistics
      const totalLeads = studentsWithCounts.reduce((sum, s) => sum + s.team_lead_count, 0);
      const avgLeads = students.length > 0 ? totalLeads / students.length : 0;
      const countsArray = studentsWithCounts.map(s => s.team_lead_count);
      const minLeads = countsArray.length > 0 ? Math.min(...countsArray) : 0;
      const maxLeads = countsArray.length > 0 ? Math.max(...countsArray) : 0;

      // Flag students who need more TL opportunities (below average)
      const studentsNeedingTL = studentsWithCounts.filter(s => s.team_lead_count < avgLeads);

      return NextResponse.json({
        success: true,
        students: studentsWithCounts,
        stats: {
          totalLeads,
          avgLeads: Math.round(avgLeads * 10) / 10,
          minLeads,
          maxLeads,
          studentsCount: students.length,
          studentsNeedingTL: studentsNeedingTL.length,
        },
        needingTL: studentsNeedingTL,
      });
    }

    // Get history for a specific student
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

    return NextResponse.json(
      { success: false, error: 'cohortId or studentId is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching team lead data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch team lead data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      student_id,
      cohort_id,
      lab_day_id,
      lab_station_id,
      scenario_id,
      date,
      notes,
    } = body;

    if (!student_id || !cohort_id || !lab_day_id || !lab_station_id || !date) {
      return NextResponse.json(
        { success: false, error: 'student_id, cohort_id, lab_day_id, lab_station_id, and date are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('team_lead_log')
      .insert({
        student_id,
        cohort_id,
        lab_day_id,
        lab_station_id,
        scenario_id: scenario_id || null,
        date,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('Error logging team lead:', error);
    return NextResponse.json({ success: false, error: 'Failed to log team lead' }, { status: 500 });
  }
}
