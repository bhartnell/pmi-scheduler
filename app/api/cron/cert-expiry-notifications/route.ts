import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CertRow {
  id: string;
  cert_name: string;
  expiration_date: string;
  instructor_id: string;
  instructor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

type NotificationType = '90_day' | '30_day' | 'expired';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getNotificationType(daysUntilExpiry: number): NotificationType | null {
  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= 30) return '30_day';
  if (daysUntilExpiry <= 90) return '90_day';
  return null;
}

function buildEmailContent(
  certName: string,
  expirationDate: string,
  notificationType: NotificationType,
): { subject: string; title: string; message: string } {
  const formattedDate = formatDate(expirationDate);

  switch (notificationType) {
    case '90_day':
      return {
        subject: `[PMI] Certification Expiration Notice — ${certName}`,
        title: 'Certification Expiration Notice',
        message: `Your <strong>${certName}</strong> expires on <strong>${formattedDate}</strong>. Please begin the renewal process.`,
      };
    case '30_day':
      return {
        subject: `[PMI] URGENT: Certification Expiring Soon — ${certName}`,
        title: 'URGENT: Certification Expiring Soon',
        message: `Your <strong>${certName}</strong> expires in 30 days (<strong>${formattedDate}</strong>). Immediate action required.`,
      };
    case 'expired':
      return {
        subject: `[PMI] Certification Expired — ${certName}`,
        title: 'Certification Expired',
        message: `Your <strong>${certName}</strong> expired on <strong>${formattedDate}</strong>. Please update your certification immediately.`,
      };
  }
}

// ---------------------------------------------------------------------------
// GET /api/cron/cert-expiry-notifications
//
// Daily cron — sends email notifications for instructor certifications
// expiring within 90 days, 30 days, or already expired.
// Uses cert_notifications table to avoid re-sending.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[CERT-EXPIRY-NOTIFICATIONS] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[CERT-EXPIRY-NOTIFICATIONS] Cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Look back 30 days for expired, look ahead 90 days for upcoming
  const lookBackDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const lookAheadDate = new Date(today.getTime() + 91 * 24 * 60 * 60 * 1000);
  const lookBackStr = lookBackDate.toISOString().split('T')[0];
  const lookAheadStr = lookAheadDate.toISOString().split('T')[0];

  let emailsSent = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Fetch certs expiring within range
  const { data: certs, error: certsError } = await supabase
    .from('instructor_certifications')
    .select(`
      id,
      cert_name,
      expiration_date,
      instructor_id,
      instructor:lab_users!instructor_certifications_instructor_id_fkey(id, name, email)
    `)
    .gte('expiration_date', lookBackStr)
    .lte('expiration_date', lookAheadStr);

  if (certsError) {
    console.error('[CERT-EXPIRY-NOTIFICATIONS] Failed to fetch certs:', certsError.message);
    return NextResponse.json({
      success: false,
      error: certsError.message,
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }

  if (!certs || certs.length === 0) {
    console.log('[CERT-EXPIRY-NOTIFICATIONS] No certs in expiry window');
    return NextResponse.json({
      success: true,
      emails_sent: 0,
      skipped: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    });
  }

  // Fetch existing notifications to avoid re-sending
  const certIds = certs.map((c: { id: string }) => c.id);
  const { data: existingNotifs } = await supabase
    .from('cert_notifications')
    .select('certification_id, notification_type')
    .in('certification_id', certIds);

  const sentSet = new Set<string>(
    (existingNotifs || []).map(
      (n: { certification_id: string; notification_type: string }) =>
        `${n.certification_id}:${n.notification_type}`
    )
  );

  for (const cert of certs as unknown as CertRow[]) {
    const expiryDate = new Date(cert.expiration_date + 'T12:00:00');
    const daysUntil = daysBetween(today, expiryDate);
    const notificationType = getNotificationType(daysUntil);

    if (!notificationType) continue;

    const dedupKey = `${cert.id}:${notificationType}`;
    if (sentSet.has(dedupKey)) {
      skipped++;
      continue;
    }

    const instructor = cert.instructor;
    if (!instructor?.email) {
      skipped++;
      continue;
    }

    const { subject, title, message } = buildEmailContent(
      cert.cert_name,
      cert.expiration_date,
      notificationType,
    );

    try {
      const result = await sendEmail({
        to: instructor.email,
        subject,
        template: 'general',
        data: {
          subject,
          title,
          message,
          actionUrl: `${process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools'}/lab-management/certifications`,
          actionText: 'View Certifications',
        },
      });

      if (result.success) {
        // Record in cert_notifications to prevent re-send
        const { error: insertError } = await supabase
          .from('cert_notifications')
          .insert({
            certification_id: cert.id,
            instructor_id: cert.instructor_id,
            notification_type: notificationType,
          });

        if (insertError) {
          console.error('[CERT-EXPIRY-NOTIFICATIONS] Failed to record notification:', insertError.message);
          errors.push(`record ${cert.id}: ${insertError.message}`);
        }

        emailsSent++;
        sentSet.add(dedupKey);
      } else {
        errors.push(`email to ${instructor.email} for ${cert.cert_name}: ${result.error}`);
      }
    } catch (err) {
      errors.push(`${cert.cert_name} (${instructor.email}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const summary = {
    success: true,
    emails_sent: emailsSent,
    skipped,
    certs_checked: certs.length,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[CERT-EXPIRY-NOTIFICATIONS] Completed:', summary);
  return NextResponse.json(summary);
}
