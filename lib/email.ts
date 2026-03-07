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
 * Send an email using the Resend API.
 * Uses the centralized wrapInEmailTemplate for consistent branding.
 * Logs the result to email_log for delivery tracking.
 * @param emailData - Email data including recipient, template, and template data
 * @returns Result object with success status, optional error message, and email ID
 */
export async function sendEmail(emailData: EmailData): Promise<{ success: boolean; error?: string; id?: string }> {
  const resend = getResend();

  if (!resend) {
    return { success: true, id: 'mock-' + Date.now() };
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
