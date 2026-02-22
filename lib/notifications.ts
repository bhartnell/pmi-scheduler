import { getSupabaseAdmin } from './supabase';
import {
  sendTaskAssignedEmail,
  sendTaskCompletedEmail,
  sendShiftAvailableEmail,
  sendShiftConfirmedEmail,
  sendLabAssignedEmail,
  sendLabReminderEmail,
  EmailTemplate
} from './email';

// Create Supabase client lazily to avoid build-time errors
// Email preferences interface
interface EmailPreferences {
  enabled: boolean;
  mode: 'immediate' | 'daily_digest' | 'off';
  digest_time: string;
  categories: {
    tasks: boolean;
    labs: boolean;
    scheduling: boolean;
    feedback: boolean;
    clinical: boolean;
    system: boolean;
  };
}

// Default email preferences — emails enabled out of the box for all users
// Users can opt-out via settings if they want
const DEFAULT_EMAIL_PREFS: EmailPreferences = {
  enabled: true,
  mode: 'immediate',
  digest_time: '08:00',
  categories: {
    tasks: true,
    labs: true,
    scheduling: true,
    feedback: true,
    clinical: true,
    system: true
  }
};

/**
 * Get user's email preferences
 * If no record exists, returns defaults with emails enabled.
 * Only returns disabled if user has explicitly set that preference.
 */
async function getUserEmailPrefs(userEmail: string): Promise<EmailPreferences> {
  try {
    const supabase = getSupabaseAdmin();

    // user_preferences uses user_email (TEXT, UNIQUE) as its key
    const { data, error } = await supabase
      .from('user_preferences')
      .select('email_preferences')
      .ilike('user_email', userEmail)
      .single();

    console.log('[EMAIL PREFS] Query for:', userEmail, '| error:', error?.message || 'none', '| data:', JSON.stringify(data));

    // No record found — user hasn't set preferences, use defaults (enabled)
    if (error || !data?.email_preferences) {
      console.log('[EMAIL PREFS] No record/prefs found, returning DEFAULTS (enabled=true)');
      return DEFAULT_EMAIL_PREFS;
    }

    // User has explicit preferences — respect them
    console.log('[EMAIL PREFS] Found explicit prefs:', JSON.stringify(data.email_preferences));
    return data.email_preferences;
  } catch (err) {
    console.error('[EMAIL PREFS] Exception:', err);
    return DEFAULT_EMAIL_PREFS;
  }
}

/**
 * Check if email should be sent for this notification
 */
async function shouldSendEmail(
  userEmail: string,
  category: NotificationCategory
): Promise<boolean> {
  const prefs = await getUserEmailPrefs(userEmail);

  console.log('[SHOULD SEND] Checking for:', userEmail, '| category:', category, '| enabled:', prefs.enabled, '| mode:', prefs.mode, '| categories:', JSON.stringify(prefs.categories));

  if (!prefs.enabled || prefs.mode === 'off') {
    console.log('[SHOULD SEND] BLOCKED - enabled:', prefs.enabled, '| mode:', prefs.mode);
    return false;
  }

  if (prefs.mode === 'daily_digest') {
    console.log('[SHOULD SEND] BLOCKED - daily_digest mode');
    return false;
  }

  // Check if category is enabled
  const result = prefs.categories[category] ?? false;
  console.log('[SHOULD SEND] Category', category, '=', result);
  return result;
}

/**
 * Queue an email for later processing (for digest mode or retries)
 */
