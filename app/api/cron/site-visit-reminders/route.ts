import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClinicalSite {
  id: string;
  name: string;
  abbreviation: string;
  system: string | null;
  is_active: boolean;
  visit_monitoring_enabled: boolean;
  visit_alert_days: number;
  visit_urgent_days: number;
}

interface LastVisitRow {
  site_id: string;
  last_visit_date: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Recipients for site visit alerts
const ALERT_RECIPIENTS = [
  'bhartnell@pmi.edu',
  'rniedfeldt@pmi.edu',
];

// Default thresholds in days since last visit (used as fallback)
const DEFAULT_WARNING_THRESHOLD_DAYS = 14;
const DEFAULT_URGENT_THRESHOLD_DAYS = 28;

// Dedup window: don't re-notify for the same site/threshold within this many days
const DEDUP_WINDOW_DAYS = 7;

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
 * Determine the alert level based on days since last visit and per-site thresholds.
 * Returns 'urgent' (>= urgent_days), 'warning' (>= alert_days), or null.
 */
function getAlertLevel(
  daysSinceVisit: number,
  alertDays: number = DEFAULT_WARNING_THRESHOLD_DAYS,
  urgentDays: number = DEFAULT_URGENT_THRESHOLD_DAYS,
): 'urgent' | 'warning' | null {
  if (daysSinceVisit >= urgentDays) return 'urgent';
  if (daysSinceVisit >= alertDays) return 'warning';
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/cron/site-visit-reminders
//
// Runs daily. For each active clinical site, checks the most recent visit.
// If >= 14 days since last visit (warning) or >= 28 days (urgent),
// sends in-app notifications and emails to designated recipients.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[SITE-VISIT-REMINDERS] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[SITE-VISIT-REMINDERS] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let sitesChecked = 0;
  let notificationsSent = 0;
  let emailsSent = 0;
  const errors: string[] = [];

  // 1. Fetch all active clinical sites with visit monitoring enabled
  const { data: sites, error: sitesError } = await supabase
    .from('clinical_sites')
    .select('id, name, abbreviation, system, is_active, visit_monitoring_enabled, visit_alert_days, visit_urgent_days')
    .eq('is_active', true)
    .eq('visit_monitoring_enabled', true)
    .order('name');

  if (sitesError) {
    console.error('[SITE-VISIT-REMINDERS] Failed to fetch sites:', sitesError.message);
    return NextResponse.json(
      { error: 'Failed to fetch clinical sites', detail: sitesError.message },
      { status: 500 }
    );
  }

  if (!sites || sites.length === 0) {
    console.log('[SITE-VISIT-REMINDERS] No active clinical sites found');
    return NextResponse.json({
      success: true,
      sites_checked: 0,
      notifications_sent: 0,
      emails_sent: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    });
  }

  // 2. For each site, get the most recent visit date using a single query
  //    We use a raw approach: fetch visits grouped by site_id with max visit_date
  const siteIds = (sites as ClinicalSite[]).map(s => s.id);

  // Fetch the most recent visit for each site in a single query
  const { data: recentVisits, error: visitsError } = await supabase
    .rpc('get_last_visit_per_site', { site_ids: siteIds })
    .select('site_id, last_visit_date');

  // If the RPC doesn't exist, fall back to individual queries
  let siteLastVisitMap: Map<string, string> = new Map();

  if (visitsError) {
    // Fallback: query per site (less efficient but works without RPC)
    console.log('[SITE-VISIT-REMINDERS] RPC not available, using fallback queries');

    for (const site of sites as ClinicalSite[]) {
      const { data: lastVisit } = await supabase
        .from('clinical_site_visits')
        .select('visit_date')
        .eq('site_id', site.id)
        .order('visit_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastVisit?.visit_date) {
        siteLastVisitMap.set(site.id, lastVisit.visit_date);
      }
    }
  } else if (recentVisits) {
    for (const row of recentVisits as LastVisitRow[]) {
      siteLastVisitMap.set(row.site_id, row.last_visit_date);
    }
  }

  // 3. Fetch recent notifications to avoid duplicates
  const dedupWindowStart = new Date(
    today.getTime() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: recentNotifs } = await supabase
    .from('user_notifications')
    .select('user_email, reference_id, title')
    .in('reference_type', ['site_visit_warning', 'site_visit_urgent'])
    .gte('created_at', dedupWindowStart);

  // Build a set of "email:siteId:level" keys for dedup
  const alreadyNotified = new Set<string>();
  if (recentNotifs) {
    for (const n of recentNotifs) {
      // Determine level from reference_type stored in title prefix
      const level = n.title?.includes('URGENT') ? 'urgent' : 'warning';
      alreadyNotified.add(`${n.user_email}:${n.reference_id}:${level}`);
    }
  }

  // 4. Check each site and send alerts as needed
  for (const site of sites as ClinicalSite[]) {
    sitesChecked++;

    const lastVisitDate = siteLastVisitMap.get(site.id);

    // If no visit has ever been recorded, treat as urgent
    let daysSinceVisit: number;
    let lastVisitStr: string;

    // Use per-site thresholds, falling back to defaults
    const siteAlertDays = site.visit_alert_days ?? DEFAULT_WARNING_THRESHOLD_DAYS;
    const siteUrgentDays = site.visit_urgent_days ?? DEFAULT_URGENT_THRESHOLD_DAYS;

    if (!lastVisitDate) {
      // No visit on record - flag as needing attention
      daysSinceVisit = siteUrgentDays; // Treat as urgent
      lastVisitStr = 'Never visited';
    } else {
      const visitDate = new Date(lastVisitDate + 'T12:00:00');
      daysSinceVisit = daysBetween(visitDate, today);
      lastVisitStr = formatDate(lastVisitDate);
    }

    const alertLevel = getAlertLevel(daysSinceVisit, siteAlertDays, siteUrgentDays);
    if (!alertLevel) continue;

    const referenceType = alertLevel === 'urgent' ? 'site_visit_urgent' : 'site_visit_warning';
    const urgencyLabel = alertLevel === 'urgent' ? 'URGENT' : 'Warning';
    const systemLabel = site.system ? ` (${site.system})` : '';

    // Send to each recipient
    for (const recipientEmail of ALERT_RECIPIENTS) {
      const dedupKey = `${recipientEmail}:${site.id}:${alertLevel}`;

      if (alreadyNotified.has(dedupKey)) {
        continue; // Already notified recently
      }

      // Create in-app notification
      try {
        await createNotification({
          userEmail: recipientEmail,
          title: `${urgencyLabel}: ${site.name} Site Visit Overdue`,
          message: `${site.name}${systemLabel} has not been visited in ${daysSinceVisit} days. Last visit: ${lastVisitStr}.`,
          type: 'clinical_hours',
          category: 'clinical',
          linkUrl: '/clinical/site-visits',
          referenceType: referenceType,
          referenceId: site.id,
        });
        notificationsSent++;
        alreadyNotified.add(dedupKey);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Notification to ${recipientEmail} for ${site.name}: ${errMsg}`);
      }

      // Send email
      try {
        const result = await sendEmail({
          to: recipientEmail,
          subject: `[PMI] ${urgencyLabel}: ${site.name} site visit overdue`,
          template: 'general',
          data: {
            subject: `${urgencyLabel}: ${site.name} Site Visit Overdue`,
            title: `Clinical Site Visit ${urgencyLabel}`,
            message: `<strong>${site.name}</strong>${systemLabel} has not been visited in <strong>${daysSinceVisit} days</strong>.<br><br>` +
              `<strong>Last visit:</strong> ${lastVisitStr}<br>` +
              `<strong>Days since visit:</strong> ${daysSinceVisit}<br><br>` +
              `Please schedule a visit to this site as soon as possible.`,
            actionUrl: `${process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools'}/clinical/site-visits`,
            actionText: 'View Site Visits',
          },
        });

        if (result.success) {
          emailsSent++;
        } else {
          errors.push(`Email to ${recipientEmail} for ${site.name}: ${result.error}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Email to ${recipientEmail} for ${site.name}: ${errMsg}`);
      }
    }
  }

  const summary = {
    success: true,
    sites_checked: sitesChecked,
    notifications_sent: notificationsSent,
    emails_sent: emailsSent,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[SITE-VISIT-REMINDERS] Completed:', summary);
  return NextResponse.json(summary);
}
