import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawAttendanceRow {
  student_id: string;
  status: string;
  lab_day: {
    id: string;
    date: string;
    cohort_id: string;
  } | null;
}

interface StudentAttendanceSummary {
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
// Helper: compute consecutive absences from ordered attendance rows
// (sorted chronologically newest-first after grouping)
// ---------------------------------------------------------------------------

function computeConsecutiveMisses(statuses: string[]): number {
  // statuses is ordered oldest → newest
  // Count from the end (most recent) how many consecutive absent/excused in a row
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
// GET /api/cron/attendance-alerts
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[ATTENDANCE-ALERTS] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[ATTENDANCE-ALERTS] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();

  // Fetch all active cohort IDs (cohorts that have active students)
  const { data: activeCohorts, error: cohortsError } = await supabase
    .from('cohorts')
    .select('id, cohort_number, program:programs(name, abbreviation)')
    .order('cohort_number', { ascending: false });

  if (cohortsError) {
    console.error('[ATTENDANCE-ALERTS] Failed to fetch cohorts:', cohortsError.message);
    return NextResponse.json(
      { error: 'Failed to fetch cohorts', detail: cohortsError.message },
      { status: 500 }
    );
  }

  if (!activeCohorts || activeCohorts.length === 0) {
    return NextResponse.json({
      success: true,
      at_risk_count: 0,
      at_risk_students: [],
      duration_ms: Date.now() - startTime,
    });
  }

  const atRiskStudents: StudentAttendanceSummary[] = [];

  for (const cohort of activeCohorts) {
    // Get active students in this cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohort.id)
      .eq('status', 'active');

    if (studentsError || !students || students.length === 0) continue;

    // Get all lab days for this cohort, ordered by date
    const { data: labDays, error: labDaysError } = await supabase
      .from('lab_days')
      .select('id, date')
      .eq('cohort_id', cohort.id)
      .lte('date', new Date().toISOString().split('T')[0])
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

      // Only count lab days that have attendance recorded (some may not be tracked yet)
      const markedLabDays = labDayIds.filter((id) => studentAttendance.has(id));

      if (markedLabDays.length === 0) continue;

      // Build chronological status list
      const orderedStatuses = markedLabDays
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
      const attendedLabDays = markedLabDays
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
        attendedLabDays.length > 0 ? labDayDateMap.get(attendedLabDays[0]) || null : null;

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

  const summary = {
    success: true,
    at_risk_count: atRiskStudents.length,
    critical_count: atRiskStudents.filter((s) => s.risk_level === 'critical').length,
    warning_count: atRiskStudents.filter((s) => s.risk_level === 'warning').length,
    at_risk_students: atRiskStudents,
    duration_ms: Date.now() - startTime,
  };

  console.log('[ATTENDANCE-ALERTS] Completed:', {
    at_risk_count: summary.at_risk_count,
    critical_count: summary.critical_count,
    warning_count: summary.warning_count,
    duration_ms: summary.duration_ms,
  });

  return NextResponse.json(summary);
}
