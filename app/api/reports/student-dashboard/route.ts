import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohort_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // 1. Fetch students (optionally filtered by cohort)
    let studentsQuery = supabase
      .from('students')
      .select('id, first_name, last_name, status, cohort_id, cohort:cohorts!students_cohort_id_fkey(cohort_number, program:programs(abbreviation))')
      .eq('status', 'active')
      .order('last_name')
      .order('first_name');

    if (cohortId) {
      studentsQuery = studentsQuery.eq('cohort_id', cohortId);
    }

    const { data: students } = await studentsQuery;
    const studentList = students || [];
    const studentIds = studentList.map((s) => s.id);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        students: [],
        summary: {
          total_students: 0,
          avg_attendance: 0,
          avg_skill_completion: 0,
          at_risk_count: 0,
        },
      });
    }

    // 2. Fetch lab days for this cohort (or all) in date range
    let labDaysQuery = supabase.from('lab_days').select('id, date');
    if (cohortId) labDaysQuery = labDaysQuery.eq('cohort_id', cohortId);
    if (startDate) labDaysQuery = labDaysQuery.gte('date', startDate);
    if (endDate) labDaysQuery = labDaysQuery.lte('date', endDate);

    const { data: labDays } = await labDaysQuery;
    const labDayIds = (labDays || []).map((d) => d.id);
    const totalLabDays = labDayIds.length;

    // 3. Fetch attendance records
    let attendanceRecords: any[] = [];
    if (labDayIds.length > 0) {
      // Supabase .in() has a limit, so batch if needed
      const batchSize = 100;
      for (let i = 0; i < labDayIds.length; i += batchSize) {
        const batch = labDayIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('lab_day_attendance')
          .select('student_id, status')
          .in('lab_day_id', batch);
        if (data) attendanceRecords.push(...data);
      }
    }

    // Build attendance map: student_id -> { present, late, absent, excused }
    const attendanceMap: Record<string, { present: number; late: number; absent: number; excused: number }> = {};
    attendanceRecords.forEach((r) => {
      if (!attendanceMap[r.student_id]) {
        attendanceMap[r.student_id] = { present: 0, late: 0, absent: 0, excused: 0 };
      }
      const status = r.status as 'present' | 'late' | 'absent' | 'excused';
      if (attendanceMap[r.student_id][status] !== undefined) {
        attendanceMap[r.student_id][status]++;
      }
    });

    // 4. Fetch skill signoffs
    const { data: skills } = await supabase.from('skills').select('id', { count: 'exact' });
    const totalSkills = skills?.length || 0;

    const { data: signoffs } = await supabase
      .from('skill_signoffs')
      .select('student_id, skill_id')
      .in('student_id', studentIds)
      .is('revoked_at', null);

    const signoffMap: Record<string, number> = {};
    (signoffs || []).forEach((s) => {
      signoffMap[s.student_id] = (signoffMap[s.student_id] || 0) + 1;
    });

    // 5. Fetch clinical hours (student_clinical_hours table)
    let clinicalHoursMap: Record<string, number> = {};
    const { data: clinicalHours } = await supabase
      .from('student_clinical_hours')
      .select('student_id, hours')
      .in('student_id', studentIds);

    (clinicalHours || []).forEach((c) => {
      clinicalHoursMap[c.student_id] = (clinicalHoursMap[c.student_id] || 0) + (c.hours || 0);
    });

    // 6. Build student rows
    let totalAttendancePct = 0;
    let totalSkillPct = 0;
    let atRiskCount = 0;

    const studentRows = studentList.map((student) => {
      const att = attendanceMap[student.id] || { present: 0, late: 0, absent: 0, excused: 0 };
      const totalRecords = att.present + att.late + att.absent + att.excused;
      const attendancePct =
        totalRecords > 0 ? Math.round(((att.present + att.late) / totalRecords) * 100) : 100;

      const signedOff = signoffMap[student.id] || 0;
      const skillPct = totalSkills > 0 ? Math.round((signedOff / totalSkills) * 100) : 0;

      const clinicalHrs = clinicalHoursMap[student.id] || 0;

      const isAtRisk = attendancePct < 80 || skillPct < 50;
      if (isAtRisk) atRiskCount++;

      totalAttendancePct += attendancePct;
      totalSkillPct += skillPct;

      const cohort = student.cohort as any;
      return {
        id: student.id,
        name: `${student.last_name}, ${student.first_name}`,
        cohort: cohort
          ? `${cohort.program?.abbreviation || 'PMD'} C${cohort.cohort_number}`
          : null,
        attendance: att,
        attendance_pct: attendancePct,
        skills_completed: signedOff,
        total_skills: totalSkills,
        skill_pct: skillPct,
        clinical_hours: Math.round(clinicalHrs * 10) / 10,
        status: isAtRisk ? 'at_risk' : 'on_track',
      };
    });

    const avgAttendance =
      studentRows.length > 0 ? Math.round(totalAttendancePct / studentRows.length) : 0;
    const avgSkillCompletion =
      studentRows.length > 0 ? Math.round(totalSkillPct / studentRows.length) : 0;

    const response = NextResponse.json({
      success: true,
      students: studentRows,
      summary: {
        total_students: studentRows.length,
        avg_attendance: avgAttendance,
        avg_skill_completion: avgSkillCompletion,
        at_risk_count: atRiskCount,
        total_lab_days: totalLabDays,
      },
    });

    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error generating student dashboard report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
