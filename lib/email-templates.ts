/**
 * Email Templates Module
 *
 * Centralized email templates for the PMI EMS Scheduler.
 * Uses inline styles for email client compatibility.
 */

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

// ==============================================
// Base Template Components
// ==============================================

/**
 * Brand colors used in email templates
 */
export const EMAIL_COLORS = {
  primary: '#1e3a5f',     // PMI dark blue
  accent: '#2563eb',      // Link blue
  success: '#10b981',     // Green
  warning: '#f59e0b',     // Amber
  error: '#dc2626',       // Red
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    500: '#6b7280',
    700: '#374151',
    900: '#111827',
  },
} as const;

/**
 * Reusable button component for email CTAs
 */
export function emailButton(
  text: string,
  url: string,
  color: string = EMAIL_COLORS.accent
): string {
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

/**
 * Highlighted content box for emphasis
 */
export function emailContentBox(
  content: string,
  borderColor: string = EMAIL_COLORS.accent,
  bgColor: string = EMAIL_COLORS.gray[100]
): string {
  return `
    <div style="background-color: ${bgColor}; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid ${borderColor};">
      ${content}
    </div>
  `;
}

/**
 * Section header styling
 */
export function emailHeading(text: string, level: 2 | 3 = 2): string {
  const sizes = { 2: '20px', 3: '18px' };
  return `
    <h${level} style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 ${level === 2 ? '16px' : '8px'} 0; font-size: ${sizes[level]};">
      ${text}
    </h${level}>
  `;
}

/**
 * Paragraph text styling
 */
export function emailParagraph(text: string, muted: boolean = false): string {
  return `
    <p style="color: ${muted ? EMAIL_COLORS.gray[500] : EMAIL_COLORS.gray[700]}; margin: 0 0 16px 0; font-size: ${muted ? '14px' : '16px'}; line-height: 1.5;">
      ${text}
    </p>
  `;
}

/**
 * Key-value detail line
 */
export function emailDetail(label: string, value: string): string {
  return `<strong>${label}:</strong> ${value}`;
}

// ==============================================
// Base Email Wrapper
// ==============================================

/**
 * Wraps email content in the base template with header/footer
 */
export function wrapInEmailTemplate(content: string, preferencesUrl?: string): string {
  const settingsUrl = preferencesUrl || `${APP_URL}/settings?tab=notifications`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PMI Paramedic Tools</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.gray[100]}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${EMAIL_COLORS.gray[100]}; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${EMAIL_COLORS.primary}; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">
                PMI Paramedic Tools
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${EMAIL_COLORS.gray[50]}; padding: 24px; border-top: 1px solid ${EMAIL_COLORS.gray[200]};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: ${EMAIL_COLORS.gray[500]}; font-size: 12px; text-align: center;">
                    <p style="margin: 0 0 8px 0;">
                      Pima Medical Institute - Paramedic Program
                    </p>
                    <p style="margin: 0;">
                      <a href="${settingsUrl}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">
                        Manage email preferences
                      </a>
                      &nbsp;|&nbsp;
                      <a href="${APP_URL}" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">
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

// ==============================================
// Notification Email Templates
// ==============================================

/**
 * Generic notification email template
 */
export function notificationEmailTemplate(data: {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}): string {
  return `
    ${emailHeading(data.title)}
    ${emailParagraph(data.message)}
    ${data.actionUrl ? emailButton(data.actionText || 'View', data.actionUrl) : ''}
  `;
}

/**
 * Task notification templates
 */
export const taskTemplates = {
  assigned: (data: {
    taskId: string;
    title: string;
    assignerName: string;
    description?: string;
    dueDate?: string;
  }) => `
    ${emailHeading('New Task Assigned')}
    ${emailParagraph(`<strong>${data.assignerName}</strong> has assigned you a new task:`)}
    ${emailContentBox(`
      <h3 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 18px;">
        ${data.title}
      </h3>
      ${data.description ? `<p style="color: ${EMAIL_COLORS.gray[500]}; margin: 0; font-size: 14px;">${data.description}</p>` : ''}
      ${data.dueDate ? `<p style="color: ${EMAIL_COLORS.error}; margin: 8px 0 0 0; font-size: 14px;"><strong>Due:</strong> ${data.dueDate}</p>` : ''}
    `)}
    ${emailButton('View Task', `${APP_URL}/tasks/${data.taskId}`)}
  `,

  completed: (data: {
    taskId: string;
    title: string;
    assigneeName: string;
    completionNotes?: string;
  }) => `
    ${emailHeading('Task Completed ✓')}
    ${emailParagraph(`<strong>${data.assigneeName}</strong> has completed the task:`)}
    ${emailContentBox(`
      <h3 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0; font-size: 18px;">
        ${data.title}
      </h3>
      ${data.completionNotes ? `<p style="color: ${EMAIL_COLORS.gray[500]}; margin: 8px 0 0 0; font-size: 14px;"><strong>Notes:</strong> ${data.completionNotes}</p>` : ''}
    `, EMAIL_COLORS.success, '#ecfdf5')}
    ${emailButton('View Task', `${APP_URL}/tasks/${data.taskId}`, EMAIL_COLORS.success)}
  `,
};

/**
 * Scheduling notification templates
 */
export const schedulingTemplates = {
  shiftAvailable: (data: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
  }) => `
    ${emailHeading('New Shift Available')}
    ${emailParagraph('A new shift has been posted that you may be interested in:')}
    ${emailContentBox(`
      <h3 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 18px;">
        ${data.title}
      </h3>
      <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0; font-size: 14px;">
        ${emailDetail('Date', data.date)}<br>
        ${emailDetail('Time', `${data.startTime} - ${data.endTime}`)}
      </p>
      ${data.location ? `<p style="color: ${EMAIL_COLORS.gray[500]}; margin: 8px 0 0 0; font-size: 14px;">${emailDetail('Location', data.location)}</p>` : ''}
    `, EMAIL_COLORS.accent, '#eff6ff')}
    ${emailButton('Sign Up for Shift', `${APP_URL}/scheduling/shifts`)}
  `,

  shiftConfirmed: (data: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
  }) => `
    ${emailHeading('Shift Signup Confirmed ✓')}
    ${emailParagraph('Your signup for the following shift has been confirmed:')}
    ${emailContentBox(`
      <h3 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 18px;">
        ${data.title}
      </h3>
      <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0; font-size: 14px;">
        ${emailDetail('Date', data.date)}<br>
        ${emailDetail('Time', `${data.startTime} - ${data.endTime}`)}
      </p>
      ${data.location ? `<p style="color: ${EMAIL_COLORS.gray[500]}; margin: 8px 0 0 0; font-size: 14px;">${emailDetail('Location', data.location)}</p>` : ''}
    `, EMAIL_COLORS.success, '#ecfdf5')}
    ${emailButton('View My Schedule', `${APP_URL}/scheduling`, EMAIL_COLORS.success)}
  `,
};

