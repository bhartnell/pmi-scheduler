import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { wrapInEmailTemplate, EMAIL_COLORS } from '@/lib/email-templates';
import { NotificationCategory } from '@/lib/notifications';
import { isNremtTestingActiveToday } from '@/lib/email';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

// Category display metadata with enhanced descriptions
const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; icon: string; color: string; bgColor: string; borderColor: string; description: string }
> = {
  labs: {
    label: 'Lab Assignments',
    icon: '&#129514;',
    color: EMAIL_COLORS.warning,
    bgColor: '#fef3c7',
    borderColor: EMAIL_COLORS.warning,
    description: 'New assignments and upcoming labs',
  },
  tasks: {
    label: 'Tasks',
    icon: '&#128203;',
    color: EMAIL_COLORS.accent,
    bgColor: '#eff6ff',
    borderColor: EMAIL_COLORS.accent,
    description: 'New tasks assigned and tasks due soon',
  },
  scheduling: {
    label: 'Scheduling',
    icon: '&#128197;',
    color: EMAIL_COLORS.success,
    bgColor: '#ecfdf5',
    borderColor: EMAIL_COLORS.success,
    description: 'New shifts available and signup confirmations',
  },
  feedback: {
    label: 'Feedback',
    icon: '&#128172;',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#8b5cf6',
    description: 'New reports and status changes',
  },
  clinical: {
    label: 'Clinical',
    icon: '&#9877;&#65039;',
    color: EMAIL_COLORS.error,
    bgColor: '#fef2f2',
    borderColor: EMAIL_COLORS.error,
    description: 'Hours updates, compliance due dates, and site visit reminders',
  },
  system: {
    label: 'System',
    icon: '&#9881;&#65039;',
    color: EMAIL_COLORS.gray[500],
    bgColor: EMAIL_COLORS.gray[50],
    borderColor: EMAIL_COLORS.gray[200],
    description: 'Account and system updates',
  },
};

// Canonical ordering for categories in digest emails
const CATEGORY_ORDER: NotificationCategory[] = [
  'labs',
  'tasks',
  'scheduling',
  'feedback',
  'clinical',
  'system',
];

interface DigestNotification {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  category: NotificationCategory;
  created_at: string;
}

interface EmailPreferences {
  enabled: boolean;
  mode: 'immediate' | 'daily_digest' | 'weekly_digest' | 'off';
  digest_time: string;
  categories: Record<NotificationCategory, boolean>;
}

interface DigestUser {
  user_email: string;
  email_preferences: EmailPreferences;
}

type DigestMode = 'daily' | 'weekly';

/**
 * Build a section of the digest email for one category.
 */
