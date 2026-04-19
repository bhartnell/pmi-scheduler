import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { wrapInEmailTemplate } from '@/lib/email-templates';
import { Resend } from 'resend';
import { isNremtTestingActiveToday } from '@/lib/email';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';
const FROM_EMAIL =
  process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';

// ---------------------------------------------------------------------------
// Sample data used to replace {{variables}} in test sends
// ---------------------------------------------------------------------------
const SAMPLE_DATA: Record<string, string> = {
  '{{recipientName}}':    'Jane Instructor',
  '{{taskTitle}}':        'Review Student Assessments',
  '{{assignedBy}}':       'Admin User',
  '{{completedBy}}':      'Jane Instructor',
  '{{dueDate}}':          'March 1, 2026',
  '{{taskUrl}}':          `${APP_URL}/tasks`,
  '{{labDate}}':          'February 28, 2026',
  '{{cohortName}}':       'Cohort 24-A',
  '{{stationInfo}}':      'Station 1 – Airway Management',
  '{{labUrl}}':           `${APP_URL}/lab-management/schedule`,
  '{{shiftDate}}':        'February 28, 2026',
  '{{shiftDetails}}':     '0800–1600, Station 3',
  '{{signupUrl}}':        `${APP_URL}/scheduling/shifts`,
  '{{siteName}}':         'Banner University Medical Center',
  '{{daysSinceVisit}}':   '45',
  '{{visitUrl}}':         `${APP_URL}/clinical/site-visits`,
  '{{date}}':             new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  '{{notificationGroups}}': '<p style="color:#374151;font-size:14px;"><strong>Tasks (2):</strong> Review Student Assessments, Update Lab Schedule</p>',
};

function applySampleData(text: string): string {
  let result = text;
  for (const [variable, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replaceAll(variable, value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Import default generators from the parent route module
// (re-exported to avoid duplication)
// ---------------------------------------------------------------------------
import { getDefaultSubject, getDefaultBody } from '../route';

// ---------------------------------------------------------------------------
// POST /api/admin/email-templates/test
// Sends a test email to the requesting admin's own address.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { template_key, to } = body as { template_key: string; to: string };

    if (!template_key) {
      return NextResponse.json({ error: 'template_key is required' }, { status: 400 });
    }

    // Security: the test destination must be the current user's email
    if (!to || to.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Test emails can only be sent to your own address' },
        { status: 403 }
      );
    }

    // Fetch any customization from DB
    const supabase = getSupabaseAdmin();
    const { data: custom } = await supabase
      .from('email_template_customizations')
      .select('subject, body_html')
      .eq('template_key', template_key)
      .maybeSingle();

    const rawSubject = custom?.subject || getDefaultSubject(template_key);
    const rawBody    = custom?.body_html || getDefaultBody(template_key);

    const subject  = applySampleData(rawSubject);
    const bodyHtml = applySampleData(rawBody);
    const fullHtml = wrapInEmailTemplate(bodyHtml);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: true, message: 'Test email simulated (no API key)' });
    }

    // NREMT kill switch — even admin test sends stop on NREMT days so a
    // template preview doesn't accidentally leak to a student address.
    if (await isNremtTestingActiveToday()) {
      return NextResponse.json(
        {
          success: false,
          blocked: 'nremt_testing_day',
          error:
            'Test email blocked — NREMT testing is active today. Try again tomorrow.',
        },
        { status: 423 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: emailData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: fullHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: emailData?.id });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
