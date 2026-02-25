import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { wrapInEmailTemplate, EMAIL_COLORS } from '@/lib/email-templates';
import { NotificationCategory } from '@/lib/notifications';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

// Category display metadata
const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; icon: string; color: string; bgColor: string; borderColor: string }
> = {
  tasks: {
    label: 'Tasks',
    icon: '&#128203;',
    color: EMAIL_COLORS.accent,
    bgColor: '#eff6ff',
    borderColor: EMAIL_COLORS.accent,
  },
  labs: {
    label: 'Labs',
    icon: '&#129514;',
    color: EMAIL_COLORS.warning,
    bgColor: '#fef3c7',
    borderColor: EMAIL_COLORS.warning,
  },
  scheduling: {
    label: 'Scheduling',
    icon: '&#128197;',
    color: EMAIL_COLORS.success,
    bgColor: '#ecfdf5',
    borderColor: EMAIL_COLORS.success,
  },
  feedback: {
    label: 'Feedback',
    icon: '&#128172;',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#8b5cf6',
  },
  clinical: {
    label: 'Clinical',
    icon: '&#9877;&#65039;',
    color: EMAIL_COLORS.error,
    bgColor: '#fef2f2',
    borderColor: EMAIL_COLORS.error,
  },
  system: {
    label: 'System',
    icon: '&#9881;&#65039;',
    color: EMAIL_COLORS.gray[500],
    bgColor: EMAIL_COLORS.gray[50],
    borderColor: EMAIL_COLORS.gray[200],
  },
};

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
  mode: 'immediate' | 'daily_digest' | 'off';
  digest_time: string;
  categories: Record<NotificationCategory, boolean>;
}

interface DigestUser {
  user_email: string;
  email_preferences: EmailPreferences;
}

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
  userEmail: string,
  notifications: DigestNotification[],
  enabledCategories: NotificationCategory[]
): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Group notifications by category, only including enabled categories
  const grouped: Partial<Record<NotificationCategory, DigestNotification[]>> = {};
  for (const n of notifications) {
    const cat = n.category as NotificationCategory;
    if (!enabledCategories.includes(cat)) continue;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(n);
  }

  const categoriesWithContent = (Object.keys(grouped) as NotificationCategory[]).filter(
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
      Your Daily Digest
    </h2>
    <p style="color: ${EMAIL_COLORS.gray[500]}; margin: 0 0 24px 0; font-size: 14px;">
      ${date}
    </p>
    <p style="color: ${EMAIL_COLORS.gray[700]}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.5;">
      Here's a summary of
      <strong>${totalCount} notification${totalCount !== 1 ? 's' : ''}</strong>
      from the last 24 hours:
    </p>

    ${sections}

    <hr style="border: none; border-top: 1px solid ${EMAIL_COLORS.gray[200]}; margin: 24px 0;">

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align: center; padding: 8px 0;">
          <a href="${APP_URL}/notifications" style="color: ${EMAIL_COLORS.accent}; text-decoration: none; font-size: 14px; margin-right: 16px;">
            View all notifications
          </a>
          &nbsp;&bull;&nbsp;
          <a href="${APP_URL}/settings?tab=notifications" style="color: ${EMAIL_COLORS.accent}; text-decoration: none; font-size: 14px; margin-left: 16px;">
            Update preferences
          </a>
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
  user: DigestUser
): Promise<'sent' | 'skipped'> {
  const { user_email, email_preferences: prefs } = user;

  // Get enabled categories from this user's preferences
  const enabledCategories = (Object.keys(prefs.categories) as NotificationCategory[]).filter(
    (cat) => prefs.categories[cat] === true
  );

  if (enabledCategories.length === 0) {
    return 'skipped';
  }

  // Fetch unread notifications from the last 24 hours that haven't been digest-sent
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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
    user_email,
    notifications as DigestNotification[],
    enabledCategories
  );

  // After category filtering, there may be nothing left
  if (!digestContent) {
    return 'skipped';
  }

  const preferencesUrl = `${APP_URL}/settings?tab=notifications`;
  const fullHtml = wrapInEmailTemplate(digestContent, preferencesUrl);

  // Send via Resend directly (bypass the template system since we build HTML ourselves)
  const { Resend } = await import('resend');
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  const FROM_EMAIL =
    process.env.EMAIL_FROM || 'PMI Paramedic Tools <notifications@pmiparamedic.tools>';
  const subject = `[PMI] Daily Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

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
  await supabase.from('email_log').insert({
    to_email: user_email,
    subject,
    template: 'daily_digest',
    status: 'sent',
    sent_at: now,
  });

  return 'sent';
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
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[DIGEST] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[DIGEST] Daily digest cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();

  // 1. Find all users with daily_digest mode enabled
  const { data: digestUsers, error: usersError } = await supabase
    .from('user_preferences')
    .select('user_email, email_preferences')
    .eq('email_preferences->>mode', 'daily_digest')
    .eq('email_preferences->>enabled', 'true');

  if (usersError) {
    console.error('[DIGEST] Failed to query digest users:', usersError.message);
    return NextResponse.json(
      { error: 'Failed to query digest users', detail: usersError.message },
      { status: 500 }
    );
  }

  if (!digestUsers || digestUsers.length === 0) {
    console.log('[DIGEST] No users with daily_digest mode found');
    return NextResponse.json({
      success: true,
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    });
  }

  console.log(`[DIGEST] Processing ${digestUsers.length} digest user(s)`);

  // 2. Process each user in parallel, tolerating individual failures
  const results = await Promise.allSettled(
    (digestUsers as DigestUser[]).map((user) => processUserDigest(supabase, user))
  );

  // 3. Tally results
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
    processed: digestUsers.length,
    sent,
    skipped,
    errors,
    duration_ms: Date.now() - startTime,
  };

  console.log('[DIGEST] Completed:', summary);
  return NextResponse.json(summary);
}
