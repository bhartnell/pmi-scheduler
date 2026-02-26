import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';
import { wrapInEmailTemplate, EMAIL_COLORS } from '@/lib/email-templates';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';
const FROM_EMAIL =
  process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstructorUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AvailabilityRecord {
  instructor_id: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Monday (start) of the week containing the given date.
 * If date is Sunday, returns previous day (treats week as Mon-Sun).
 */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Format a date as YYYY-MM-DD (local date, no UTC shift). */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format a date for human-readable display like "Mon, Mar 2" */
function formatWeekOf(monday: Date): string {
  return monday.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Reminder email builder
// ---------------------------------------------------------------------------

function buildReminderEmail(instructorName: string, weekLabel: string): string {
  const firstName = instructorName.split(' ')[0] || instructorName;

  const content = `
    <h2 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 22px; font-weight: bold;">
      Availability Reminder
    </h2>
    <p style="color: ${EMAIL_COLORS.gray[500]}; margin: 0 0 24px 0; font-size: 14px;">
      Week of ${weekLabel}
    </p>

    <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">
      Hi ${firstName},
    </p>
    <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">
      This is a friendly reminder to submit your availability for the
      <strong>week of ${weekLabel}</strong>.
      Submitting your availability helps ensure proper lab coverage and scheduling.
    </p>

    <div style="background-color: #eff6ff; border-left: 4px solid ${EMAIL_COLORS.accent}; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.gray[700]};">
        Please log in and submit your availability as soon as possible so the schedule can be finalized.
      </p>
    </div>

    <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="background-color: ${EMAIL_COLORS.accent}; border-radius: 6px;">
          <a href="${APP_URL}/scheduling/availability" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
            Submit My Availability
          </a>
        </td>
      </tr>
    </table>

    <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.gray[200]}; margin: 24px 0;">
    <p style="font-size: 12px; color: ${EMAIL_COLORS.gray[500]}; margin: 0;">
      You received this reminder because availability has not yet been submitted for the upcoming week.
      To manage your notification preferences, visit
      <a href="${APP_URL}/settings?tab=notifications" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">Settings</a>.
    </p>
  `;

  return wrapInEmailTemplate(content, `${APP_URL}/settings?tab=notifications`);
}

// ---------------------------------------------------------------------------
// Dedup check — was a reminder already sent for this instructor + week?
// ---------------------------------------------------------------------------

async function wasReminderAlreadySent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  instructorEmail: string,
  weekStart: string
): Promise<{ sent: boolean; sentAt: string | null }> {
  // We store reminders as notifications with reference_type='availability_reminder'
  // and reference_id = the week start date string (YYYY-MM-DD).
  const { data } = await supabase
    .from('user_notifications')
    .select('created_at')
    .eq('user_email', instructorEmail)
    .eq('reference_type', 'availability_reminder')
    .eq('reference_id', weekStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data) {
    return { sent: true, sentAt: data.created_at };
  }
  return { sent: false, sentAt: null };
}

// ---------------------------------------------------------------------------
// Core: check one instructor for one week and send reminder if needed
// ---------------------------------------------------------------------------

async function processInstructorWeek(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  instructor: InstructorUser,
  weekStart: Date,
  weekEnd: Date,
  availabilityByInstructor: Set<string>
): Promise<'sent' | 'skipped' | 'already_sent'> {
  const weekStartStr = toDateString(weekStart);

  // Check if availability already submitted for this week
  if (availabilityByInstructor.has(instructor.id)) {
    return 'skipped'; // Already submitted
  }

  // Check if we already sent a reminder for this week
  const { sent } = await wasReminderAlreadySent(supabase, instructor.email, weekStartStr);
  if (sent) {
    return 'already_sent';
  }

  const weekLabel = formatWeekOf(weekStart);

  // Create in-app notification
  await createNotification({
    userEmail: instructor.email,
    title: 'Availability Reminder',
    message: `Please submit your availability for the week of ${weekLabel}. Submit now`,
    type: 'general',
    category: 'scheduling',
    linkUrl: '/scheduling/availability',
    referenceType: 'availability_reminder',
    referenceId: weekStartStr,
  });

  // Send email if Resend is configured
  const { Resend } = await import('resend');
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  if (resend) {
    const html = buildReminderEmail(instructor.name, weekLabel);
    const subject = `[PMI] Availability Reminder — Week of ${weekLabel}`;

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: instructor.email,
      subject,
      html,
    });

    if (sendError) {
      console.error(`[AVAIL-REMINDERS] Email failed for ${instructor.email}:`, sendError.message);
      // Non-fatal — in-app notification was already created
    } else {
      // Log email
      try {
        await supabase.from('email_log').insert({
          to_email: instructor.email,
          subject,
          template: 'availability_reminder',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } catch { /* Non-fatal */ }
    }
  }

  return 'sent';
}

// ---------------------------------------------------------------------------
// GET /api/cron/availability-reminders
//
// Vercel cron endpoint. Recommended schedule: Monday mornings (e.g., 13:00 UTC = 6am MST).
// Auth: Bearer CRON_SECRET (standard Vercel cron pattern).
// Checks current week + next week for missing availability.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[AVAIL-REMINDERS] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[AVAIL-REMINDERS] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();

  // Determine weeks to check: current week and next week
  const today = new Date();
  const currentWeekMonday = getWeekMonday(today);
  const nextWeekMonday = new Date(currentWeekMonday);
  nextWeekMonday.setDate(currentWeekMonday.getDate() + 7);

  const weeksToCheck: Array<{ start: Date; end: Date }> = [
    {
      start: currentWeekMonday,
      end: new Date(currentWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000),
    },
    {
      start: nextWeekMonday,
      end: new Date(nextWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000),
    },
  ];

  // Fetch all active instructors
  const { data: instructors, error: instructorError } = await supabase
    .from('lab_users')
    .select('id, name, email, role, is_active')
    .in('role', ['instructor', 'lead_instructor', 'volunteer_instructor'])
    .eq('is_active', true)
    .order('name');

  if (instructorError) {
    console.error('[AVAIL-REMINDERS] Failed to fetch instructors:', instructorError.message);
    return NextResponse.json(
      { error: 'Failed to fetch instructors', detail: instructorError.message },
      { status: 500 }
    );
  }

  if (!instructors || instructors.length === 0) {
    console.log('[AVAIL-REMINDERS] No active instructors found');
    return NextResponse.json({
      success: true,
      processed: 0,
      sent: 0,
      already_sent: 0,
      skipped: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    });
  }

  console.log(`[AVAIL-REMINDERS] Checking ${instructors.length} instructor(s) for ${weeksToCheck.length} week(s)`);

  let totalSent = 0;
  let totalAlreadySent = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // Process each week
  for (const week of weeksToCheck) {
    const weekStartStr = toDateString(week.start);
    const weekEndStr = toDateString(week.end);

    // Fetch all availability submissions for this week (any instructor)
    const { data: weekAvailability, error: availError } = await supabase
      .from('instructor_availability')
      .select('instructor_id, date')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);

    if (availError) {
      console.error(`[AVAIL-REMINDERS] Failed to fetch availability for week ${weekStartStr}:`, availError.message);
      errors.push(`Week ${weekStartStr}: ${availError.message}`);
      continue;
    }

    // Build a set of instructor IDs who have submitted for this week
    const submittedInstructorIds = new Set<string>(
      (weekAvailability || []).map((a: AvailabilityRecord) => a.instructor_id)
    );

    // Process each instructor for this week
    const weekResults = await Promise.allSettled(
      (instructors as InstructorUser[]).map((instructor) =>
        processInstructorWeek(supabase, instructor, week.start, week.end, submittedInstructorIds)
      )
    );

    weekResults.forEach((result, index) => {
      const instructor = (instructors as InstructorUser[])[index];
      const email = instructor?.email ?? `instructor[${index}]`;

      if (result.status === 'fulfilled') {
        if (result.value === 'sent') totalSent++;
        else if (result.value === 'already_sent') totalAlreadySent++;
        else totalSkipped++;
      } else {
        const errMsg =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[AVAIL-REMINDERS] Error processing ${email} for week ${weekStartStr}:`, errMsg);
        errors.push(`${email} (${weekStartStr}): ${errMsg}`);
      }
    });
  }

  const summary = {
    success: true,
    instructors_checked: instructors.length,
    weeks_checked: weeksToCheck.length,
    sent: totalSent,
    already_sent: totalAlreadySent,
    skipped: totalSkipped,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[AVAIL-REMINDERS] Completed:', summary);
  return NextResponse.json(summary);
}
