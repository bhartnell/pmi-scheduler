import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InternshipRow {
  id: string;
  student_id: string;
  status: string;
  internship_start_date: string | null;
  expected_end_date: string | null;
  phase_1_eval_completed: boolean;
  phase_1_eval_scheduled: string | null;
  phase_2_eval_completed: boolean;
  phase_2_eval_scheduled: string | null;
  closeout_completed: boolean;
  closeout_meeting_date: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Phase 1 eval is typically due 30 days after internship start
const PHASE_1_DUE_DAYS_FROM_START = 30;
// Phase 2 eval is typically due 30 days before expected end
const PHASE_2_DUE_DAYS_BEFORE_END = 30;
// Closeout reminder thresholds (days before expected_end_date)
const CLOSEOUT_REMINDER_DAYS = [14, 7, 3];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(dateA: Date, dateB: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay);
}

/** Format a date as a human-readable string like "Mar 15, 2026" */
function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// GET /api/cron/internship-milestones
//
// Runs daily at 9am UTC. Checks active student_internships for:
//   1. Phase 1 eval due (30 days after internship_start_date) - if not completed
//   2. Phase 2 eval due (30 days before expected_end_date) - if not completed
//   3. Closeout deadline approaching (14, 7, 3 days before expected_end_date)
// Creates notifications for the student and sends alerts to admin/lead instructors.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[INTERNSHIP-MILESTONES] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[INTERNSHIP-MILESTONES] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all active internships (in progress, not completed/withdrawn)
  const { data: internships, error: internshipsError } = await supabase
    .from('student_internships')
    .select(`
      id,
      student_id,
      status,
      internship_start_date,
      expected_end_date,
      phase_1_eval_completed,
      phase_1_eval_scheduled,
      phase_2_eval_completed,
      phase_2_eval_scheduled,
      closeout_completed,
      closeout_meeting_date,
      student:students(id, first_name, last_name, email)
    `)
    .in('status', ['in_progress', 'on_track', 'at_risk', 'phase_1_mentorship', 'phase_2_evaluation'])
    .eq('closeout_completed', false);

  if (internshipsError) {
    console.error('[INTERNSHIP-MILESTONES] Failed to fetch internships:', internshipsError.message);
    return NextResponse.json(
      { error: 'Failed to fetch internships', detail: internshipsError.message },
      { status: 500 }
    );
  }

  if (!internships || internships.length === 0) {
    return NextResponse.json({
      success: true,
      internships_checked: 0,
      notifications_sent: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  // Fetch admin/lead instructor emails for instructor notifications
  const { data: adminUsers } = await supabase
    .from('lab_users')
    .select('email, name')
    .in('role', ['admin', 'superadmin', 'lead_instructor'])
    .eq('is_active', true);

  const adminEmails: string[] = (adminUsers || [])
    .map((u: { email: string }) => u.email)
    .filter(Boolean);

  // Dedup: don't re-send same milestone type for same internship within 1 day
  const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNotifications } = await supabase
    .from('user_notifications')
    .select('user_email, reference_type, reference_id')
    .in('reference_type', [
      'internship_phase1_eval_due',
      'internship_phase2_eval_due',
      'internship_closeout_due',
      'internship_milestone_instructor',
    ])
    .gte('created_at', oneDayAgo);

  // "<user_email>:<reference_type>:<internship_id>"
  const alreadySentSet = new Set<string>(
    (recentNotifications || []).map(
      (n: { user_email: string; reference_type: string; reference_id: string | null }) =>
        `${n.user_email}:${n.reference_type}:${n.reference_id ?? ''}`
    )
  );

  let notificationsSent = 0;
  const errors: string[] = [];

  for (const internship of internships as unknown as InternshipRow[]) {
    const student = internship.student as InternshipRow['student'];
    const studentName = student
      ? `${student.first_name} ${student.last_name}`.trim()
      : 'Unknown Student';

    // ---------------------------------------------------------------------------
    // 1. Phase 1 eval due check
    // ---------------------------------------------------------------------------
    if (
      internship.internship_start_date &&
      !internship.phase_1_eval_completed
    ) {
      const startDate = new Date(internship.internship_start_date + 'T12:00:00');
      const phase1DueDate = new Date(startDate.getTime() + PHASE_1_DUE_DAYS_FROM_START * 24 * 60 * 60 * 1000);
      const daysUntilPhase1Due = daysBetween(today, phase1DueDate);

      // Remind at 7, 3, 1 days before due, and on the due date
      if (daysUntilPhase1Due >= 0 && daysUntilPhase1Due <= 7) {
        // Student notification
        if (student?.email) {
          const dedupKey = `${student.email}:internship_phase1_eval_due:${internship.id}`;
          if (!alreadySentSet.has(dedupKey)) {
            const urgencyText = daysUntilPhase1Due === 0
              ? 'due today'
              : `due in ${daysUntilPhase1Due} day${daysUntilPhase1Due !== 1 ? 's' : ''}`;
            try {
              await createNotification({
                userEmail: student.email,
                title: `Phase 1 Evaluation ${daysUntilPhase1Due === 0 ? 'Due Today' : 'Coming Up'}`,
                message: `Your Phase 1 internship evaluation is ${urgencyText} (${formatDate(phase1DueDate.toISOString().split('T')[0])}). Please coordinate with your preceptor and clinical director to schedule this evaluation.`,
                type: 'general',
                category: 'clinical',
                linkUrl: '/clinical/internships',
                referenceType: 'internship_phase1_eval_due',
                referenceId: internship.id,
              });
              notificationsSent++;
              alreadySentSet.add(dedupKey);
            } catch (err) {
              errors.push(`Phase 1 notification for ${student.email}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

        // Instructor notification
        for (const adminEmail of adminEmails) {
          const dedupKey = `${adminEmail}:internship_milestone_instructor:${internship.id}-phase1`;
          if (!alreadySentSet.has(dedupKey)) {
            try {
              await createNotification({
                userEmail: adminEmail,
                title: `Phase 1 Eval Due: ${studentName}`,
                message: `${studentName}'s Phase 1 internship evaluation is due ${daysUntilPhase1Due === 0 ? 'today' : `in ${daysUntilPhase1Due} day${daysUntilPhase1Due !== 1 ? 's' : ''}`} (${formatDate(phase1DueDate.toISOString().split('T')[0])}). Evaluation has not been completed yet.`,
                type: 'general',
                category: 'clinical',
                linkUrl: `/clinical/internships/${internship.id}`,
                referenceType: 'internship_milestone_instructor',
                referenceId: internship.id,
              });
              notificationsSent++;
              alreadySentSet.add(dedupKey);
            } catch (err) {
              errors.push(`Phase 1 instructor alert for ${adminEmail}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------------------
    // 2. Phase 2 eval due check
    // ---------------------------------------------------------------------------
    if (
      internship.expected_end_date &&
      !internship.phase_2_eval_completed
    ) {
      const endDate = new Date(internship.expected_end_date + 'T12:00:00');
      const phase2DueDate = new Date(endDate.getTime() - PHASE_2_DUE_DAYS_BEFORE_END * 24 * 60 * 60 * 1000);
      const daysUntilPhase2Due = daysBetween(today, phase2DueDate);

      if (daysUntilPhase2Due >= 0 && daysUntilPhase2Due <= 7) {
        if (student?.email) {
          const dedupKey = `${student.email}:internship_phase2_eval_due:${internship.id}`;
          if (!alreadySentSet.has(dedupKey)) {
            const urgencyText = daysUntilPhase2Due === 0
              ? 'due today'
              : `due in ${daysUntilPhase2Due} day${daysUntilPhase2Due !== 1 ? 's' : ''}`;
            try {
              await createNotification({
                userEmail: student.email,
                title: `Phase 2 Evaluation ${daysUntilPhase2Due === 0 ? 'Due Today' : 'Coming Up'}`,
                message: `Your Phase 2 internship evaluation is ${urgencyText} (${formatDate(phase2DueDate.toISOString().split('T')[0])}). Please coordinate scheduling with your preceptor and clinical director.`,
                type: 'general',
                category: 'clinical',
                linkUrl: '/clinical/internships',
                referenceType: 'internship_phase2_eval_due',
                referenceId: internship.id,
              });
              notificationsSent++;
              alreadySentSet.add(dedupKey);
            } catch (err) {
              errors.push(`Phase 2 notification for ${student.email}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

        for (const adminEmail of adminEmails) {
          const dedupKey = `${adminEmail}:internship_milestone_instructor:${internship.id}-phase2`;
          if (!alreadySentSet.has(dedupKey)) {
            try {
              await createNotification({
                userEmail: adminEmail,
                title: `Phase 2 Eval Due: ${studentName}`,
                message: `${studentName}'s Phase 2 internship evaluation is due ${daysUntilPhase2Due === 0 ? 'today' : `in ${daysUntilPhase2Due} day${daysUntilPhase2Due !== 1 ? 's' : ''}`} (${formatDate(phase2DueDate.toISOString().split('T')[0])}). Evaluation has not been completed yet.`,
                type: 'general',
                category: 'clinical',
                linkUrl: `/clinical/internships/${internship.id}`,
                referenceType: 'internship_milestone_instructor',
                referenceId: internship.id,
              });
              notificationsSent++;
              alreadySentSet.add(dedupKey);
            } catch (err) {
              errors.push(`Phase 2 instructor alert for ${adminEmail}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------------------
    // 3. Closeout deadline approaching
    // ---------------------------------------------------------------------------
    if (internship.expected_end_date) {
      const endDate = new Date(internship.expected_end_date + 'T12:00:00');
      const daysUntilEnd = daysBetween(today, endDate);

      if (CLOSEOUT_REMINDER_DAYS.includes(daysUntilEnd)) {
        if (student?.email) {
          const dedupKey = `${student.email}:internship_closeout_due:${internship.id}`;
          if (!alreadySentSet.has(dedupKey)) {
            try {
              await createNotification({
                userEmail: student.email,
                title: `Internship Closeout in ${daysUntilEnd} Day${daysUntilEnd !== 1 ? 's' : ''}`,
                message: `Your internship is expected to conclude in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} on ${formatDate(internship.expected_end_date)}. Please ensure all evaluations are complete and coordinate your closeout meeting.`,
                type: 'general',
                category: 'clinical',
                linkUrl: '/clinical/internships',
                referenceType: 'internship_closeout_due',
                referenceId: internship.id,
              });
              notificationsSent++;
              alreadySentSet.add(dedupKey);
            } catch (err) {
              errors.push(`Closeout notification for ${student.email}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

        for (const adminEmail of adminEmails) {
          const dedupKey = `${adminEmail}:internship_milestone_instructor:${internship.id}-closeout`;
          if (!alreadySentSet.has(dedupKey)) {
            try {
              await createNotification({
                userEmail: adminEmail,
                title: `Internship Closeout Due: ${studentName}`,
                message: `${studentName}'s internship concludes in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} on ${formatDate(internship.expected_end_date)}. Ensure Phase 1 eval, Phase 2 eval, and closeout meeting are all scheduled.`,
                type: 'general',
                category: 'clinical',
                linkUrl: `/clinical/internships/${internship.id}`,
                referenceType: 'internship_milestone_instructor',
                referenceId: internship.id,
              });
              notificationsSent++;
              alreadySentSet.add(dedupKey);
            } catch (err) {
              errors.push(`Closeout instructor alert for ${adminEmail}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }
  }

  const summary = {
    success: true,
    internships_checked: internships.length,
    notifications_sent: notificationsSent,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[INTERNSHIP-MILESTONES] Completed:', summary);
  return NextResponse.json(summary);
}
