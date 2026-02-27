import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreceptorRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  snhd_cert_expires: string | null;
  agency_name: string | null;
}

interface EndorsementRow {
  id: string;
  endorsement_type: string;
  title: string | null;
  expires_at: string | null;
  is_active: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Days-before-expiry thresholds that trigger reminders
const CERT_REMINDER_THRESHOLDS_DAYS = [90, 60, 30, 14];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(dateA: Date, dateB: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay);
}

/** Format a date as "Mar 15, 2026" */
function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Returns the matching threshold (90, 60, 30, or 14) if daysUntilExpiry
 * exactly equals one of the thresholds. Returns null if no match.
 */
function matchingThreshold(daysUntilExpiry: number): number | null {
  return CERT_REMINDER_THRESHOLDS_DAYS.includes(daysUntilExpiry)
    ? daysUntilExpiry
    : null;
}

// ---------------------------------------------------------------------------
// GET /api/cron/cert-expiry
//
// Runs weekly on Mondays at 8am UTC. Checks:
//   1. field_preceptors.snhd_cert_expires
//   2. user_endorsements.expires_at (active instructor endorsements)
// Sends reminders at 90, 60, 30, and 14 days before expiry.
// Notifies the instructor/preceptor and also notifies admin users.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[CERT-EXPIRY] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[CERT-EXPIRY] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Look-ahead range: only fetch records expiring within 91 days
  const lookAheadDate = new Date(today.getTime() + 91 * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().split('T')[0];
  const lookAheadStr = lookAheadDate.toISOString().split('T')[0];

  // Fetch admin emails for alerting
  const { data: adminUsers } = await supabase
    .from('lab_users')
    .select('email, name')
    .in('role', ['admin', 'superadmin'])
    .eq('is_active', true);

  const adminEmails: string[] = (adminUsers || [])
    .map((u: { email: string }) => u.email)
    .filter(Boolean);

  let recordsChecked = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  // ---------------------------------------------------------------------------
  // 1. Field Preceptor SNHD Cert Expiry
  // ---------------------------------------------------------------------------

  const { data: preceptors, error: preceptorsError } = await supabase
    .from('field_preceptors')
    .select('id, first_name, last_name, email, snhd_cert_expires, agency_name')
    .not('snhd_cert_expires', 'is', null)
    .gte('snhd_cert_expires', todayStr)
    .lte('snhd_cert_expires', lookAheadStr)
    .eq('is_active', true);

  if (preceptorsError) {
    console.error('[CERT-EXPIRY] Failed to fetch preceptors:', preceptorsError.message);
    errors.push(`preceptors fetch: ${preceptorsError.message}`);
  } else if (preceptors && preceptors.length > 0) {
    // Dedup: don't re-notify same preceptor for same cert type within 1 day
    const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPreceptorNotifs } = await supabase
      .from('user_notifications')
      .select('user_email')
      .eq('reference_type', 'snhd_cert_expiry_reminder')
      .gte('created_at', oneDayAgo);

    const alreadyNotifiedPreceptors = new Set<string>(
      (recentPreceptorNotifs || []).map((n: { user_email: string }) => n.user_email)
    );

    for (const preceptor of preceptors as PreceptorRow[]) {
      recordsChecked++;

      if (!preceptor.snhd_cert_expires) continue;
      const snhdCertExpires = preceptor.snhd_cert_expires;
      const expiryDate = new Date(snhdCertExpires + 'T12:00:00');
      const daysUntil = daysBetween(today, expiryDate);
      const threshold = matchingThreshold(daysUntil);

      if (threshold === null) continue;

      const preceptorFullName = `${preceptor.first_name} ${preceptor.last_name}`.trim();
      const agencyLabel = preceptor.agency_name ? ` (${preceptor.agency_name})` : '';

      // Notify the preceptor if they have an email
      if (preceptor.email && !alreadyNotifiedPreceptors.has(preceptor.email)) {
        try {
          await createNotification({
            userEmail: preceptor.email,
            title: `SNHD Certification Expires in ${threshold} Days`,
            message: `Your SNHD field preceptor certification expires in ${threshold} day${threshold !== 1 ? 's' : ''} on ${formatDate(snhdCertExpires)}. Please renew your certification to continue as an active field preceptor.`,
            type: 'compliance_due',
            category: 'clinical',
            linkUrl: '/clinical/preceptors',
            referenceType: 'snhd_cert_expiry_reminder',
          });
          notificationsSent++;
          alreadyNotifiedPreceptors.add(preceptor.email);
        } catch (err) {
          errors.push(`Preceptor ${preceptorFullName} notification failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Notify admins about the preceptor cert expiry
      const { data: existingAdminNotif } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('reference_type', 'snhd_cert_expiry_admin_alert')
        .eq('reference_id', preceptor.id)
        .gte('created_at', oneDayAgo)
        .limit(1)
        .maybeSingle();

      if (!existingAdminNotif) {
        for (const adminEmail of adminEmails) {
          try {
            await createNotification({
              userEmail: adminEmail,
              title: `Preceptor Cert Expiry: ${preceptorFullName}`,
              message: `${preceptorFullName}${agencyLabel}'s SNHD field preceptor certification expires in ${threshold} day${threshold !== 1 ? 's' : ''} on ${formatDate(snhdCertExpires)}.`,
              type: 'compliance_due',
              category: 'clinical',
              linkUrl: '/clinical/preceptors',
              referenceType: 'snhd_cert_expiry_admin_alert',
              referenceId: preceptor.id,
            });
            notificationsSent++;
          } catch (err) {
            errors.push(`Admin ${adminEmail} preceptor cert alert failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. User Endorsement Expiry (instructor endorsements)
  // ---------------------------------------------------------------------------

  const { data: endorsements, error: endorsementsError } = await supabase
    .from('user_endorsements')
    .select(`
      id,
      endorsement_type,
      title,
      expires_at,
      is_active,
      user:lab_users(id, name, email, role)
    `)
    .eq('is_active', true)
    .not('expires_at', 'is', null)
    .gte('expires_at', todayStr)
    .lte('expires_at', lookAheadStr);

  if (endorsementsError) {
    console.error('[CERT-EXPIRY] Failed to fetch endorsements:', endorsementsError.message);
    errors.push(`endorsements fetch: ${endorsementsError.message}`);
  } else if (endorsements && endorsements.length > 0) {
    const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentEndorsementNotifs } = await supabase
      .from('user_notifications')
      .select('user_email, reference_id')
      .eq('reference_type', 'endorsement_expiry_reminder')
      .gte('created_at', oneDayAgo);

    const alreadySentEndorsements = new Set<string>(
      (recentEndorsementNotifs || []).map(
        (n: { user_email: string; reference_id: string | null }) =>
          `${n.user_email}:${n.reference_id ?? ''}`
      )
    );

    for (const endorsement of endorsements as unknown as EndorsementRow[]) {
      recordsChecked++;

      if (!endorsement.expires_at) continue;
      const expiryDate = new Date(endorsement.expires_at);
      const daysUntil = daysBetween(today, expiryDate);
      const threshold = matchingThreshold(daysUntil);

      if (threshold === null) continue;

      const user = endorsement.user as {
        id: string;
        name: string;
        email: string;
        role: string;
      } | null;
      if (!user?.email) continue;

      const endorsementLabel =
        endorsement.title ||
        endorsement.endorsement_type.replace(/_/g, ' ');
      const expiryDateStr = expiryDate.toISOString().split('T')[0];

      // Notify the instructor
      const dedupKey = `${user.email}:${endorsement.id}`;
      if (!alreadySentEndorsements.has(dedupKey)) {
        try {
          await createNotification({
            userEmail: user.email,
            title: `Endorsement Expires in ${threshold} Days`,
            message: `Your ${endorsementLabel} endorsement expires in ${threshold} day${threshold !== 1 ? 's' : ''} on ${formatDate(expiryDateStr)}. Please contact your program director to renew.`,
            type: 'compliance_due',
            category: 'system',
            linkUrl: '/admin/users',
            referenceType: 'endorsement_expiry_reminder',
            referenceId: endorsement.id,
          });
          notificationsSent++;
          alreadySentEndorsements.add(dedupKey);
        } catch (err) {
          errors.push(`Endorsement notification for ${user.email} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Notify admins
      const { data: existingAdminEndorsementNotif } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('reference_type', 'endorsement_expiry_admin_alert')
        .eq('reference_id', endorsement.id)
        .gte('created_at', new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (!existingAdminEndorsementNotif) {
        for (const adminEmail of adminEmails) {
          try {
            await createNotification({
              userEmail: adminEmail,
              title: `Instructor Endorsement Expiring: ${user.name}`,
              message: `${user.name}'s ${endorsementLabel} endorsement expires in ${threshold} day${threshold !== 1 ? 's' : ''} on ${formatDate(expiryDateStr)}.`,
              type: 'compliance_due',
              category: 'system',
              linkUrl: '/admin/users',
              referenceType: 'endorsement_expiry_admin_alert',
              referenceId: endorsement.id,
            });
            notificationsSent++;
          } catch (err) {
            errors.push(`Admin ${adminEmail} endorsement alert failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
  }

  const summary = {
    success: true,
    records_checked: recordsChecked,
    notifications_sent: notificationsSent,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[CERT-EXPIRY] Completed:', summary);
  return NextResponse.json(summary);
}
