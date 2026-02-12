import { createClient } from '@supabase/supabase-js';

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type NotificationType =
  | 'lab_assignment'
  | 'lab_reminder'
  | 'feedback_new'
  | 'feedback_resolved'
  | 'task_assigned'
  | 'general';

interface CreateNotificationParams {
  userEmail: string;
  title: string;
  message: string;
  type?: NotificationType;
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
  linkUrl,
  referenceType,
  referenceId,
}: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('user_notifications').insert({
      user_email: userEmail,
      title,
      message,
      type,
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
    const supabase = getSupabase();
    const records = notifications.map(n => ({
      user_email: n.userEmail,
      title: n.title,
      message: n.message,
      type: n.type || 'general',
      link_url: n.linkUrl || null,
      reference_type: n.referenceType || null,
      reference_id: n.referenceId || null,
    }));

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
  }
): Promise<void> {
  const formattedDate = new Date(stationInfo.labDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  await createNotification({
    userEmail: instructorEmail,
    title: `Assigned to ${stationInfo.stationTitle}`,
    message: `You were assigned to a station for ${stationInfo.cohortName} on ${formattedDate}`,
    type: 'lab_assignment',
    linkUrl: `/lab-management/grade/station/${stationInfo.stationId}`,
    referenceType: 'lab_station',
    referenceId: stationInfo.stationId,
  });
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
    const supabase = getSupabase();
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
  }
): Promise<void> {
  const timeStr = labInfo.startTime
    ? ` at ${formatTime(labInfo.startTime)}`
    : '';

  await createNotification({
    userEmail: instructorEmail,
    title: 'Lab reminder',
    message: `You have a lab tomorrow${timeStr} - ${labInfo.stationTitle} for ${labInfo.cohortName}`,
    type: 'lab_reminder',
    linkUrl: `/lab-management/grade/station/${labInfo.stationId}`,
    referenceType: 'lab_station',
    referenceId: labInfo.stationId,
  });
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
