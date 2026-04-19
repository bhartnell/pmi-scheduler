// Email service using Resend
// npm install resend

import { Resend } from 'resend';
import { wrapInEmailTemplate } from '@/lib/email-templates';
import { getSupabaseAdmin } from '@/lib/supabase';

// Lazy initialization to avoid build errors when env vars aren't set
let resendClient: Resend | null = null;

/**
 * Get or create the Resend email client.
 * @returns Resend client instance or null if API key not configured
 */
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - emails will not be sent');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';
const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

// Email template types
export type EmailTemplate =
  | 'task_assigned'
  | 'task_completed'
  | 'shift_available'
  | 'shift_confirmed'
  | 'lab_assigned'
  | 'lab_reminder'
  | 'skill_evaluation'
  | 'scenario_feedback'
  | 'general';

interface EmailData {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, string | number | boolean | undefined>;
}

/**
 * Generate a styled button for email templates.
 * @param text - Button text
 * @param url - Button destination URL
 * @param color - Background color (default: blue)
 * @returns HTML button component
 */
function emailButton(text: string, url: string, color: string = '#2563eb'): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${color}; border-radius: 6px;">
          <a href="${url}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

// Template generators
const templates: Record<EmailTemplate, (data: Record<string, unknown>) => { subject: string; html: string }> = {
  task_assigned: (data) => ({
    subject: `[PMI] Task assigned: ${data.title}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        New Task Assigned
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        <strong>${data.assignerName}</strong> has assigned you a new task:
      </p>
      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${data.title}
        </h3>
        ${data.description ? `<p style="color: #6b7280; margin: 0; font-size: 14px;">${data.description}</p>` : ''}
        ${data.dueDate ? `<p style="color: #dc2626; margin: 8px 0 0 0; font-size: 14px;"><strong>Due:</strong> ${data.dueDate}</p>` : ''}
      </div>
      ${emailButton('View Task', `${APP_URL}/tasks/${data.taskId}`)}
    `
  }),

  task_completed: (data) => ({
    subject: `[PMI] Task completed: ${data.title}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Task Completed
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        <strong>${data.assigneeName}</strong> has completed the task:
      </p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981;">
        <h3 style="color: #111827; margin: 0; font-size: 18px;">
          ${data.title}
        </h3>
        ${data.completionNotes ? `<p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;"><strong>Notes:</strong> ${data.completionNotes}</p>` : ''}
      </div>
      ${emailButton('View Task', `${APP_URL}/tasks/${data.taskId}`, '#10b981')}
    `
  }),

  shift_available: (data) => ({
    subject: `[PMI] New shift available: ${data.title}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        New Shift Available
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        A new shift has been posted that you may be interested in:
      </p>
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #3b82f6;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${data.title}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${data.date}<br>
          <strong>Time:</strong> ${data.startTime} - ${data.endTime}
        </p>
        ${data.location ? `<p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;"><strong>Location:</strong> ${data.location}</p>` : ''}
      </div>
      ${emailButton('Sign Up for Shift', `${APP_URL}/scheduling/shifts`)}
    `
  }),

  shift_confirmed: (data) => ({
    subject: `[PMI] Shift confirmed: ${data.date}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Shift Signup Confirmed
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        Your signup for the following shift has been confirmed:
      </p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${data.title}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${data.date}<br>
          <strong>Time:</strong> ${data.startTime} - ${data.endTime}
        </p>
        ${data.location ? `<p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;"><strong>Location:</strong> ${data.location}</p>` : ''}
      </div>
      ${emailButton('View My Schedule', `${APP_URL}/scheduling`, '#10b981')}
    `
  }),

  lab_assigned: (data) => ({
    subject: `[PMI] Lab assignment: ${data.labName}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Lab Assignment
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        You've been assigned to the following lab:
      </p>
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${data.labName}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${data.date}<br>
          ${data.time ? `<strong>Time:</strong> ${data.time}<br>` : ''}
          ${data.role ? `<strong>Role:</strong> ${data.role}` : ''}
        </p>
      </div>
      ${emailButton('View Lab Details', `${APP_URL}/lab-management/schedule`, '#f59e0b')}
    `
  }),

  lab_reminder: (data) => ({
    subject: `[PMI] Reminder: ${data.labName} tomorrow`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Lab Reminder
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        This is a reminder that you have a lab assignment tomorrow:
      </p>
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 18px;">
          ${data.labName}
        </h3>
        <p style="color: #374151; margin: 0; font-size: 14px;">
          <strong>Date:</strong> ${data.date}<br>
          ${data.time ? `<strong>Time:</strong> ${data.time}<br>` : ''}
          ${data.role ? `<strong>Role:</strong> ${data.role}` : ''}
        </p>
      </div>
      ${emailButton('View Lab Details', `${APP_URL}/lab-management/schedule`, '#f59e0b')}
    `
  }),

  scenario_feedback: (data) => ({
    subject: `[PMI] Scenario Feedback — ${data.scenarioTitle}${data.date ? ` (${data.date})` : ''}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Scenario Feedback
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        Hi ${data.studentFirstName},
      </p>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">
        Here is the team feedback from your scenario evaluation:
      </p>

      ${data.patientAge || data.chiefComplaint ? `
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">SCENARIO SUMMARY</h3>
          ${data.patientAge ? `<p style="color: #374151; margin: 0; font-size: 13px;"><strong>Patient:</strong> ${data.patientAge}${data.patientSex ? ` ${data.patientSex}` : ''}</p>` : ''}
          ${data.chiefComplaint ? `<p style="color: #374151; margin: 0; font-size: 13px;"><strong>Chief Complaint:</strong> ${data.chiefComplaint}</p>` : ''}
          ${data.dispatchInfo ? `<p style="color: #374151; margin: 0; font-size: 13px;"><strong>Dispatch:</strong> ${data.dispatchInfo}</p>` : ''}
        </div>
      ` : ''}

      <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #3b82f6;">
        <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">TEAM PERFORMANCE</h3>
        <p style="color: #374151; margin: 0 0 8px 0; font-size: 13px;"><strong>Team Leader:</strong> ${data.teamLeaderName || 'N/A'}</p>
        ${data.criteriaRatings ? `<div style="font-size: 13px; color: #374151; line-height: 1.8;">${data.criteriaRatings}</div>` : ''}
        <p style="color: #374151; margin: 8px 0 0 0; font-size: 13px;"><strong>Overall Score:</strong> ${data.overallScore || 'N/A'}</p>
      </div>

      ${data.criticalActions ? `
        <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #ef4444;">
          <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">CRITICAL ACTIONS</h3>
          <div style="font-size: 13px; color: #374151; line-height: 1.8;">${data.criticalActions}</div>
        </div>
      ` : ''}

      ${data.comments ? `
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #111827; margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">EVALUATOR COMMENTS</h3>
          <p style="color: #374151; margin: 0; font-size: 13px;">${data.comments}</p>
        </div>
      ` : ''}

      <p style="color: #6b7280; margin: 16px 0 0 0; font-size: 13px;">
        Evaluator: ${data.evaluatorName}
      </p>
      <p style="color: #dc2626; margin: 12px 0 0 0; font-size: 13px; font-weight: 600;">
        Remember to chart this scenario in Platinum Planner.
      </p>
    `
  }),

  skill_evaluation: (data) => ({
    subject: `[PMI] Skill Evaluation — ${data.skillName}${data.date ? ` (${data.date})` : ''}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        Skill Evaluation Results
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        Hi ${data.studentFirstName},
      </p>
      <p style="color: #374151; margin: 0 0 12px 0; font-size: 14px; line-height: 1.5;">
        Here are your skill evaluation results${data.date ? ` from ${data.date}` : ''}:
      </p>

      <div style="background-color: ${data.result === 'pass' ? '#ecfdf5' : data.result === 'fail' ? '#fef2f2' : '#fffbeb'}; border-radius: 8px; padding: 12px 16px; margin: 12px 0; border-left: 4px solid ${data.result === 'pass' ? '#10b981' : data.result === 'fail' ? '#ef4444' : '#f59e0b'};">
        <h3 style="color: #111827; margin: 0 0 4px 0; font-size: 16px;">${data.skillName}</h3>
        <p style="color: #374151; margin: 0; font-size: 13px;">
          <strong>Mode:</strong> ${data.evaluationType === 'formative' ? 'Formative' : 'Final Competency'} &nbsp;|&nbsp;
          <strong>Result:</strong> <span style="font-weight: 700; color: ${data.result === 'pass' ? '#10b981' : data.result === 'fail' ? '#ef4444' : '#f59e0b'};">${data.result === 'pass' ? 'PASS' : data.result === 'fail' ? 'FAIL' : 'NEEDS IMPROVEMENT'}</span>
        </p>
      </div>

      ${data.scoreSheetHtml || `
        <p style="color: #374151; margin: 8px 0; font-size: 13px;">
          <strong>Steps Completed:</strong> ${data.stepsCompleted || 'N/A'}
          ${data.criticalSteps ? ` &nbsp;|&nbsp; <strong>Critical Steps:</strong> ${data.criticalSteps}` : ''}
        </p>
      `}

      ${data.notes ? `
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin: 12px 0;">
          <p style="color: #374151; margin: 0; font-size: 13px;">
            <strong>Evaluator Comments:</strong> ${data.notes}
          </p>
        </div>
      ` : ''}

      <p style="color: #6b7280; margin: 16px 0 0 0; font-size: 13px;">
        Evaluator: ${data.evaluatorName}
      </p>
      <p style="color: #9ca3af; margin: 8px 0 0 0; font-size: 12px; font-style: italic;">
        — PMI Paramedic Program
      </p>
    `
  }),

  general: (data) => ({
    subject: `[PMI] ${data.subject || 'Notification'}`,
    html: `
      <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px;">
        ${data.title || 'Notification'}
      </h2>
      <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
        ${data.message}
      </p>
      ${data.actionUrl ? emailButton(String(data.actionText || 'View'), String(data.actionUrl)) : ''}
    `
  })
};

