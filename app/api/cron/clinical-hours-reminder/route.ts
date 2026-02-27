import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CohortRow {
  id: string;
  cohort_number: number;
  start_date: string | null;
  end_date: string | null;
  program: { name: string; abbreviation: string } | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort_id: string;
}

interface ClinicalHoursRow {
  student_id: string;
  total_hours: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the number of full weeks elapsed from start_date to today.
 */
function weeksElapsed(startDate: Date, today: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = today.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(diff / msPerWeek));
}

/**
 * Returns the total number of weeks in a cohort (start → end).
 * Falls back to 52 weeks (1 year) when end_date is not set.
 */
function totalWeeks(startDate: Date, endDate: Date | null): number {
  if (!endDate) return 52;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.round(diff / msPerWeek));
}

// ---------------------------------------------------------------------------
// GET /api/cron/clinical-hours-reminder
//
// Runs weekly (Monday 9am UTC = 2am MST). Checks every active cohort's
// students against program clinical-hour requirements. Students who are
// more than 20% behind expected pace receive an in-app notification, and
// their lead instructors (admin/superadmin users) are also notified.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[CLINICAL-HOURS-REMINDER] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[CLINICAL-HOURS-REMINDER] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Fetch the required clinical hours for paramedic program (or use a default)
  const REQUIRED_HOURS_DEFAULT = 280; // Default when no program requirement found

  const { data: reqRow } = await supabase
    .from('program_requirements')
    .select('required_value')
    .eq('program', 'paramedic')
    .eq('requirement_type', 'clinical_hours')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const requiredHours: number = reqRow?.required_value ?? REQUIRED_HOURS_DEFAULT;

  // Fetch all active, non-archived cohorts that have started
  const { data: cohorts, error: cohortsError } = await supabase
    .from('cohorts')
    .select('id, cohort_number, start_date, end_date, program:programs(name, abbreviation)')
    .eq('is_active', true)
    .eq('is_archived', false)
    .not('start_date', 'is', null)
    .lte('start_date', todayStr);

  if (cohortsError) {
    console.error('[CLINICAL-HOURS-REMINDER] Failed to fetch cohorts:', cohortsError.message);
    return NextResponse.json(
      { error: 'Failed to fetch cohorts', detail: cohortsError.message },
      { status: 500 }
    );
  }

  if (!cohorts || cohorts.length === 0) {
    return NextResponse.json({
      success: true,
      processed: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  // Fetch all admin/lead_instructor users for instructor notifications
  const { data: adminUsers } = await supabase
    .from('lab_users')
    .select('email, name')
    .in('role', ['admin', 'superadmin', 'lead_instructor'])
    .eq('is_active', true);

  const adminEmails: string[] = (adminUsers || [])
    .map((u: { email: string }) => u.email)
    .filter(Boolean);

  let totalStudentsChecked = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  for (const cohort of cohorts as unknown as CohortRow[]) {
    if (!cohort.start_date) continue;

    const cohortStart = new Date(cohort.start_date + 'T12:00:00');
    const cohortEnd = cohort.end_date ? new Date(cohort.end_date + 'T12:00:00') : null;
    const program = cohort.program as { name: string; abbreviation: string } | null;
    const cohortLabel = program
      ? `${program.abbreviation} Cohort ${cohort.cohort_number}`
      : `Cohort ${cohort.cohort_number}`;

    const elapsed = weeksElapsed(cohortStart, today);
    const total = totalWeeks(cohortStart, cohortEnd);

    if (elapsed === 0 || total === 0) continue;

    const progressFraction = Math.min(elapsed / total, 1);
    const expectedHours = progressFraction * requiredHours;

    // No useful threshold until at least 10% of program has elapsed
    if (progressFraction < 0.1) continue;

    // Get active students in this cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, cohort_id')
      .eq('cohort_id', cohort.id)
      .eq('status', 'active');

    if (studentsError || !students || students.length === 0) continue;

    const studentIds = students.map((s: StudentRow) => s.id);
    totalStudentsChecked += students.length;

    // Get clinical hours for these students
    const { data: hoursRows } = await supabase
      .from('student_clinical_hours')
      .select('student_id, total_hours')
      .in('student_id', studentIds);

    const hoursMap = new Map<string, number>(
      (hoursRows || []).map((h: ClinicalHoursRow) => [
        h.student_id,
        Number(h.total_hours ?? 0),
      ])
    );

    // Check dedup window: don't re-notify a student more than once per 7 days
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await supabase
      .from('user_notifications')
      .select('user_email')
      .eq('reference_type', 'clinical_hours_reminder')
      .gte('created_at', sevenDaysAgo)
      .in(
        'user_email',
        students.map((s: StudentRow) => s.email).filter(Boolean) as string[]
      );

    const alreadyNotifiedEmails = new Set<string>(
      (recentNotifications || []).map((n: { user_email: string }) => n.user_email)
    );

    const behindStudents: StudentRow[] = [];

    for (const student of students as StudentRow[]) {
      const actualHours = hoursMap.get(student.id) ?? 0;

      // Behind if actual < 80% of expected
      if (actualHours < expectedHours * 0.8) {
        behindStudents.push(student);

        // Only send if not recently notified and student has an email
        if (!student.email || alreadyNotifiedEmails.has(student.email)) continue;

        const percentComplete = Math.round((actualHours / requiredHours) * 100);
        const expectedPct = Math.round(progressFraction * 100);

        try {
          await createNotification({
            userEmail: student.email,
            title: 'Clinical Hours Reminder',
            message: `You have ${actualHours} of ${requiredHours} required clinical hours (${percentComplete}%). At this point in the program you should be around ${expectedPct}% complete. Please schedule additional shifts.`,
            type: 'clinical_hours',
            category: 'clinical',
            linkUrl: '/clinical/hours',
            referenceType: 'clinical_hours_reminder',
          });
          notificationsSent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Student ${student.id} notification failed: ${msg}`);
        }
      }
    }

    // Notify lead instructors if there are behind students
    if (behindStudents.length > 0 && adminEmails.length > 0) {
      const sevenDaysAgoForAdmin = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentAdminNotifications } = await supabase
        .from('user_notifications')
        .select('user_email')
        .eq('reference_type', 'clinical_hours_instructor_alert')
        .eq('reference_id', cohort.id)
        .gte('created_at', sevenDaysAgoForAdmin);

      const alreadyAlertedAdmins = new Set<string>(
        (recentAdminNotifications || []).map((n: { user_email: string }) => n.user_email)
      );

      for (const adminEmail of adminEmails) {
        if (alreadyAlertedAdmins.has(adminEmail)) continue;
        try {
          await createNotification({
            userEmail: adminEmail,
            title: `Clinical Hours Alert: ${cohortLabel}`,
            message: `${behindStudents.length} student${behindStudents.length !== 1 ? 's are' : ' is'} behind pace for clinical hours in ${cohortLabel}. Expected ${Math.round(expectedHours)}h at current program progress.`,
            type: 'clinical_hours',
            category: 'clinical',
            linkUrl: `/clinical/hours?cohort=${cohort.id}`,
            referenceType: 'clinical_hours_instructor_alert',
            referenceId: cohort.id,
          });
          notificationsSent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Admin ${adminEmail} notification failed: ${msg}`);
        }
      }
    }
  }

  const summary = {
    success: true,
    cohorts_checked: cohorts.length,
    students_checked: totalStudentsChecked,
    notifications_sent: notificationsSent,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[CLINICAL-HOURS-REMINDER] Completed:', summary);
  return NextResponse.json(summary);
}
