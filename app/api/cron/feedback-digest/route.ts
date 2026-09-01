import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { wrapInEmailTemplate, EMAIL_COLORS } from '@/lib/email-templates';
import { isNremtTestingActiveToday, isStudentEmailAddress, isStudentEmailBlackoutToday, isEmailCategoryEnabled } from '@/lib/email';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

const REPORT_TYPE_LABEL: Record<string, string> = {
  bug: 'Bug report',
  feature: 'Feature request',
  other: 'Feedback',
};

interface ResolvedReport {
  id: string;
  user_email: string;
  report_type: string;
  description: string;
  resolution_notes: string | null;
  resolved_at: string;
}

/**
 * Minimal HTML escaping for user-generated content in emails.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildDigestHtml(reports: ResolvedReport[]): string {
  const items = reports
    .map((r) => {
      const notesHtml = r.resolution_notes
        ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${EMAIL_COLORS.gray[700]}; font-style: italic;">${escapeHtml(r.resolution_notes)}</p>`
        : '';
      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; vertical-align: top;">
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: ${EMAIL_COLORS.success};">
              ${escapeHtml(REPORT_TYPE_LABEL[r.report_type] || 'Feedback')} resolved
            </p>
            <p style="margin: 2px 0 0 0; font-size: 14px; color: ${EMAIL_COLORS.gray[900]};">
              ${escapeHtml(r.description)}
            </p>
            ${notesHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <h2 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 22px; font-weight: bold;">
      Your feedback made a difference
    </h2>
    <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.5;">
      Here's what got resolved this week from feedback you submitted:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tbody>
        ${items}
      </tbody>
    </table>
    <p style="color: ${EMAIL_COLORS.gray[500]}; margin: 24px 0 0 0; font-size: 13px;">
      Thanks for helping improve PMI Paramedic Tools.
    </p>
  `;
}

/**
 * GET /api/cron/feedback-digest
 *
 * Weekly (Sunday 7am UTC) per-reporter digest of resolved feedback_reports.
 * Groups by user_email and sends each reporter only their own resolved
 * items since their last digest — reporters with zero newly-resolved items
 * are skipped entirely (no empty-digest emails), per Ben's 2026-06-30
 * go-live decision.
 * Supports ?dryRun=1 to preview without sending or marking digest_sent_at.
 *
 * Auth: Bearer token via CRON_SECRET env var (standard Vercel cron pattern).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[FEEDBACK-DIGEST] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const startTime = Date.now();
  console.log(`[FEEDBACK-DIGEST] Started at ${new Date().toISOString()} (dryRun=${dryRun})`);

  const supabase = getSupabaseAdmin();

  const { data: reports, error } = await supabase
    .from('feedback_reports')
    .select('id, user_email, report_type, description, resolution_notes, resolved_at')
    .eq('status', 'resolved')
    .is('digest_sent_at', null)
    .order('resolved_at', { ascending: true });

  if (error) {
    console.error('[FEEDBACK-DIGEST] Failed to query resolved feedback:', error.message);
    return NextResponse.json({ error: 'Failed to query resolved feedback', detail: error.message }, { status: 500 });
  }

  const validReports = ((reports ?? []) as ResolvedReport[]).filter(
    (r) => !!r.user_email && r.user_email.includes('@')
  );

  if (validReports.length === 0) {
    return NextResponse.json({
      success: true,
      dryRun,
      reporters: 0,
      sent: 0,
      skipped: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    });
  }

  const byReporter = new Map<string, ResolvedReport[]>();
  for (const r of validReports) {
    const email = r.user_email.trim().toLowerCase();
    if (!byReporter.has(email)) byReporter.set(email, []);
    byReporter.get(email)!.push(r);
  }

  if (dryRun) {
    const preview = Array.from(byReporter.entries()).map(([email, items]) => ({
      user_email: email,
      report_count: items.length,
      report_ids: items.map((i) => i.id),
    }));
    return NextResponse.json({
      success: true,
      dryRun: true,
      reporters: byReporter.size,
      preview,
      duration_ms: Date.now() - startTime,
    });
  }

  if (await isNremtTestingActiveToday()) {
    console.warn('[nremt-guard] Skipped feedback digest send — NREMT testing active');
    return NextResponse.json({
      success: true,
      dryRun: false,
      reporters: byReporter.size,
      sent: 0,
      skipped: byReporter.size,
      errors: [],
      note: 'Skipped — NREMT testing active today',
      duration_ms: Date.now() - startTime,
    });
  }

  const { Resend } = await import('resend');
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const FROM_EMAIL = process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = `[PMI] Your feedback update - ${dateStr}`;

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (const [email, items] of byReporter.entries()) {
    try {
      if (isStudentEmailAddress(email) && (await isStudentEmailBlackoutToday())) {
        skipped++;
        continue;
      }

      // Respect Settings > Notifications > "Email feedback updates"
      // (defaults to FALSE — per the notification_settings column default
      // and role defaults, most reporters have never opted in). This cron
      // previously ignored the toggle entirely and emailed every reporter
      // with a resolved report, regardless of whether they'd asked for it.
      // Still mark digest_sent_at below so an opted-out reporter's older
      // resolved items don't keep re-queuing every run.
      const emailEnabled = await isEmailCategoryEnabled(email, 'email_feedback_updates', false);
      if (!emailEnabled) {
        const ids = items.map((i) => i.id);
        const { error: updateError } = await supabase
          .from('feedback_reports')
          .update({ digest_sent_at: now })
          .in('id', ids);
        if (updateError) {
          console.error(`[FEEDBACK-DIGEST] Failed to mark digest_sent_at (opted out) for ${email}:`, updateError.message);
        }
        skipped++;
        continue;
      }

      const html = wrapInEmailTemplate(buildDigestHtml(items), `${APP_URL}/settings?tab=notifications`);

      if (resend) {
        const { error: sendError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject,
          html,
        });
        if (sendError) {
          throw new Error(`Resend error for ${email}: ${sendError.message}`);
        }
      }

      const ids = items.map((i) => i.id);
      const { error: updateError } = await supabase
        .from('feedback_reports')
        .update({ digest_sent_at: now })
        .in('id', ids);

      if (updateError) {
        console.error(`[FEEDBACK-DIGEST] Failed to mark digest_sent_at for ${email}:`, updateError.message);
      }

      await supabase.from('email_log').insert({
        to_email: email,
        subject,
        template: 'feedback_digest',
        status: 'sent',
        sent_at: now,
      });

      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FEEDBACK-DIGEST] Error processing ${email}:`, msg);
      errors.push(`${email}: ${msg}`);
    }
  }

  const summary = {
    success: true,
    dryRun: false,
    reporters: byReporter.size,
    sent,
    skipped,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[FEEDBACK-DIGEST] Completed:', summary);
  return NextResponse.json(summary);
}
