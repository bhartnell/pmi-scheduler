import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import {
  wrapInEmailTemplate,
  emailHeading,
  emailParagraph,
  emailButton,
  emailContentBox,
  EMAIL_COLORS,
} from '@/lib/email-templates';

// ---------------------------------------------------------------------------
// Template registry – source of truth for what templates exist and what
// default subject / body they produce.
// ---------------------------------------------------------------------------

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

export const TEMPLATE_DEFINITIONS = [
  {
    key: 'task_assigned',
    name: 'Task Assigned',
    category: 'Tasks',
    description: 'Sent when a task is assigned to an instructor',
    variables: ['{{recipientName}}', '{{taskTitle}}', '{{assignedBy}}', '{{dueDate}}', '{{taskUrl}}'],
  },
  {
    key: 'task_completed',
    name: 'Task Completed',
    category: 'Tasks',
    description: 'Sent when an assigned task is completed',
    variables: ['{{recipientName}}', '{{taskTitle}}', '{{completedBy}}', '{{taskUrl}}'],
  },
  {
    key: 'lab_assigned',
    name: 'Lab Assignment',
    category: 'Labs',
    description: 'Sent when an instructor is assigned to a lab day',
    variables: ['{{recipientName}}', '{{labDate}}', '{{cohortName}}', '{{stationInfo}}', '{{labUrl}}'],
  },
  {
    key: 'lab_reminder',
    name: 'Lab Reminder',
    category: 'Labs',
    description: 'Sent 1 day before a scheduled lab',
    variables: ['{{recipientName}}', '{{labDate}}', '{{cohortName}}', '{{labUrl}}'],
  },
  {
    key: 'shift_available',
    name: 'Shift Available',
    category: 'Scheduling',
    description: 'Sent when a new shift needs coverage',
    variables: ['{{recipientName}}', '{{shiftDate}}', '{{shiftDetails}}', '{{signupUrl}}'],
  },
  {
    key: 'shift_confirmed',
    name: 'Shift Confirmed',
    category: 'Scheduling',
    description: 'Sent when a shift signup is confirmed',
    variables: ['{{recipientName}}', '{{shiftDate}}', '{{shiftDetails}}'],
  },
  {
    key: 'site_visit_due',
    name: 'Site Visit Due',
    category: 'Clinical',
    description: 'Sent when clinical site visits are overdue',
    variables: ['{{recipientName}}', '{{siteName}}', '{{daysSinceVisit}}', '{{visitUrl}}'],
  },
  {
    key: 'daily_digest',
    name: 'Daily Digest',
    category: 'System',
    description: 'Daily summary of unread notifications',
    variables: ['{{recipientName}}', '{{date}}', '{{notificationGroups}}'],
  },
];

// Default subject lines for each template key
function getDefaultSubject(key: string): string {
  switch (key) {
    case 'task_assigned':   return '[PMI] New task assigned: {{taskTitle}}';
    case 'task_completed':  return '[PMI] Task completed: {{taskTitle}}';
    case 'lab_assigned':    return '[PMI] Lab assignment: {{cohortName}} on {{labDate}}';
    case 'lab_reminder':    return '[PMI] Reminder: Lab tomorrow – {{cohortName}}';
    case 'shift_available': return '[PMI] New shift available: {{shiftDate}}';
    case 'shift_confirmed': return '[PMI] Shift confirmed: {{shiftDate}}';
    case 'site_visit_due':  return '[PMI] Clinical site visit overdue – {{siteName}}';
    case 'daily_digest':    return '[PMI] Your daily digest for {{date}}';
    default:                return '[PMI] Notification';
  }
}

