import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { wrapInEmailTemplate, EMAIL_COLORS } from '@/lib/email-templates';
import { NotificationCategory } from '@/lib/notifications';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

// Category display metadata — mirrors the cron digest route
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

function generateDigestHtml(
  notifications: DigestNotification[],
  enabledCategories: NotificationCategory[]
): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Group by category, only include enabled ones
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
    return '';
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
 * GET /api/notifications/digest-preview
 *
 * Returns a preview of what the current user's daily digest email would contain,
 * based on their unread notifications and email category preferences.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userEmail = session.user.email;
  const supabase = getSupabaseAdmin();

  // Fetch the user's email preferences to know which categories are enabled
  const { data: userPrefs } = await supabase
    .from('user_preferences')
    .select('email_preferences')
    .eq('user_email', userEmail)
    .single();

  const emailPrefs = userPrefs?.email_preferences as {
    enabled?: boolean;
    mode?: string;
    categories?: Record<string, boolean>;
  } | null;

  // Determine which categories are enabled (default all enabled)
  const allCategories: NotificationCategory[] = ['tasks', 'labs', 'scheduling', 'feedback', 'clinical', 'system'];
  let enabledCategories: NotificationCategory[];

  if (emailPrefs?.categories) {
    enabledCategories = allCategories.filter(
      (cat) => emailPrefs.categories![cat] !== false
    );
  } else {
    enabledCategories = allCategories;
  }

  // Fetch all unread notifications (not restricting to 24h for preview — show all unread)
  const { data: notifications, error } = await supabase
    .from('user_notifications')
    .select('id, title, message, link_url, category, created_at')
    .eq('user_email', userEmail)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[DIGEST PREVIEW] DB error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }

  const notifs = (notifications ?? []) as DigestNotification[];

  if (notifs.length === 0) {
    const subject = `[PMI] Daily Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    return NextResponse.json({
      success: true,
      notificationCount: 0,
      subject,
      html: null,
    });
  }

  const digestContent = generateDigestHtml(notifs, enabledCategories);

  if (!digestContent) {
    // All notifications were filtered out by category preferences
    const subject = `[PMI] Daily Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    return NextResponse.json({
      success: true,
      notificationCount: 0,
      subject,
      html: null,
    });
  }

  const preferencesUrl = `${APP_URL}/settings?tab=notifications`;
  const fullHtml = wrapInEmailTemplate(digestContent, preferencesUrl);

  const subject = `[PMI] Daily Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // Count only the notifications that survived category filtering
  const filteredCount = notifs.filter((n) =>
    enabledCategories.includes(n.category as NotificationCategory)
  ).length;

  return NextResponse.json({
    success: true,
    notificationCount: filteredCount,
    subject,
    html: fullHtml,
  });
}