async function queueEmail(
  userEmail: string,
  template: string,
  templateData: Record<string, unknown>,
  subject: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    // Get user ID
    const { data: user } = await supabase
      .from('lab_users')
      .select('id')
      .ilike('email', userEmail)
      .single();

    await supabase.from('email_queue').insert({
      user_id: user?.id || null,
      to_email: userEmail,
      subject,
      template,
      template_data: templateData,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error queueing email:', error);
  }
}

export type NotificationType =
  | 'lab_assignment'
  | 'lab_reminder'
  | 'feedback_new'
  | 'feedback_resolved'
  | 'task_assigned'
  | 'task_completed'
  | 'task_comment'
  | 'role_approved'
  | 'shift_available'
  | 'shift_confirmed'
  | 'clinical_hours'
  | 'compliance_due'
  | 'general';

export type NotificationCategory = 'tasks' | 'labs' | 'scheduling' | 'feedback' | 'clinical' | 'system';

// Map notification types to categories
export const TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  task_assigned: 'tasks',
  task_completed: 'tasks',
  task_comment: 'tasks',
  lab_assignment: 'labs',
  lab_reminder: 'labs',
  shift_available: 'scheduling',
  shift_confirmed: 'scheduling',
  feedback_new: 'feedback',
  feedback_resolved: 'feedback',
  clinical_hours: 'clinical',
  compliance_due: 'clinical',
  role_approved: 'system',
  general: 'system',
};

