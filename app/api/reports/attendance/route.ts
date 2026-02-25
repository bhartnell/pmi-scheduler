import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check that requesting user has at least lead_instructor role
    const { data: requestingUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!requestingUser || !hasMinRole(requestingUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
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

    // Fetch active students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name')
      .order('first_name');

    if (studentsError) throw studentsError;

    const studentList = students || [];
    const studentIds = studentList.map((s) => s.id);

    // Fetch lab days for this cohort in the date range
    let labDaysQuery = supabase
      .from('lab_days')
      .select('id, date, title')
      .eq('cohort_id', cohortId)
      .order('date');

    if (startDate) {
      labDaysQuery = labDaysQuery.gte('date', startDate);
    }
    if (endDate) {
      labDaysQuery = labDaysQuery.lte('date', endDate);
    }

    const { data: labDays, error: labDaysError } = await labDaysQuery;
    if (labDaysError) throw labDaysError;

    const labDayList = labDays || [];
    const labDayIds = labDayList.map((d) => d.id);
    const totalLabDays = labDayList.length;

    // Fetch all attendance records for these lab days
    let attendanceRecords: Array<{ lab_day_id: string; student_id: string; status: string }> = [];
    if (labDayIds.length > 0 && studentIds.length > 0) {
      const { data: records, error: attendanceError } = await supabase
        .from('lab_day_attendance')
        .select('lab_day_id, student_id, status')
        .in('lab_day_id', labDayIds)
        .in('student_id', studentIds);

      if (attendanceError) throw attendanceError;
      attendanceRecords = records || [];
    }

    // Build a map: student_id -> Set of lab_day_ids where they were present (present or late)
    const attendedByStudent = new Map<string, Set<string>>();
    const missedByStudent = new Map<string, Set<string>>();

    for (const studentId of studentIds) {
      attendedByStudent.set(studentId, new Set());
      missedByStudent.set(studentId, new Set());
    }

    for (const record of attendanceRecords) {
      const { student_id, lab_day_id, status } = record;
      if (status === 'present' || status === 'late') {
        attendedByStudent.get(student_id)?.add(lab_day_id);
      } else if (status === 'absent' || status === 'excused') {
        missedByStudent.get(student_id)?.add(lab_day_id);
      }
    }

    // Build per-student attendance stats
    const studentRows = studentList.map((student) => {
      const attended = attendedByStudent.get(student.id)?.size ?? 0;
      const missed = totalLabDays - attended;
      const rate = totalLabDays > 0 ? Math.round((attended / totalLabDays) * 100) : 100;

      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        email: student.email,
        attended,
        missed,
        totalLabs: totalLabDays,
        rate,
        belowThreshold: rate < 80,
      };
    });

    // Sort by rate ascending (lowest first)
    studentRows.sort((a, b) => a.rate - b.rate);

    // Summary stats
    const totalStudents = studentRows.length;
    const avgRate =
      totalStudents > 0
        ? Math.round(studentRows.reduce((sum, s) => sum + s.rate, 0) / totalStudents)
        : 0;
    const belowThresholdCount = studentRows.filter((s) => s.belowThreshold).length;

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        name: `${(cohort.program as any)?.abbreviation || 'Unknown'} Group ${cohort.cohort_number}`,
        programAbbreviation: (cohort.program as any)?.abbreviation || 'Unknown',
        cohortNumber: cohort.cohort_number,
      },
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
      summary: {
        totalLabDays,
        totalStudents,
        avgRate,
        belowThresholdCount,
      },
      students: studentRows,
    });
  } catch (error) {
    console.error('Error generating attendance report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