function buildCategorySection(
  category: NotificationCategory,
  notifications: DigestNotification[]
): string {
  const meta = CATEGORY_META[category];
  const count = notifications.length;

  const items = notifications
    .map((n) => {
      const titleHtml = n.link_url
        ? `<a href="${APP_URL}${n.link_url}" style="color: ${meta.color}; text-decoration: none; font-weight: 600;">${escapeHtml(n.title)}</a>`
        : `<strong style="color: ${EMAIL_COLORS.gray[900]};">${escapeHtml(n.title)}</strong>`;

      return `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${EMAIL_COLORS.gray[200]}; vertical-align: top;">
            <p style="margin: 0 0 2px 0; font-size: 14px; color: ${EMAIL_COLORS.gray[900]};">
              ${titleHtml}
            </p>
            <p style="margin: 0; font-size: 13px; color: ${EMAIL_COLORS.gray[500]};">
              ${escapeHtml(n.message)}
            </p>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="margin: 0 0 24px 0;">
      <div style="background-color: ${meta.bgColor}; border-left: 4px solid ${meta.borderColor}; border-radius: 4px; padding: 10px 14px; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; color: ${EMAIL_COLORS.gray[900]}; font-weight: 600;">
          ${meta.icon}&nbsp; ${meta.label}
          <span style="font-size: 13px; font-weight: normal; color: ${EMAIL_COLORS.gray[500]}; margin-left: 6px;">(${count} new)</span>
        </h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: ${EMAIL_COLORS.gray[500]};">
          ${meta.description}
        </p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>
          ${items}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Generate the full digest email HTML content (before wrapping in base template).
 */
function generateDigestHtml(
  notifications: DigestNotification[],
  enabledCategories: NotificationCategory[],
  mode: DigestMode
): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isWeekly = mode === 'weekly';
  const periodLabel = isWeekly ? 'the past week' : 'the last 24 hours';
  const titleText = isWeekly ? 'Your Weekly Summary' : 'Your Daily Digest';

  // Group notifications by category, only including enabled categories
  const grouped: Partial<Record<NotificationCategory, DigestNotification[]>> = {};
  for (const n of notifications) {
    const cat = n.category as NotificationCategory;
    if (!enabledCategories.includes(cat)) continue;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(n);
  }

  // Use canonical ordering, filtering to only categories with content
  const categoriesWithContent = CATEGORY_ORDER.filter(
    (cat) => grouped[cat] && grouped[cat]!.length > 0
  );

  if (categoriesWithContent.length === 0) {
    return ''; // No content to send after filtering
  }

  const totalCount = categoriesWithContent.reduce(
    (sum, cat) => sum + (grouped[cat]?.length ?? 0),
    0
  );

  const sections = categoriesWithContent
    .map((cat) => buildCategorySection(cat, grouped[cat]!))
    .join('');

  return `
    <h2 style="color: ${EMAIL_COLORS.gray[900]}; margin: 0 0 8px 0; font-size: 22px; font-weight: bold;">
      ${titleText}
    </h2>
    <p style="color: ${EMAIL_COLORS.gray[500]}; margin: 0 0 24px 0; font-size: 14px;">
      ${date}
    </p>
    <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.5;">
      Here's a summary of
      <strong>${totalCount} notification${totalCount !== 1 ? 's' : ''}</strong>
      from ${periodLabel}:
    </p>

    ${sections}

    <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.gray[200]}; margin: 24px 0;">

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align: center; padding: 8px 0;">
          <a href="${APP_URL}/notifications" style="color: ${EMAIL_COLORS.accent}; text-decoration: none; font-size: 14px;">
            View all notifications
          </a>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
      <tr>
        <td style="text-align: center; padding: 12px 0; background-color: ${EMAIL_COLORS.gray[50]}; border-radius: 6px;">
          <p style="margin: 0; font-size: 13px; color: ${EMAIL_COLORS.gray[500]};">
            <a href="${APP_URL}/settings?tab=notifications" style="color: ${EMAIL_COLORS.accent}; text-decoration: none;">
              Manage your notification preferences
            </a>
          </p>
        </td>
      </tr>
    </table>
  `;
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

/**
 * Process digest for a single user. Returns 'sent', 'skipped', or throws on error.
 */
async function processUserDigest(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  user: DigestUser,
  mode: DigestMode
): Promise<'sent' | 'skipped'> {
  const { user_email, email_preferences: prefs } = user;

  // Get enabled categories from this user's preferences
  const enabledCategories = (Object.keys(prefs.categories) as NotificationCategory[]).filter(
    (cat) => prefs.categories[cat] === true
  );

  if (enabledCategories.length === 0) {
    return 'skipped';
  }

  // Determine lookback period based on mode
  const lookbackHours = mode === 'weekly' ? 7 * 24 : 24;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

  // Fetch unread notifications from the lookback period that haven't been digest-sent
  const { data: notifications, error } = await supabase
    .from('user_notifications')
    .select('id, title, message, link_url, category, created_at')
    .eq('user_email', user_email)
    .eq('is_read', false)
    .is('digest_sent_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`DB query failed for ${user_email}: ${error.message}`);
  }

  if (!notifications || notifications.length === 0) {
    return 'skipped';
  }

  // Generate digest HTML content
  const digestContent = generateDigestHtml(
    notifications as DigestNotification[],
    enabledCategories,
    mode
  );

  // After category filtering, there may be nothing left
  if (!digestContent) {
    return 'skipped';
  }

  const preferencesUrl = `${APP_URL}/settings?tab=notifications`;
  const fullHtml = wrapInEmailTemplate(digestContent, preferencesUrl);

  // NREMT kill switch — this route bypasses lib/email.ts. Added 2026-04-19.
  if (await isNremtTestingActiveToday()) {
    console.warn(
      '[nremt-guard] Skipped daily digest send — NREMT testing active'
    );
    return 'skipped';
  }

  // Send via Resend directly (bypass the template system since we build HTML ourselves)
  const { Resend } = await import('resend');
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const FROM_EMAIL =
    process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = mode === 'weekly'
    ? `[PMI] Weekly Summary - ${dateStr}`
    : `[PMI] Daily Digest - ${dateStr}`;

  if (resend) {
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: user_email,
      subject,
      html: fullHtml,
    });

    if (sendError) {
      throw new Error(`Resend error for ${user_email}: ${sendError.message}`);
    }
  }

  // Mark notifications as digest-sent
  const notificationIds = (notifications as DigestNotification[]).map((n) => n.id);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('user_notifications')
    .update({ digest_sent_at: now })
    .in('id', notificationIds);

  if (updateError) {
    // Non-fatal — email was sent; log and continue
    console.error(`[DIGEST] Failed to mark notifications as digest_sent for ${user_email}:`, updateError.message);
  }

  // Log to email_log table
  const templateName = mode === 'weekly' ? 'weekly_digest' : 'daily_digest';
  await supabase.from('email_log').insert({
    to_email: user_email,
    subject,
    template: templateName,
    status: 'sent',
    sent_at: now,
  });

  return 'sent';
}

/**
 * Core digest processing logic shared by daily and weekly endpoints.
 */
async function processDigest(
  request: NextRequest,
  mode: DigestMode
): Promise<NextResponse> {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn(`[DIGEST] Unauthorized ${mode} cron request`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const modeLabel = mode === 'weekly' ? 'Weekly' : 'Daily';
  console.log(`[DIGEST] ${modeLabel} digest cron started at`, new Date().toISOString());

  const supabase = getSupabaseAdmin();

  // Determine which mode(s) to query for
  const digestMode = mode === 'weekly' ? 'weekly_digest' : 'daily_digest';

  // Find all users with this digest mode enabled
  const { data: digestUsers, error: usersError } = await supabase
    .from('user_preferences')
    .select('user_email, email_preferences')
    .eq('email_preferences->>mode', digestMode)
    .eq('email_preferences->>enabled', 'true');

  if (usersError) {
    console.error(`[DIGEST] Failed to query ${mode} digest users:`, usersError.message);
    return NextResponse.json(
      { error: `Failed to query ${mode} digest users`, detail: usersError.message },
      { status: 500 }
    );
  }

  if (!digestUsers || digestUsers.length === 0) {
    console.log(`[DIGEST] No users with ${digestMode} mode found`);
    return NextResponse.json({
      success: true,
      mode,
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    });
  }

  console.log(`[DIGEST] Processing ${digestUsers.length} ${mode} digest user(s)`);

  // Process each user in parallel, tolerating individual failures
  const results = await Promise.allSettled(
    (digestUsers as DigestUser[]).map((user) => processUserDigest(supabase, user, mode))
  );

  // Tally results
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    const email = (digestUsers as DigestUser[])[index]?.user_email ?? `user[${index}]`;
    if (result.status === 'fulfilled') {
      if (result.value === 'sent') {
        sent++;
      } else {
        skipped++;
      }
    } else {
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[DIGEST] Error processing ${email}:`, errMsg);
      errors.push(`${email}: ${errMsg}`);
    }
  });

  const summary = {
    success: true,
    mode,
    processed: digestUsers.length,
    sent,
    skipped,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log(`[DIGEST] ${modeLabel} completed:`, summary);
  return NextResponse.json(summary);
}

/**
 * GET /api/cron/daily-digest
 *
 * Vercel cron endpoint. Runs at 2pm UTC (8am MST / Arizona).
 * Sends batched digest emails to users with mode = 'daily_digest'.
 *
 * Auth: Bearer token via CRON_SECRET env var (standard Vercel cron pattern).
 */
export async function GET(request: NextRequest) {
  return processDigest(request, 'daily');
}

// Export the shared function for the weekly digest route to use
export { processDigest, generateDigestHtml, buildCategorySection, escapeHtml, CATEGORY_META, CATEGORY_ORDER };
export type { DigestNotification, DigestUser, DigestMode };
