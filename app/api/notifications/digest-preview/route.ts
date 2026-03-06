import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { wrapInEmailTemplate } from '@/lib/email-templates';
import { NotificationCategory } from '@/lib/notifications';
import {
  generateDigestHtml,
  type DigestNotification,
  type DigestMode,
} from '@/app/api/cron/daily-digest/route';

const APP_URL = process.env.NEXTAUTH_URL || 'https://pmiparamedic.tools';

/**
 * GET /api/notifications/digest-preview
 *
 * Returns a preview of what the current user's digest email would contain,
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

  // Determine digest mode for preview
  const digestMode: DigestMode = emailPrefs?.mode === 'weekly_digest' ? 'weekly' : 'daily';
  const isWeekly = digestMode === 'weekly';

  // Fetch all unread notifications (not restricting to 24h for preview -- show all unread)
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

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = isWeekly
    ? `[PMI] Weekly Summary - ${dateStr}`
    : `[PMI] Daily Digest - ${dateStr}`;

  if (notifs.length === 0) {
    return NextResponse.json({
      success: true,
      notificationCount: 0,
      subject,
      html: null,
    });
  }

  const digestContent = generateDigestHtml(notifs, enabledCategories, digestMode);

  if (!digestContent) {
    // All notifications were filtered out by category preferences
    return NextResponse.json({
      success: true,
      notificationCount: 0,
      subject,
      html: null,
    });
  }

  const preferencesUrl = `${APP_URL}/settings?tab=notifications`;
  const fullHtml = wrapInEmailTemplate(digestContent, preferencesUrl);

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
