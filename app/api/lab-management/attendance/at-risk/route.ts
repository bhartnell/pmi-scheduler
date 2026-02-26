import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AtRiskStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  cohort_id: string;
  cohort_label: string;
  total_labs: number;
  total_absences: number;
  consecutive_misses: number;
  attendance_pct: number;
  last_attended_date: string | null;
  risk_level: 'warning' | 'critical';
}

// ---------------------------------------------------------------------------
// Helper: compute consecutive absences from ordered statuses (oldest → newest)
// ---------------------------------------------------------------------------

function computeConsecutiveMisses(statuses: string[]): number {
  let streak = 0;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] === 'absent') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ---------------------------------------------------------------------------
// GET /api/lab-management/attendance/at-risk
// Query params: ?cohort_id= (optional)
// Requires: instructor+ role
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Verify role
  const { data: requestingUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  const userRole = requestingUser?.role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cohortIdFilter = searchParams.get('cohort_id');

  try {
    // Build cohort query
    let cohortQuery = supabase
      .from('cohorts')
      .select('id, cohort_number, program:programs(name, abbreviation)')
      .order('cohort_number', { ascending: false });

    if (cohortIdFilter) {
      cohortQuery = cohortQuery.eq('id', cohortIdFilter);
    }

    const { data: cohorts, error: cohortsError } = await cohortQuery;

    if (cohortsError) {
      console.error('[AT-RISK] Cohorts fetch error:', cohortsError.message);
      return NextResponse.json({ error: 'Failed to fetch cohorts' }, { status: 500 });
    }

    if (!cohorts || cohorts.length === 0) {
      return NextResponse.json({ at_risk_students: [], total: 0 });
    }

    const today = new Date().toISOString().split('T')[0];
    const atRiskStudents: AtRiskStudent[] = [];

    for (const cohort of cohorts) {
      // Get active students in this cohort
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('cohort_id', cohort.id)
        .eq('status', 'active');

      if (studentsError || !students || students.length === 0) continue;

      // Get all past lab days for this cohort
      const { data: labDays, error: labDaysError } = await supabase
        .from('lab_days')
        .select('id, date')
        .eq('cohort_id', cohort.id)
        .lte('date', today)
        .order('date', { ascending: true });

      if (labDaysError || !labDays || labDays.length === 0) continue;

      const labDayIds = labDays.map((ld) => ld.id);
      const labDayDateMap = new Map<string, string>(labDays.map((ld) => [ld.id, ld.date]));

      // Get all attendance records for these lab days
      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('lab_day_attendance')
        .select('student_id, status, lab_day_id')
        .in('lab_day_id', labDayIds);

      if (attendanceError) continue;

      // Build attendance map: student_id -> { lab_day_id -> status }
      const attendanceByStudent = new Map<string, Map<string, string>>();
      for (const row of attendanceRows || []) {
        if (!attendanceByStudent.has(row.student_id)) {
          attendanceByStudent.set(row.student_id, new Map());
        }
        attendanceByStudent.get(row.student_id)!.set(row.lab_day_id, row.status);
      }

      // Build cohort label
      const program = cohort.program as unknown as { name: string; abbreviation: string } | null;
      const cohortLabel = program
        ? `${program.abbreviation} Cohort ${cohort.cohort_number}`
        : `Cohort ${cohort.cohort_number}`;

      // Analyze each student
      for (const student of students) {
        const studentAttendance = attendanceByStudent.get(student.id) || new Map<string, string>();

        // Only include lab days that have an attendance record
        const markedLabDays = labDayIds.filter((id) => studentAttendance.has(id));

        if (markedLabDays.length === 0) continue;

        // Chronological status list
        const orderedStatuses = [...markedLabDays]
          .sort((a, b) => {
            const dateA = labDayDateMap.get(a) || '';
            const dateB = labDayDateMap.get(b) || '';
            return dateA.localeCompare(dateB);
          })
          .map((id) => studentAttendance.get(id)!);

        const totalAbsences = orderedStatuses.filter((s) => s === 'absent').length;
        const consecutiveMisses = computeConsecutiveMisses(orderedStatuses);
        const totalLabs = markedLabDays.length;
        const presentCount = orderedStatuses.filter(
          (s) => s === 'present' || s === 'late'
        ).length;
        const attendancePct =
          totalLabs > 0 ? Math.round((presentCount / totalLabs) * 100) : 100;

        // Find last attended date
        const attendedLabDayIds = [...markedLabDays]
          .filter((id) => {
            const s = studentAttendance.get(id);
            return s === 'present' || s === 'late';
          })
          .sort((a, b) => {
            const dateA = labDayDateMap.get(a) || '';
            const dateB = labDayDateMap.get(b) || '';
            return dateB.localeCompare(dateA); // newest first
          });

        const lastAttendedDate =
          attendedLabDayIds.length > 0
            ? labDayDateMap.get(attendedLabDayIds[0]) || null
            : null;

        // Determine risk level
        const isCritical = totalAbsences >= 3 || consecutiveMisses >= 3;
        const isWarning = !isCritical && totalAbsences >= 2;

        if (isCritical || isWarning) {
          atRiskStudents.push({
            student_id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            cohort_id: cohort.id,
            cohort_label: cohortLabel,
            total_labs: totalLabs,
            total_absences: totalAbsences,
            consecutive_misses: consecutiveMisses,
            attendance_pct: attendancePct,
            last_attended_date: lastAttendedDate,
            risk_level: isCritical ? 'critical' : 'warning',
          });
        }
      }
    }

    // Sort: critical first, then by absences descending
    atRiskStudents.sort((a, b) => {
      if (a.risk_level !== b.risk_level) {
        return a.risk_level === 'critical' ? -1 : 1;
      }
      return b.total_absences - a.total_absences;
    });

    return NextResponse.json({
      at_risk_students: atRiskStudents,
      total: atRiskStudents.length,
      critical_count: atRiskStudents.filter((s) => s.risk_level === 'critical').length,
      warning_count: atRiskStudents.filter((s) => s.risk_level === 'warning').length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AT-RISK] Error:', message);
    return NextResponse.json({ error: 'Failed to compute at-risk students' }, { status: 500 });
  }
}
