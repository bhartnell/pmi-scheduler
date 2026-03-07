import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/email-stats
 *
 * Returns aggregated email delivery statistics for the admin dashboard.
 * - sent_7d: count of sent emails in the last 7 days
 * - failed_7d: count of failed emails in the last 7 days
 * - sent_30d: count of sent emails in the last 30 days
 * - failed_30d: count of failed emails in the last 30 days
 * - by_template: breakdown by template key (last 7 days)
 * - recent_failures: most recent failures with error messages
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Count sent in last 7 days
    const { count: sent7d } = await supabase
      .from('email_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', sevenDaysAgo);

    // Count failed in last 7 days
    const { count: failed7d } = await supabase
      .from('email_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', sevenDaysAgo);

    // Count sent in last 30 days
    const { count: sent30d } = await supabase
      .from('email_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', thirtyDaysAgo);

    // Count failed in last 30 days
    const { count: failed30d } = await supabase
      .from('email_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', thirtyDaysAgo);

    // Breakdown by template (last 7 days) — fetch raw data and aggregate in JS
    const { data: templateLogs } = await supabase
      .from('email_log')
      .select('template, status')
      .gte('created_at', sevenDaysAgo);

    const byTemplate: Record<string, { sent: number; failed: number }> = {};
    for (const row of templateLogs ?? []) {
      const key = row.template || 'unknown';
      if (!byTemplate[key]) byTemplate[key] = { sent: 0, failed: 0 };
      if (row.status === 'sent') byTemplate[key].sent++;
      else if (row.status === 'failed') byTemplate[key].failed++;
    }

    // Recent failures (last 10)
    const { data: recentFailures } = await supabase
      .from('email_log')
      .select('id, to_email, subject, template, error, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      stats: {
        sent_7d: sent7d ?? 0,
        failed_7d: failed7d ?? 0,
        sent_30d: sent30d ?? 0,
        failed_30d: failed30d ?? 0,
        by_template: byTemplate,
        recent_failures: recentFailures ?? [],
      },
    });
  } catch (error) {
    console.error('Error fetching email stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email stats' },
      { status: 500 }
    );
  }
}