/**
 * Lab notification templates
 */
export const labTemplates = {
  assigned: (data: {
    labName: string;
    date: string;
    time?: string;
    role?: string;
  }) => `
    ${emailHeading('Lab Assignment')}
    ${emailParagraph("You've been assigned to the following lab:")}
    ${emailContentBox(`
      <h3 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 18px;">
        ${data.labName}
      </h3>
      <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0; font-size: 14px;">
        ${emailDetail('Date', data.date)}
        ${data.time ? `<br>${emailDetail('Time', data.time)}` : ''}
        ${data.role ? `<br>${emailDetail('Role', data.role)}` : ''}
      </p>
    `, EMAIL_COLORS.warning, '#fef3c7')}
    ${emailButton('View Lab Details', `${APP_URL}/lab-management/schedule`, EMAIL_COLORS.warning)}
  `,

  reminder: (data: {
    labName: string;
    date: string;
    time?: string;
    role?: string;
  }) => `
    ${emailHeading('Lab Reminder')}
    ${emailParagraph('This is a reminder that you have a lab assignment tomorrow:')}
    ${emailContentBox(`
      <h3 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 18px;">
        ${data.labName}
      </h3>
      <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0; font-size: 14px;">
        ${emailDetail('Date', data.date)}
        ${data.time ? `<br>${emailDetail('Time', data.time)}` : ''}
        ${data.role ? `<br>${emailDetail('Role', data.role)}` : ''}
      </p>
    `, EMAIL_COLORS.warning, '#fef3c7')}
    ${emailButton('View Lab Details', `${APP_URL}/lab-management/schedule`, EMAIL_COLORS.warning)}
  `,
};

/**
 * Clinical notification templates
 */
export const clinicalTemplates = {
  siteVisitDue: (data: {
    studentName: string;
    siteName: string;
    dueDate: string;
  }) => `
    ${emailHeading('Clinical Site Visit Due')}
    ${emailParagraph('A student requires a clinical site visit:')}
    ${emailContentBox(`
      <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0; font-size: 14px;">
        ${emailDetail('Student', data.studentName)}<br>
        ${emailDetail('Site', data.siteName)}<br>
        ${emailDetail('Due', data.dueDate)}
      </p>
    `, EMAIL_COLORS.error, '#fef2f2')}
    ${emailButton('View Site Visits', `${APP_URL}/clinical/site-visits`, EMAIL_COLORS.error)}
  `,
};
