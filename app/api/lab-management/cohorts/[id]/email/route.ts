import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { Resend } from 'resend';

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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a5f; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">
                PMI Paramedic Tools
              </h1>
              <p style="color: #93c5fd; margin: 8px 0 0 0; font-size: 14px;">
                ${cohortLabel}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">
                ${htmlBody}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: #6b7280; font-size: 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0;">
                      Pima Medical Institute - Paramedic Program
                    </p>
                    <p style="margin: 0;">
                      <a href="${APP_URL}" style="color: #2563eb; text-decoration: none;">
                        Open PMI Tools
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