/**
 * Log an email send result to the email_log table.
 * Non-fatal — errors are logged but do not throw.
 */
async function logEmailSend(params: {
  to: string;
  subject: string;
  template: string;
  status: 'sent' | 'failed';
  resendId?: string;
  error?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('email_log').insert({
      to_email: params.to,
      subject: params.subject,
      template: params.template,
      status: params.status,
      resend_id: params.resendId ?? null,
      error: params.error ?? null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error('Failed to log email send:', err);
  }
}

/**
 * NREMT-day kill switch.
 *
 * Student-facing evaluation result emails (`skill_evaluation` and
 * `scenario_feedback`) must NEVER be delivered on a day where any lab
 * day is flagged `is_nremt_testing = true`. This prevents partial /
 * formative / retake results from leaking to students mid-test while
 * the instructor is still grading.
 *
 * We cache the check for 30s so a batch send doesn't hammer the DB.
 * The cache is intentionally short — if staff toggles `is_nremt_testing`
 * off mid-day the queue will catch up within half a minute.
 *
 * Routes that bypass the Resend client directly (`resend.emails.send`)
 * are NOT covered by this guard — they must call `sendEmail` instead,
 * or we need to add the same check at the call site. Audit with:
 *   grep -rn "resend\\.emails\\.send" app/
 */
const STUDENT_EVAL_TEMPLATES: ReadonlySet<EmailTemplate> = new Set([
  'skill_evaluation',
  'scenario_feedback',
]);
let nremtLockCache: { value: boolean; fetchedAt: number } | null = null;
const NREMT_LOCK_TTL_MS = 30_000;

/**
 * Public check for other routes that bypass the central sendEmail()
 * (i.e. they use their own Resend client for custom templates). These
 * routes should still respect the NREMT kill switch — call this before
 * sending and short-circuit when it returns true. Exported 2026-04-19
 * after auditing 6 bypass routes that were leaking during NREMT exams.
 */
export async function isNremtTestingActiveToday(): Promise<boolean> {
  return _isNremtTestingActiveToday();
}

async function _isNremtTestingActiveToday(): Promise<boolean> {
  const now = Date.now();
  if (nremtLockCache && now - nremtLockCache.fetchedAt < NREMT_LOCK_TTL_MS) {
    return nremtLockCache.value;
  }
  try {
    const supabase = getSupabaseAdmin();
    // Arizona (MST, no DST) — PMI is in Tucson. Using AZ-local date so a
    // send at 23:30 UTC (16:30 MST) still resolves to "today" correctly.
    const azDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Phoenix',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()); // YYYY-MM-DD
    const { data, error } = await supabase
      .from('lab_days')
      .select('id')
      .eq('is_nremt_testing', true)
      .eq('date', azDate)
      .limit(1);
    if (error) {
      console.error('[email guard] failed to check is_nremt_testing; failing CLOSED:', error);
      // Fail-closed: if we can't confirm it's safe, block the send.
      nremtLockCache = { value: true, fetchedAt: now };
      return true;
    }
    const active = !!(data && data.length > 0);
    nremtLockCache = { value: active, fetchedAt: now };
    return active;
  } catch (err) {
    console.error('[email guard] exception checking is_nremt_testing; failing CLOSED:', err);
    nremtLockCache = { value: true, fetchedAt: now };
    return true;
  }
}

/**
 * Send an email using the Resend API.
 * Uses the centralized wrapInEmailTemplate for consistent branding.
 * Logs the result to email_log for delivery tracking.
 *
 * NREMT-day guard: if any `lab_days` row for today has
 * `is_nremt_testing = true`, all `skill_evaluation` and
 * `scenario_feedback` sends are blocked and logged as 'failed'.
 *
 * @param emailData - Email data including recipient, template, and template data
 * @returns Result object with success status, optional error message, and email ID
 */
export async function sendEmail(emailData: EmailData): Promise<{ success: boolean; error?: string; id?: string }> {
  // NREMT-day kill switch — runs BEFORE any Resend call, before client init.
  // Blocks student-facing evaluation emails whenever NREMT testing is active.
  if (STUDENT_EVAL_TEMPLATES.has(emailData.template)) {
    const blocked = await isNremtTestingActiveToday();
    if (blocked) {
      const msg = 'Blocked: NREMT testing is active today. Student result emails are disabled.';
      console.warn(`[email guard] ${msg} template=${emailData.template} to=${emailData.to}`);
      await logEmailSend({
        to: emailData.to,
        subject: `[BLOCKED] ${emailData.template}`,
        template: emailData.template,
        status: 'failed',
        error: msg,
      });
      return { success: false, error: msg };
    }
  }

  const resend = getResend();

  if (!resend) {
    console.error('RESEND_API_KEY not configured — email NOT sent to:', emailData.to);
    return { success: false, error: 'Email service not configured (RESEND_API_KEY missing)' };
  }

  try {
    const template = templates[emailData.template];
    const { subject, html } = template(emailData.data);
    const preferencesUrl = `${APP_URL}/settings?tab=notifications`;
    const fullHtml = wrapInEmailTemplate(html, preferencesUrl);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: emailData.to,
      subject,
      html: fullHtml
    });

    if (error) {
      console.error('Resend error:', error);
      await logEmailSend({
        to: emailData.to,
        subject,
        template: emailData.template,
        status: 'failed',
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logEmailSend({
      to: emailData.to,
      subject,
      template: emailData.template,
      status: 'sent',
      resendId: data?.id,
    });

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await logEmailSend({
      to: emailData.to,
      subject: `[PMI] ${emailData.template}`,
      template: emailData.template,
      status: 'failed',
      error: errMsg,
    });
    return { success: false, error: errMsg };
  }
}

/**
 * Send task assignment notification email.
 * @param toEmail - Recipient email address
 * @param data - Task information
 */
export async function sendTaskAssignedEmail(
  toEmail: string,
  data: { taskId: string; title: string; assignerName: string; description?: string; dueDate?: string }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] Task assigned: ${data.title}`,
    template: 'task_assigned',
    data
  });
}

/**
 * Send task completion notification email.
 * @param toEmail - Recipient email address
 * @param data - Task completion information
 */
export async function sendTaskCompletedEmail(
  toEmail: string,
  data: { taskId: string; title: string; assigneeName: string; completionNotes?: string }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] Task completed: ${data.title}`,
    template: 'task_completed',
    data
  });
}