interface CreateNotificationParams {
  userEmail: string;
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  linkUrl?: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification({
  userEmail,
  title,
  message,
  type = 'general',
  category,
  linkUrl,
  referenceType,
  referenceId,
}: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    // Use provided category or derive from type
    const notificationCategory = category || TYPE_TO_CATEGORY[type] || 'system';

    const { error } = await supabase.from('user_notifications').insert({
      user_email: userEmail,
      title,
      message,
      type,
      category: notificationCategory,
      link_url: linkUrl || null,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return { success: false, error: error?.message };
  }
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications(
  notifications: CreateNotificationParams[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const records = notifications.map(n => {
      const notificationType = n.type || 'general';
      const notificationCategory = n.category || TYPE_TO_CATEGORY[notificationType] || 'system';
      return {
        user_email: n.userEmail,
        title: n.title,
        message: n.message,
        type: notificationType,
        category: notificationCategory,
        link_url: n.linkUrl || null,
        reference_type: n.referenceType || null,
        reference_id: n.referenceId || null,
      };
    });

    const { error } = await supabase.from('user_notifications').insert(records);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error creating bulk notifications:', error);
    return { success: false, error: error?.message };
  }
}

/**
 * Notify instructor when assigned to a station
 */
export async function notifyInstructorAssigned(
  instructorEmail: string,
  stationInfo: {
    stationId: string;
    stationTitle: string;
    labDate: string;
    cohortName: string;
    startTime?: string;
    role?: string;
  }
): Promise<void> {
  const formattedDate = new Date(stationInfo.labDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // Create in-app notification
  await createNotification({
    userEmail: instructorEmail,
    title: `Assigned to ${stationInfo.stationTitle}`,
    message: `You were assigned to a station for ${stationInfo.cohortName} on ${formattedDate}`,
    type: 'lab_assignment',
    linkUrl: `/lab-management/grade/station/${stationInfo.stationId}`,
    referenceType: 'lab_station',
    referenceId: stationInfo.stationId,
  });

  // Send email if enabled
  if (await shouldSendEmail(instructorEmail, 'labs')) {
    await sendLabAssignedEmail(instructorEmail, {
      labName: `${stationInfo.stationTitle} - ${stationInfo.cohortName}`,
      date: formattedDate,
      time: stationInfo.startTime ? formatTime(stationInfo.startTime) : undefined,
      role: stationInfo.role
    });
  }
}

/**
 * Notify admins when new feedback is submitted
 */
export async function notifyAdminsNewFeedback(
  feedbackInfo: {
    feedbackId: string;
    title: string;
    type: string;
    submittedBy: string;
  }
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    // Get all admin and superadmin users
    const { data: admins } = await supabase
      .from('lab_users')
      .select('email')
      .in('role', ['admin', 'superadmin'])
      .eq('is_active', true);

    if (!admins || admins.length === 0) return;

    const notifications = admins.map(admin => ({
      userEmail: admin.email,
      title: `New ${feedbackInfo.type} report`,
      message: `${feedbackInfo.submittedBy.split('@')[0]} submitted: ${feedbackInfo.title}`,
      type: 'feedback_new' as NotificationType,
      linkUrl: `/lab-management/admin/feedback?id=${feedbackInfo.feedbackId}`,
      referenceType: 'feedback_report',
      referenceId: feedbackInfo.feedbackId,
    }));

    await createBulkNotifications(notifications);
  } catch (error) {
    console.error('Error notifying admins of new feedback:', error);
  }
}

/**
 * Notify user when their feedback is resolved
 */
export async function notifyFeedbackResolved(
  reporterEmail: string,
  feedbackInfo: {
    feedbackId: string;
    title: string;
  }
): Promise<void> {
  await createNotification({
    userEmail: reporterEmail,
    title: 'Feedback resolved',
    message: `Your feedback "${feedbackInfo.title}" has been resolved`,
    type: 'feedback_resolved',
    linkUrl: `/lab-management/admin/feedback?id=${feedbackInfo.feedbackId}`,
    referenceType: 'feedback_report',
    referenceId: feedbackInfo.feedbackId,
  });
}

/**
 * Notify user of upcoming lab (reminder)
 */
export async function notifyLabReminder(
  instructorEmail: string,
  labInfo: {
    stationId: string;
    stationTitle: string;
    labDate: string;
    startTime?: string;
    cohortName: string;
    role?: string;
  }
): Promise<void> {
  const timeStr = labInfo.startTime
    ? ` at ${formatTime(labInfo.startTime)}`
    : '';

  const formattedDate = new Date(labInfo.labDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // Create in-app notification
  await createNotification({
    userEmail: instructorEmail,
    title: 'Lab reminder',
    message: `You have a lab tomorrow${timeStr} - ${labInfo.stationTitle} for ${labInfo.cohortName}`,
    type: 'lab_reminder',
    linkUrl: `/lab-management/grade/station/${labInfo.stationId}`,
    referenceType: 'lab_station',
    referenceId: labInfo.stationId,
  });

  // Send email if enabled
  if (await shouldSendEmail(instructorEmail, 'labs')) {
    await sendLabReminderEmail(instructorEmail, {
      labName: `${labInfo.stationTitle} - ${labInfo.cohortName}`,
      date: formattedDate,
      time: labInfo.startTime ? formatTime(labInfo.startTime) : undefined,
      role: labInfo.role
    });
  }
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Notify user when a task is assigned to them
 */
export async function notifyTaskAssigned(
  assigneeEmail: string,
  taskInfo: {
    taskId: string;
    title: string;
    assignerName: string;
    description?: string;
    dueDate?: string;
  }
): Promise<void> {
  console.log('[NOTIFY] notifyTaskAssigned called for:', assigneeEmail, '| taskId:', taskInfo.taskId, '| assigner:', taskInfo.assignerName);

  // Create in-app notification
  try {
    await createNotification({
      userEmail: assigneeEmail,
      title: 'New task assigned',
      message: `${taskInfo.assignerName} assigned you a task: ${taskInfo.title}`,
      type: 'task_assigned',
      linkUrl: `/tasks/${taskInfo.taskId}`,
      referenceType: 'instructor_task',
      referenceId: taskInfo.taskId,
    });
    console.log('[NOTIFY] In-app notification created successfully for:', assigneeEmail);
  } catch (notifError) {
    console.error('[NOTIFY] In-app notification FAILED for:', assigneeEmail, notifError);
  }

  // Send email if enabled
  const shouldSend = await shouldSendEmail(assigneeEmail, 'tasks');
  console.log('[NOTIFY] shouldSendEmail result for', assigneeEmail, ':', shouldSend);

  if (shouldSend) {
    console.log('[NOTIFY] Sending email to:', assigneeEmail);
    try {
      await sendTaskAssignedEmail(assigneeEmail, {
        taskId: taskInfo.taskId,
        title: taskInfo.title,
        assignerName: taskInfo.assignerName,
        description: taskInfo.description,
        dueDate: taskInfo.dueDate
      });
      console.log('[NOTIFY] Email sent successfully to:', assigneeEmail);
    } catch (emailError) {
      console.error('[NOTIFY] Email send FAILED for:', assigneeEmail, emailError);
    }
  } else {
    console.log('[NOTIFY] Email SKIPPED for:', assigneeEmail, '(shouldSendEmail returned false)');
  }
}

/**
 * Notify assigner when a task is completed
 */
export async function notifyTaskCompleted(
  assignerEmail: string,
  taskInfo: {
    taskId: string;
    title: string;
    assigneeName: string;
    completionNotes?: string;
  }
): Promise<void> {
  // Create in-app notification
  await createNotification({
    userEmail: assignerEmail,
    title: 'Task completed',
    message: `${taskInfo.assigneeName} completed: ${taskInfo.title}`,
    type: 'task_completed',
    linkUrl: `/tasks/${taskInfo.taskId}`,
    referenceType: 'instructor_task',
    referenceId: taskInfo.taskId,
  });

  // Send email if enabled
  if (await shouldSendEmail(assignerEmail, 'tasks')) {
    await sendTaskCompletedEmail(assignerEmail, {
      taskId: taskInfo.taskId,
      title: taskInfo.title,
      assigneeName: taskInfo.assigneeName,
      completionNotes: taskInfo.completionNotes
    });
  }
}

/**
 * Notify task participant when a comment is added
 */
export async function notifyTaskComment(
  recipientEmail: string,
  taskInfo: {
    taskId: string;
    title: string;
    commenterName: string;
  }
): Promise<void> {
  await createNotification({
    userEmail: recipientEmail,
    title: 'New comment on task',
    message: `${taskInfo.commenterName} commented on: ${taskInfo.title}`,
    type: 'task_comment',
    linkUrl: `/tasks/${taskInfo.taskId}`,
    referenceType: 'instructor_task',
    referenceId: taskInfo.taskId,
  });
}

/**
 * Notify user when their role is approved/upgraded from pending
 */
export async function notifyRoleApproved(
  userEmail: string,
  roleInfo: {
    userId: string;
    newRole: string;
    approverName: string;
  }
): Promise<void> {
  const roleLabel = getRoleLabelForNotification(roleInfo.newRole);
  await createNotification({
    userEmail: userEmail,
    title: 'Account approved!',
    message: `Your account has been approved. You now have ${roleLabel} access to PMI Tools.`,
    type: 'role_approved',
    linkUrl: '/',
    referenceType: 'lab_user',
    referenceId: roleInfo.userId,
  });
}

/**
 * Notify admins when a new user signs up (pending approval)
 */
export async function notifyAdminsNewPendingUser(
  newUserInfo: {
    userId: string;
    name: string;
    email: string;
  }
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    // Get all admin and superadmin users
    const { data: admins } = await supabase
      .from('lab_users')
      .select('email')
      .in('role', ['admin', 'superadmin'])
      .eq('is_active', true);

    if (!admins || admins.length === 0) return;

    const notifications = admins.map(admin => ({
      userEmail: admin.email,
      title: 'New user pending approval',
      message: `${newUserInfo.name} (${newUserInfo.email}) signed up and needs role assignment`,
      type: 'general' as NotificationType,
      linkUrl: '/admin/users',
      referenceType: 'lab_user',
      referenceId: newUserInfo.userId,
    }));

    await createBulkNotifications(notifications);
  } catch (error) {
    console.error('Error notifying admins of new pending user:', error);
  }
}

function getRoleLabelForNotification(role: string): string {
  const labels: Record<string, string> = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    lead_instructor: 'Lead Instructor',
    instructor: 'Instructor',
    guest: 'Guest',
    pending: 'Pending',
  };
  return labels[role] || role;
}
