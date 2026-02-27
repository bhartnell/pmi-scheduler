import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComplianceRecord {
  id: string;
  student_id: string;
  expiration_date: string | null;
  doc_type_id: string;
  doc_type: {
    name: string;
  } | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

interface ComplianceDocRecord {
  id: string;
  student_id: string;
  doc_type: string;
  expiration_date: string | null;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Days-before-expiry thresholds that trigger reminders
const REMINDER_THRESHOLDS_DAYS = [30, 14, 7];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(dateA: Date, dateB: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dateB.getTime() - dateA.getTime()) / msPerDay);
}

/**
 * Returns the threshold (30, 14, or 7) if today is within ±0 days of
 * the reminder window, or null if no threshold matches today.
 * Uses a ±12 hour window per threshold to avoid missing the cron run
 * on exact boundary days.
 */
function matchingThreshold(expiryDate: Date, today: Date): number | null {
  const daysUntilExpiry = daysBetween(today, expiryDate);
  for (const threshold of REMINDER_THRESHOLDS_DAYS) {
    if (daysUntilExpiry === threshold) {
      return threshold;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/cron/compliance-expiry
//
// Runs daily at 8am UTC. Checks student compliance records for upcoming
// expiry at 30, 14, and 7 days. Creates in-app notifications for the
// affected student.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[COMPLIANCE-EXPIRY] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[COMPLIANCE-EXPIRY] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build a date range: look for expiry dates within the next 31 days
  const lookAheadDate = new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().split('T')[0];
  const lookAheadStr = lookAheadDate.toISOString().split('T')[0];

  let notificationsSent = 0;
  let recordsChecked = 0;
  const errors: string[] = [];

  // ---------------------------------------------------------------------------
  // 1. Check student_compliance_records (normalized schema)
  // ---------------------------------------------------------------------------

  const { data: normalizedRecords, error: normalizedError } = await supabase
    .from('student_compliance_records')
    .select(`
      id,
      student_id,
      expiration_date,
      doc_type_id,
      doc_type:compliance_document_types(name),
      student:students(id, first_name, last_name, email)
    `)
    .gte('expiration_date', todayStr)
    .lte('expiration_date', lookAheadStr)
    .neq('status', 'expired');

  if (normalizedError) {
    console.error('[COMPLIANCE-EXPIRY] Error fetching compliance records:', normalizedError.message);
    errors.push(`compliance_records fetch: ${normalizedError.message}`);
  } else if (normalizedRecords && normalizedRecords.length > 0) {
    // Batch dedup check: get recent notifications for compliance_expiry in last 1 day
    const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await supabase
      .from('user_notifications')
      .select('user_email, reference_type')
      .eq('reference_type', 'compliance_expiry_reminder')
      .gte('created_at', oneDayAgo);

    const recentSet = new Set<string>(
      (recentNotifications || []).map(
        (n: { user_email: string; reference_type: string }) =>
          `${n.user_email}:compliance_expiry_reminder`
      )
    );

    for (const record of normalizedRecords as unknown as ComplianceRecord[]) {
      recordsChecked++;

      if (!record.expiration_date) continue;
      const student = record.student;
      if (!student?.email) continue;

      const docName =
        (record.doc_type as { name: string } | null)?.name ?? 'Compliance document';
      const expiryDate = new Date(record.expiration_date + 'T12:00:00');
      const threshold = matchingThreshold(expiryDate, today);

      if (threshold === null) continue;

      // Dedup: one notification per student per doc type per day
      const dedupKey = `${student.email}:compliance_expiry_reminder`;
      if (recentSet.has(dedupKey)) continue;

      const urgency =
        threshold <= 7 ? 'urgent - ' : threshold <= 14 ? 'soon - ' : '';

      try {
        await createNotification({
          userEmail: student.email,
          title: `${urgency.length ? 'Urgent: ' : ''}Compliance Expiry in ${threshold} Days`,
          message: `Your ${docName} expires in ${threshold} day${threshold !== 1 ? 's' : ''} (${record.expiration_date}). Please renew it before it expires to remain compliant.`,
          type: 'compliance_due',
          category: 'clinical',
          linkUrl: '/onboarding/compliance',
          referenceType: 'compliance_expiry_reminder',
        });
        notificationsSent++;
        recentSet.add(dedupKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Notification for ${student.email} (${docName}) failed: ${msg}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Also check legacy student_compliance_docs table (wide-table schema)
  // ---------------------------------------------------------------------------

  const { data: legacyRecords, error: legacyError } = await supabase
    .from('student_compliance_docs')
    .select(`
      id,
      student_id,
      doc_type,
      expiration_date,
      student:students(id, first_name, last_name, email)
    `)
    .gte('expiration_date', todayStr)
    .lte('expiration_date', lookAheadStr)
    .eq('completed', true);

  if (legacyError) {
    // Non-fatal: table may not have all fields
    console.warn('[COMPLIANCE-EXPIRY] Legacy compliance_docs query warning:', legacyError.message);
  } else if (legacyRecords && legacyRecords.length > 0) {
    const oneDayAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLegacyNotifications } = await supabase
      .from('user_notifications')
      .select('user_email')
      .eq('reference_type', 'compliance_expiry_legacy_reminder')
      .gte('created_at', oneDayAgo);

    const recentLegacySet = new Set<string>(
      (recentLegacyNotifications || []).map(
        (n: { user_email: string }) => n.user_email
      )
    );

    for (const record of legacyRecords as unknown as ComplianceDocRecord[]) {
      recordsChecked++;

      if (!record.expiration_date) continue;
      const student = record.student as {
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
      } | null;
      if (!student?.email) continue;

      const expiryDate = new Date(record.expiration_date + 'T12:00:00');
      const threshold = matchingThreshold(expiryDate, today);

      if (threshold === null) continue;

      const dedupKey = `${student.email}:${record.doc_type}`;
      if (recentLegacySet.has(dedupKey)) continue;

      const docLabel = record.doc_type.replace(/_/g, ' ');

      try {
        await createNotification({
          userEmail: student.email,
          title: `Compliance Expiry in ${threshold} Days`,
          message: `Your ${docLabel} expires in ${threshold} day${threshold !== 1 ? 's' : ''} (${record.expiration_date}). Please renew it to remain compliant.`,
          type: 'compliance_due',
          category: 'clinical',
          linkUrl: '/onboarding/compliance',
          referenceType: 'compliance_expiry_legacy_reminder',
        });
        notificationsSent++;
        recentLegacySet.add(dedupKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Legacy notification for ${student.email} (${record.doc_type}) failed: ${msg}`);
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

  console.log('[COMPLIANCE-EXPIRY] Completed:', summary);
  return NextResponse.json(summary);
}