/**
 * Send new shift available notification email.
 * @param toEmail - Recipient email address
 * @param data - Shift information
 */
export async function sendShiftAvailableEmail(
  toEmail: string,
  data: { title: string; date: string; startTime: string; endTime: string; location?: string }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] New shift available: ${data.title}`,
    template: 'shift_available',
    data
  });
}

/**
 * Send shift signup confirmation email.
 * @param toEmail - Recipient email address
 * @param data - Shift confirmation information
 */
export async function sendShiftConfirmedEmail(
  toEmail: string,
  data: { title: string; date: string; startTime: string; endTime: string; location?: string }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] Shift confirmed: ${data.date}`,
    template: 'shift_confirmed',
    data
  });
}

/**
 * Send lab assignment notification email.
 * @param toEmail - Recipient email address
 * @param data - Lab assignment information
 */
export async function sendLabAssignedEmail(
  toEmail: string,
  data: { labName: string; date: string; time?: string; role?: string }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] Lab assignment: ${data.labName}`,
    template: 'lab_assigned',
    data
  });
}

/**
 * Send lab reminder email (for upcoming labs).
 * @param toEmail - Recipient email address
 * @param data - Lab reminder information
 */
export async function sendLabReminderEmail(
  toEmail: string,
  data: { labName: string; date: string; time?: string; role?: string }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] Reminder: ${data.labName} tomorrow`,
    template: 'lab_reminder',
    data
  });
}

