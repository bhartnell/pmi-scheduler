import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
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
}

// ---------------------------------------------------------------------------
// Email builder (same as cron route)
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
// POST /api/scheduling/send-availability-reminders
//
// Manually trigger reminder notifications for instructors who haven't submitted
// availability for a given week.
//
// Body (JSON):
//   { week: "YYYY-MM-DD" }                   — send to all missing instructors for this week
//   { week: "YYYY-MM-DD", instructor_emails: ["a@pmi.edu"] } — send only to specified emails
//
// Role restriction: admin, superadmin, lead_instructor
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Look up current user and role
    const { data: currentUser, error: userError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'lead_instructor')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions. Lead Instructor or higher required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { week, instructor_emails } = body as {
      week?: string;
      instructor_emails?: string[];
    };

    if (!week) {
      return NextResponse.json(
        { success: false, error: 'week is required (YYYY-MM-DD format, Monday of target week)' },
        { status: 400 }
      );
    }

    const weekStart = new Date(week + 'T00:00:00');
    if (isNaN(weekStart.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid week format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = week;
    const weekEndStr = toDateString(weekEnd);

    const weekLabel = weekStart.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // Build query for target instructors
    let instructorQuery = supabase
      .from('lab_users')
      .select('id, name, email, role')
      .in('role', ['instructor', 'lead_instructor', 'volunteer_instructor', 'admin', 'superadmin'])
      .eq('is_active', true)
      .order('name');

    // If specific emails were provided, filter to those
    if (instructor_emails && instructor_emails.length > 0) {
      instructorQuery = instructorQuery.in('email', instructor_emails);
    }

    const { data: targetInstructors, error: instructorError } = await instructorQuery;

    if (instructorError) {
      throw instructorError;
    }

    if (!targetInstructors || targetInstructors.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        skipped: 0,
        message: 'No matching instructors found',
      });
    }

    // Fetch this week's availability to skip those who already submitted
    const { data: weekAvailability } = await supabase
      .from('instructor_availability')
      .select('instructor_id')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);

    const submittedIds = new Set<string>(
      (weekAvailability || []).map((a: { instructor_id: string }) => a.instructor_id)
    );

    // Initialize Resend
    const { Resend } = await import('resend');
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];
    const sentTo: string[] = [];

    for (const instructor of targetInstructors as InstructorUser[]) {
      // If targeting "all missing" (no explicit emails), skip those who submitted
      if (!instructor_emails && submittedIds.has(instructor.id)) {
        skipped++;
        continue;
      }

      try {
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

        // Send email
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
            console.error(
              `[SEND-REMINDERS] Email failed for ${instructor.email}:`,
              sendError.message
            );
            // Not fatal — in-app notification still sent
          } else {
            // Log email (non-fatal)
            try {
              await supabase
                .from('email_log')
                .insert({
                  to_email: instructor.email,
                  subject,
                  template: 'availability_reminder',
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                });
            } catch { /* Non-fatal */ }
          }
        }

        sent++;
        sentTo.push(instructor.email);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SEND-REMINDERS] Error processing ${instructor.email}:`, msg);
        errors.push(`${instructor.email}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      week: weekStartStr,
      sent,
      skipped,
      sent_to: sentTo,
      errors,
      message: `Sent ${sent} reminder${sent !== 1 ? 's' : ''}${skipped > 0 ? `, skipped ${skipped} (already submitted)` : ''}.`,
    });
  } catch (error: unknown) {
    console.error('Error sending availability reminders:', error);
    const message = error instanceof Error ? error.message : 'Failed to send reminders';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
