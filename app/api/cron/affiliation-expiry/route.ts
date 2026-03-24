import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Affiliation {
  id: string;
  site_name: string;
  expiration_date: string;
  agreement_status: string;
  responsible_person: string | null;
  responsible_person_email: string | null;
  auto_renew: boolean;
  notification_dismissed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(dateA: Date, dateB: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay);
}

/**
 * Determine which notification type (if any) should fire for a given
 * number of days until expiration.
 */
function getNotificationType(daysUntilExpiry: number): string | null {
  // Pre-expiry one-time alerts
  if (daysUntilExpiry === 180) return '6month';
  if (daysUntilExpiry === 90) return '90day';

  // 30 days or less: daily recurring
  if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) return '30day_recurring';

  // Post-expiry: every 15 days
  if (daysUntilExpiry < 0 && (-daysUntilExpiry) % 15 === 0) return '15day_post_expiry';

  return null;
}

// ---------------------------------------------------------------------------
// GET /api/cron/affiliation-expiry
//
// Runs daily. Checks clinical_affiliations for upcoming/past expiry.
// Notification thresholds:
//   - 180 days (6 months): one-time alert
//   - 90 days: one-time alert
//   - ≤30 days, not expired: daily recurring
//   - Post-expiry: every 15 days recurring
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[AFFILIATION-EXPIRY] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[AFFILIATION-EXPIRY] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  let notificationsSent = 0;
  let recordsChecked = 0;
  const errors: string[] = [];

  try {
    // Fetch all non-terminated affiliations
    const { data: affiliations, error: fetchError } = await supabase
      .from('clinical_affiliations')
      .select('id, site_name, expiration_date, agreement_status, responsible_person, responsible_person_email, auto_renew, notification_dismissed')
      .neq('agreement_status', 'terminated')
      .neq('notification_dismissed', true);

    if (fetchError) {
      if (fetchError.message?.includes('does not exist')) {
        console.log('[AFFILIATION-EXPIRY] Table does not exist yet, skipping');
        return NextResponse.json({ success: true, message: 'Table not yet created' });
      }
      throw fetchError;
    }

    if (!affiliations || affiliations.length === 0) {
      return NextResponse.json({
        success: true,
        records_checked: 0,
        notifications_sent: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Get today's already-sent notifications to avoid duplicates
    const { data: todayNotifs } = await supabase
      .from('affiliation_notifications_log')
      .select('affiliation_id, notification_type')
      .eq('sent_date', todayStr);

    const sentToday = new Set(
      (todayNotifs || []).map(
        (n: { affiliation_id: string; notification_type: string }) =>
          `${n.affiliation_id}:${n.notification_type}`
      )
    );

    // Get admin/superadmin emails for CC
    const { data: admins } = await supabase
      .from('lab_users')
      .select('email')
      .in('role', ['admin', 'superadmin'])
      .eq('is_active', true);

    const adminEmails = (admins || []).map((a: { email: string }) => a.email);

    for (const aff of affiliations as Affiliation[]) {
      recordsChecked++;

      if (!aff.expiration_date) continue;

      const expiryDate = new Date(aff.expiration_date + 'T12:00:00');
      const daysUntilExpiry = daysBetween(today, expiryDate);
      const notifType = getNotificationType(daysUntilExpiry);

      if (!notifType) continue;

      const dedupKey = `${aff.id}:${notifType}`;
      if (sentToday.has(dedupKey)) continue;

      // Build notification content
      const isExpired = daysUntilExpiry < 0;
      const absDays = Math.abs(daysUntilExpiry);
      const urgencyPrefix = isExpired
        ? 'EXPIRED: '
        : daysUntilExpiry <= 30
          ? 'Urgent: '
          : '';

      const title = isExpired
        ? `${urgencyPrefix}${aff.site_name} agreement expired ${absDays} days ago`
        : `${urgencyPrefix}${aff.site_name} agreement expires in ${daysUntilExpiry} days`;

      const message = isExpired
        ? `The affiliation agreement with ${aff.site_name} expired on ${aff.expiration_date}. Please renew immediately to maintain clinical placement access.`
        : `The affiliation agreement with ${aff.site_name} expires on ${aff.expiration_date}. ${aff.auto_renew ? 'This agreement is set to auto-renew.' : 'Please initiate renewal.'}`;

      // Determine recipients
      const recipients: string[] = [];
      if (aff.responsible_person_email) {
        recipients.push(aff.responsible_person_email);
      }
      // Add admins who aren't already the responsible person
      for (const adminEmail of adminEmails) {
        if (!recipients.includes(adminEmail)) {
          recipients.push(adminEmail);
        }
      }

      if (recipients.length === 0) continue;

      // Send notifications to each recipient
      let notifSuccess = true;
      for (const email of recipients) {
        try {
          await createNotification({
            userEmail: email,
            title,
            message,
            type: 'affiliation_expiry',
            category: 'clinical',
            linkUrl: '/clinical/affiliations',
            referenceType: 'affiliation_expiry',
            referenceId: aff.id,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Notification to ${email} for ${aff.site_name} failed: ${errMsg}`);
          notifSuccess = false;
        }
      }

      // Log to affiliation_notifications_log
      if (notifSuccess) {
        try {
          await supabase.from('affiliation_notifications_log').insert({
            affiliation_id: aff.id,
            notification_type: notifType,
            sent_date: todayStr,
            recipients,
          });
          notificationsSent++;
          sentToday.add(dedupKey);
        } catch (logErr) {
          const errMsg = logErr instanceof Error ? logErr.message : String(logErr);
          errors.push(`Failed to log notification for ${aff.site_name}: ${errMsg}`);
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Fatal error: ${msg}`);
    console.error('[AFFILIATION-EXPIRY] Fatal error:', error);
  }

  const summary = {
    success: true,
    records_checked: recordsChecked,
    notifications_sent: notificationsSent,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[AFFILIATION-EXPIRY] Completed:', summary);
  return NextResponse.json(summary);
}
