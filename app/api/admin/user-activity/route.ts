import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify admin role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'week';

    const now = new Date();
    let periodStart: Date;
    switch (period) {
      case 'day':
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'month':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 30);
        break;
      case 'week':
      default:
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 7);
        break;
    }

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 30);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Fetch all activity in the period for in-memory aggregation
    const { data: periodRows, error: periodError } = await supabase
      .from('user_activity_log')
      .select('user_email, page_path, created_at')
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: false });

    if (periodError) throw periodError;

    // Active user counts
    const allRows = periodRows || [];

    const { data: dayRows } = await supabase
      .from('user_activity_log')
      .select('user_email')
      .gte('created_at', dayStart.toISOString());

    const { data: weekRows } = await supabase
      .from('user_activity_log')
      .select('user_email')
      .gte('created_at', weekStart.toISOString());

    const { data: monthRows } = await supabase
      .from('user_activity_log')
      .select('user_email')
      .gte('created_at', monthStart.toISOString());

    const activeUsersDaily = new Set((dayRows || []).map((r) => r.user_email)).size;
    const activeUsersWeekly = new Set((weekRows || []).map((r) => r.user_email)).size;
    const activeUsersMonthly = new Set((monthRows || []).map((r) => r.user_email)).size;

    // Top pages
    const pageMap = new Map<string, { views: number; users: Set<string> }>();
    for (const row of allRows) {
      const entry = pageMap.get(row.page_path) || { views: 0, users: new Set() };
      entry.views += 1;
      entry.users.add(row.user_email);
      pageMap.set(row.page_path, entry);
    }
    const topPages = Array.from(pageMap.entries())
      .map(([path, data]) => ({ path, views: data.views, unique_users: data.users.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    // Top users
    const userMap = new Map<string, { page_views: number; last_active: string }>();
    for (const row of allRows) {
      const entry = userMap.get(row.user_email) || { page_views: 0, last_active: row.created_at };
      entry.page_views += 1;
      if (row.created_at > entry.last_active) {
        entry.last_active = row.created_at;
      }
      userMap.set(row.user_email, entry);
    }
    const topUsers = Array.from(userMap.entries())
      .map(([email, data]) => ({ email, page_views: data.page_views, last_active: data.last_active }))
      .sort((a, b) => b.page_views - a.page_views)
      .slice(0, 20);

    // Activity by hour (0-23) using the period data
    const hourMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourMap.set(h, 0);
    for (const row of allRows) {
      const hour = new Date(row.created_at).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }
    const activityByHour = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }));

    // Activity by day (last 30 days)
    const { data: last30Rows } = await supabase
      .from('user_activity_log')
      .select('user_email, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const dayBuckets = new Map<string, { count: number; users: Set<string> }>();
    // Pre-fill last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dayBuckets.set(key, { count: 0, users: new Set() });
    }
    for (const row of last30Rows || []) {
      const key = row.created_at.split('T')[0];
      if (dayBuckets.has(key)) {
        const bucket = dayBuckets.get(key)!;
        bucket.count += 1;
        bucket.users.add(row.user_email);
      }
    }
    const activityByDay = Array.from(dayBuckets.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      unique_users: data.users.size,
    }));

    return NextResponse.json({
      success: true,
      active_users: {
        daily: activeUsersDaily,
        weekly: activeUsersWeekly,
        monthly: activeUsersMonthly,
      },
      total_page_views: allRows.length,
      top_pages: topPages,
      top_users: topUsers,
      activity_by_hour: activityByHour,
      activity_by_day: activityByDay,
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user activity' }, { status: 500 });
  }
}