// Default HTML body for each template key (inner content only – no wrapper)
function getDefaultBody(key: string): string {
  switch (key) {
    case 'task_assigned':
      return `
        ${emailHeading('New Task Assigned')}
        ${emailParagraph('<strong>{{assignedBy}}</strong> has assigned you a new task:')}
        ${emailContentBox(`
          <h3 style="color:${EMAIL_COLORS.gray[900]};margin:0 0 8px 0;font-size:18px;">{{taskTitle}}</h3>
          <p style="color:${EMAIL_COLORS.gray[500]};margin:0;font-size:14px;">Due: {{dueDate}}</p>
        `)}
        ${emailButton('View Task', '{{taskUrl}}')}
      `;
    case 'task_completed':
      return `
        ${emailHeading('Task Completed')}
        ${emailParagraph('<strong>{{completedBy}}</strong> has completed the task:')}
        ${emailContentBox(`
          <h3 style="color:${EMAIL_COLORS.gray[900]};margin:0;font-size:18px;">{{taskTitle}}</h3>
        `, EMAIL_COLORS.success, '#ecfdf5')}
        ${emailButton('View Task', '{{taskUrl}}', EMAIL_COLORS.success)}
      `;
    case 'lab_assigned':
      return `
        ${emailHeading('Lab Assignment')}
        ${emailParagraph("You've been assigned to the following lab:")}
        ${emailContentBox(`
          <h3 style="color:${EMAIL_COLORS.gray[900]};margin:0 0 8px 0;font-size:18px;">{{cohortName}}</h3>
          <p style="color:${EMAIL_COLORS.gray[700]};margin:0;font-size:14px;">
            <strong>Date:</strong> {{labDate}}<br>
            <strong>Station:</strong> {{stationInfo}}
          </p>
        `, EMAIL_COLORS.warning, '#fef3c7')}
        ${emailButton('View Lab Details', '{{labUrl}}', EMAIL_COLORS.warning)}
      `;
    case 'lab_reminder':
      return `
        ${emailHeading('Lab Reminder')}
        ${emailParagraph('This is a reminder that you have a lab assignment tomorrow:')}
        ${emailContentBox(`
          <h3 style="color:${EMAIL_COLORS.gray[900]};margin:0 0 8px 0;font-size:18px;">{{cohortName}}</h3>
          <p style="color:${EMAIL_COLORS.gray[700]};margin:0;font-size:14px;">
            <strong>Date:</strong> {{labDate}}
          </p>
        `, EMAIL_COLORS.warning, '#fef3c7')}
        ${emailButton('View Lab Details', '{{labUrl}}', EMAIL_COLORS.warning)}
      `;
    case 'shift_available':
      return `
        ${emailHeading('New Shift Available')}
        ${emailParagraph('A new shift has been posted that you may be interested in:')}
        ${emailContentBox(`
          <p style="color:${EMAIL_COLORS.gray[700]};margin:0;font-size:14px;">
            <strong>Date:</strong> {{shiftDate}}<br>
            <strong>Details:</strong> {{shiftDetails}}
          </p>
        `, EMAIL_COLORS.accent, '#eff6ff')}
        ${emailButton('Sign Up for Shift', '{{signupUrl}}')}
      `;
    case 'shift_confirmed':
      return `
        ${emailHeading('Shift Confirmed')}
        ${emailParagraph('Your signup for the following shift has been confirmed:')}
        ${emailContentBox(`
          <p style="color:${EMAIL_COLORS.gray[700]};margin:0;font-size:14px;">
            <strong>Date:</strong> {{shiftDate}}<br>
            <strong>Details:</strong> {{shiftDetails}}
          </p>
        `, EMAIL_COLORS.success, '#ecfdf5')}
        ${emailButton('View My Schedule', `${APP_URL}/scheduling`, EMAIL_COLORS.success)}
      `;
    case 'site_visit_due':
      return `
        ${emailHeading('Clinical Site Visit Overdue')}
        ${emailParagraph('A clinical site visit is overdue:')}
        ${emailContentBox(`
          <p style="color:${EMAIL_COLORS.gray[700]};margin:0;font-size:14px;">
            <strong>Site:</strong> {{siteName}}<br>
            <strong>Days since last visit:</strong> {{daysSinceVisit}}
          </p>
        `, EMAIL_COLORS.error, '#fef2f2')}
        ${emailButton('View Site Visits', '{{visitUrl}}', EMAIL_COLORS.error)}
      `;
    case 'daily_digest':
      return `
        ${emailHeading('Your Daily Digest')}
        ${emailParagraph('Here is a summary of your notifications for {{date}}:')}
        <div style="margin:16px 0;">{{notificationGroups}}</div>
        ${emailButton('View All Notifications', `${APP_URL}/settings?tab=notifications`)}
      `;
    default:
      return emailParagraph('No default template content.');
  }
}

// ---------------------------------------------------------------------------
// Helper – get current user's role
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/email-templates
// Returns all template definitions merged with any stored customizations.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: customizations } = await supabase
      .from('email_template_customizations')
      .select('*');

    const customByKey: Record<string, {
      subject: string | null;
      body_html: string | null;
      is_active: boolean;
      updated_by: string;
      updated_at: string;
    }> = {};

    for (const c of customizations ?? []) {
      customByKey[c.template_key] = c;
    }

    const templates = TEMPLATE_DEFINITIONS.map((def) => {
      const custom = customByKey[def.key];
      return {
        ...def,
        default_subject: getDefaultSubject(def.key),
        default_body: getDefaultBody(def.key),
        custom_subject: custom?.subject ?? null,
        custom_body: custom?.body_html ?? null,
        is_customized: !!custom,
        is_active: custom?.is_active ?? true,
        updated_by: custom?.updated_by ?? null,
        updated_at: custom?.updated_at ?? null,
      };
    });

    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/email-templates
// Upsert a customization for a template key.
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { template_key, subject, body_html } = body as {
      template_key: string;
      subject?: string;
      body_html?: string;
    };

    if (!template_key) {
      return NextResponse.json({ error: 'template_key is required' }, { status: 400 });
    }

    const validKey = TEMPLATE_DEFINITIONS.find((d) => d.key === template_key);
    if (!validKey) {
      return NextResponse.json({ error: 'Invalid template_key' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('email_template_customizations')
      .upsert(
        {
          template_key,
          subject: subject ?? null,
          body_html: body_html ?? null,
          updated_by: currentUser.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'template_key' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, customization: data });
  } catch (error) {
    console.error('Error saving email template:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/email-templates
// Remove a customization (reverts to code default).
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { template_key } = body as { template_key: string };

    if (!template_key) {
      return NextResponse.json({ error: 'template_key is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('email_template_customizations')
      .delete()
      .eq('template_key', template_key);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting email template customization:', error);
    return NextResponse.json({ error: 'Failed to delete customization' }, { status: 500 });
  }
}

// Export helpers for use in the test route
export { getDefaultSubject, getDefaultBody };