/**
 * Send skill evaluation results email to a student.
 * @param toEmail - Student email address
 * @param data - Evaluation information
 */
export async function sendSkillEvaluationEmail(
  toEmail: string,
  data: {
    evaluationId: string;
    studentFirstName: string;
    skillName: string;
    evaluationType: string;
    result: string;
    stepsCompleted?: string;
    criticalSteps?: string;
    notes?: string;
    evaluatorName: string;
    date?: string;
    scoreSheetHtml?: string;
  }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] Skill Evaluation — ${data.skillName}${data.date ? ` (${data.date})` : ''}`,
    template: 'skill_evaluation',
    data
  });
}

/**
 * Send scenario feedback email to a student (team member).
 */
export async function sendScenarioFeedbackEmail(
  toEmail: string,
  data: {
    studentFirstName: string;
    scenarioTitle: string;
    patientAge?: string;
    patientSex?: string;
    chiefComplaint?: string;
    dispatchInfo?: string;
    teamLeaderName?: string;
    criteriaRatings?: string;
    overallScore?: string;
    criticalActions?: string;
    comments?: string;
    evaluatorName: string;
    date?: string;
  }
) {
  return sendEmail({
    to: toEmail,
    subject: `[PMI] Scenario Feedback — ${data.scenarioTitle}${data.date ? ` (${data.date})` : ''}`,
    template: 'scenario_feedback',
    data
  });
}
