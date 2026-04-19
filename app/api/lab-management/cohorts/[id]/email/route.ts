import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { Resend } from 'resend';
import { requireAuth } from '@/lib/api-auth';
import { wrapInEmailTemplate } from '@/lib/email-templates';
import { isNremtTestingActiveToday } from '@/lib/email';

const FROM_EMAIL = process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';
const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - emails will not be sent');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function buildEmailHtml(subject: string, body: string, cohortLabel: string): string {
  // Preserve line breaks in the body
  const htmlBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const content = `
    <p style="color: #93c5fd; margin: 0 0 16px 0; font-size: 14px; font-weight: 500;">
      ${cohortLabel}
    </p>
    <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">
      ${htmlBody}
    </p>
  `;

  return wrapInEmailTemplate(content, `${APP_URL}/settings?tab=notifications`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');

  if (auth instanceof NextResponse) return auth;

  const { user, session } = auth;

  const { id: cohortId } = await params;

  const supabase = getSupabaseAdmin();

  // Check user role - require lead_instructor minimum
  const { data: currentUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!currentUser || !hasMinRole(currentUser.role, 'lead_instructor')) {
    return NextResponse.json({ error: 'Forbidden - lead_instructor role required' }, { status: 403 });
  }

  let body: { subject: string; body: string; cc_directors: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { subject, body: emailBody, cc_directors } = body;

  if (!subject?.trim()) {
    return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
  }
  if (!emailBody?.trim()) {
    return NextResponse.json({ error: 'Email body is required' }, { status: 400 });
  }

  try {
    // Fetch cohort info for the label
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, program:programs(name, abbreviation)')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    const program = Array.isArray(cohort.program) ? cohort.program[0] : cohort.program;
    const cohortLabel = program
      ? `${program.abbreviation} Group ${cohort.cohort_number}`
      : `Group ${cohort.cohort_number}`;

    // Fetch active students in cohort with emails
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('cohort_id', cohortId)
      .eq('status', 'active');

    if (studentsError) throw studentsError;

    const studentsWithEmail = (students || []).filter(s => s.email?.trim());
    const studentsWithoutEmail = (students || []).filter(s => !s.email?.trim());

    // Fetch director/admin emails if cc_directors is requested
    let directorEmails: string[] = [];
    if (cc_directors) {
      const { data: directors } = await supabase
        .from('lab_users')
        .select('email')
        .in('role', ['admin', 'superadmin', 'lead_instructor'])
        .eq('is_active', true);

      directorEmails = (directors || [])
        .map(d => d.email)
        .filter(Boolean) as string[];
    }

    if (studentsWithEmail.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No students with email addresses found in this cohort',
        skipped: studentsWithoutEmail.length,
      }, { status: 400 });
    }

    // NREMT kill switch — highest-leak-risk route (instructor-initiated
    // mass email to students). 2026-04-15 exam had leaks through this
    // path because it uses its own Resend client and doesn't go through
    // lib/email.ts's sendEmail() guard.
    if (await isNremtTestingActiveToday()) {
      console.warn(
        '[nremt-guard] Blocked cohort email — NREMT testing is active today'
      );
      return NextResponse.json(
        {
          success: false,
          blocked: 'nremt_testing_day',
          error:
            'Cohort emails are blocked on NREMT testing days. Try again tomorrow.',
        },
        { status: 423 } // Locked
      );
    }

    const resend = getResend();
    const htmlContent = buildEmailHtml(subject, emailBody, cohortLabel);

    let successCount = 0;
    let failureCount = 0;
    const failures: string[] = [];

    // Send individual emails to each student
    for (const student of studentsWithEmail) {
      try {
        if (!resend) {
          // Mock mode - count as success
          successCount++;
          continue;
        }

        const { error: sendError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: student.email!,
          subject: subject,
          html: htmlContent,
          cc: directorEmails.length > 0 ? directorEmails : undefined,
        });

        if (sendError) {
          console.error(`Failed to send email to ${student.email}:`, sendError);
          failureCount++;
          failures.push(`${student.first_name} ${student.last_name}`);
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Exception sending email to ${student.email}:`, err);
        failureCount++;
        failures.push(`${student.first_name} ${student.last_name}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      skipped: studentsWithoutEmail.length,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (error) {
    console.error('Error sending cohort emails:', error);
    const message = error instanceof Error ? error.message : 'Failed to send emails';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
