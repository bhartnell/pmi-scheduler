import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!cohortId) {
      return NextResponse.json({ success: false, error: 'cohortId is required' }, { status: 400 });
    }

    // Fetch cohort info
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select(`
        id,
        cohort_number,
        program:programs(name, abbreviation)
      `)
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    }

    // Fetch students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name');

    if (studentsError) throw studentsError;

    const studentIds = students?.map(s => s.id) || [];

    // Fetch team lead rotations
    let tlQuery = supabase
      .from('team_lead_log')
      .select(`
        id,
        student_id,
        date,
        scenario:scenarios(title)
      `)
      .in('student_id', studentIds)
      .order('date', { ascending: false });

    if (startDate) {
      tlQuery = tlQuery.gte('date', startDate);
    }
    if (endDate) {
      tlQuery = tlQuery.lte('date', endDate);
    }

    const { data: tlLogs } = await tlQuery;

    // Build student TL map
    const studentTlMap: Record<string, { count: number; lastDate: string | null; rotations: any[] }> = {};
    studentIds.forEach(id => {
      studentTlMap[id] = { count: 0, lastDate: null, rotations: [] };
    });

    tlLogs?.forEach((log: any) => {
      if (studentTlMap[log.student_id]) {
        studentTlMap[log.student_id].count++;
        studentTlMap[log.student_id].rotations.push(log);
        const currentLastDate = studentTlMap[log.student_id].lastDate;
        if (!currentLastDate || log.date > currentLastDate) {
          studentTlMap[log.student_id].lastDate = log.date;
        }
      }
    });

    // Calculate summary stats
    const counts = Object.values(studentTlMap).map(s => s.count);
    const totalRotations = counts.reduce((sum, c) => sum + c, 0);
    const averagePerStudent = studentIds.length > 0 ? totalRotations / studentIds.length : 0;
    const studentsWithZero = counts.filter(c => c === 0).length;
    const mostRotations = counts.length > 0 ? Math.max(...counts) : 0;

    // Build student breakdown
    const studentBreakdown: any[] = [];
    const studentsNeedingRotations: any[] = [];

    (students || []).forEach(student => {
      const tlData = studentTlMap[student.id];
      const needsMore = tlData.count < averagePerStudent;

      // Calculate days since last
      let daysSinceLast: number | null = null;
      if (tlData.lastDate) {
        daysSinceLast = Math.floor((Date.now() - new Date(tlData.lastDate).getTime()) / (1000 * 60 * 60 * 24));
      }

      studentBreakdown.push({
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        rotationCount: tlData.count,
        lastRotationDate: tlData.lastDate,
        needsMore,
      });

      if (needsMore) {
        studentsNeedingRotations.push({
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          count: tlData.count,
          daysSinceLast,
        });
      }
    });

    // Sort by rotation count ascending to prioritize who needs more
    studentBreakdown.sort((a, b) => a.rotationCount - b.rotationCount);
    studentsNeedingRotations.sort((a, b) => a.count - b.count);

    // Build recent rotations with student names
    const studentMap: Record<string, string> = {};
    (students || []).forEach(s => {
      studentMap[s.id] = `${s.first_name} ${s.last_name}`;
    });

    const recentRotations = (tlLogs || []).slice(0, 20).map((log: any) => ({
      date: log.date,
      studentName: studentMap[log.student_id] || 'Unknown',
      scenario: log.scenario?.title || 'Scenario',
    }));

    const report = {
      cohort: {
        id: cohort.id,
        name: `${(cohort.program as any)?.abbreviation || 'Unknown'} Group ${cohort.cohort_number}`,
      },
      dateRange: {
        start: startDate || 'All time',
        end: endDate || 'Present',
      },
      summary: {
        totalRotations,
        averagePerStudent,
        studentsWithZero,
        mostRotations,
        totalStudents: students?.length || 0,
      },
      studentBreakdown,
      recentRotations,
      studentsNeedingRotations,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error generating team leads report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
