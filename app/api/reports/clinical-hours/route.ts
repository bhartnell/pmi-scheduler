import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// Default hour requirements - these could be moved to a config table
const HOUR_REQUIREMENTS = {
  er: 48,
  icr: 24,
  ccl: 12,
  ems: 24,
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const supabase = getSupabaseAdmin();

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
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    let studentsQuery = supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .order('last_name');

    if (activeOnly) {
      studentsQuery = studentsQuery.in('status', ['active', 'enrolled']);
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) throw studentsError;

    const studentIds = students?.map(s => s.id) || [];

    // Fetch clinical hours for all students
    const { data: clinicalHours } = await supabase
      .from('student_clinical_hours')
      .select('*')
      .in('student_id', studentIds);

    // Build hours map by student and department
    // student_clinical_hours uses a wide table: one row per student with columns like ed_hours, ed_shifts, etc.
    const hoursMap: Record<string, Record<string, { hours: number; shifts: number }>> = {};
    studentIds.forEach(id => {
      hoursMap[id] = {
        er: { hours: 0, shifts: 0 },
        icr: { hours: 0, shifts: 0 },
        ccl: { hours: 0, shifts: 0 },
        ems: { hours: 0, shifts: 0 },
      };
    });

    clinicalHours?.forEach((record: any) => {
      const studentId = record.student_id;
      if (!hoursMap[studentId]) return;

      // Map wide-table columns to report department keys
      // ER = ed_hours + peds_ed_hours (all emergency department hours)
      hoursMap[studentId].er.hours = (record.ed_hours || 0) + (record.peds_ed_hours || 0);
      hoursMap[studentId].er.shifts = (record.ed_shifts || 0) + (record.peds_ed_shifts || 0);

      // ICR = icu_hours + peds_icu_hours (all intensive care hours)
      hoursMap[studentId].icr.hours = (record.icu_hours || 0) + (record.peds_icu_hours || 0);
      hoursMap[studentId].icr.shifts = (record.icu_shifts || 0) + (record.peds_icu_shifts || 0);

      // CCL = cardiology_hours (cardiac cath lab)
      hoursMap[studentId].ccl.hours = record.cardiology_hours || 0;
      hoursMap[studentId].ccl.shifts = record.cardiology_shifts || 0;

      // EMS = ems_field_hours + ems_ridealong_hours (all EMS hours)
      hoursMap[studentId].ems.hours = (record.ems_field_hours || 0) + (record.ems_ridealong_hours || 0);
      hoursMap[studentId].ems.shifts = (record.ems_field_shifts || 0) + (record.ems_ridealong_shifts || 0);
    });

    // Calculate totals by department
    const departmentTotals = {
      er: { totalHours: 0, totalShifts: 0, average: 0 },
      icr: { totalHours: 0, totalShifts: 0, average: 0 },
      ccl: { totalHours: 0, totalShifts: 0, average: 0 },
      ems: { totalHours: 0, totalShifts: 0, average: 0 },
    };

    Object.values(hoursMap).forEach(studentHours => {
      departmentTotals.er.totalHours += studentHours.er.hours;
      departmentTotals.er.totalShifts += studentHours.er.shifts;
      departmentTotals.icr.totalHours += studentHours.icr.hours;
      departmentTotals.icr.totalShifts += studentHours.icr.shifts;
      departmentTotals.ccl.totalHours += studentHours.ccl.hours;
      departmentTotals.ccl.totalShifts += studentHours.ccl.shifts;
      departmentTotals.ems.totalHours += studentHours.ems.hours;
      departmentTotals.ems.totalShifts += studentHours.ems.shifts;
    });

    const studentCount = students?.length || 1;
    departmentTotals.er.average = departmentTotals.er.totalHours / studentCount;
    departmentTotals.icr.average = departmentTotals.icr.totalHours / studentCount;
    departmentTotals.ccl.average = departmentTotals.ccl.totalHours / studentCount;
    departmentTotals.ems.average = departmentTotals.ems.totalHours / studentCount;

    // Build student breakdown
    const studentBreakdown: any[] = [];
    const flaggedStudents: any[] = [];
    let studentsOnTrack = 0;
    let studentsBehind = 0;

    (students || []).forEach(student => {
      const hours = hoursMap[student.id];
      const erHours = hours.er.hours;
      const icrHours = hours.icr.hours;
      const cclHours = hours.ccl.hours;
      const emsHours = hours.ems.hours;
      // Total includes all tracked department hours (ER/ICR/CCL/EMS are the 4 reported categories)
      const totalHours = erHours + icrHours + cclHours + emsHours;

      // Check if on track (simplified - just checking totals)
      const onTrack = erHours >= HOUR_REQUIREMENTS.er * 0.5 &&
                      icrHours >= HOUR_REQUIREMENTS.icr * 0.5 &&
                      cclHours >= HOUR_REQUIREMENTS.ccl * 0.5 &&
                      emsHours >= HOUR_REQUIREMENTS.ems * 0.5;

      if (onTrack) {
        studentsOnTrack++;
      } else {
        studentsBehind++;

        // Determine what they're behind on
        const behindDepts: string[] = [];
        if (erHours < HOUR_REQUIREMENTS.er * 0.5) behindDepts.push('ER');
        if (icrHours < HOUR_REQUIREMENTS.icr * 0.5) behindDepts.push('ICR');
        if (cclHours < HOUR_REQUIREMENTS.ccl * 0.5) behindDepts.push('CCL');
        if (emsHours < HOUR_REQUIREMENTS.ems * 0.5) behindDepts.push('EMS');

        flaggedStudents.push({
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          reason: `Behind in: ${behindDepts.join(', ')}`,
          details: `${totalHours}h total`,
        });
      }

      studentBreakdown.push({
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        erHours,
        icrHours,
        cclHours,
        emsHours,
        totalHours,
        onTrack,
      });
    });

    // Sort breakdown by name
    studentBreakdown.sort((a, b) => a.name.localeCompare(b.name));

    const report = {
      cohort: {
        id: cohort.id,
        name: `${(cohort.program as any)?.abbreviation || 'Unknown'} Group ${cohort.cohort_number}`,
      },
      dateRange: {
        start: startDate || 'All time',
        end: endDate || 'Present',
      },
      requirements: HOUR_REQUIREMENTS,
      summary: {
        totalStudents: students?.length || 0,
        studentsOnTrack,
        studentsBehind,
      },
      departmentTotals,
      studentBreakdown,
      flaggedStudents,
    };

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error generating clinical hours report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
