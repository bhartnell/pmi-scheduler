import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function safeCount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function safeMostRecent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column = 'created_at'
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .order(column, { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return (data as unknown as Record<string, string>)[column] ?? null;
  } catch {
    return null;
  }
}

async function safeCountSince(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  since: string,
  column = 'created_at'
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .gte(column, since);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify admin+ role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !hasMinRole(currentUser.role, 'admin')) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // ─── 1. Table row counts ───────────────────────────────────────────────────
    const tables = [
      'lab_users',
      'students',
      'cohorts',
      'lab_days',
      'lab_stations',
      'scenarios',
      'shifts',
      'shift_signups',
      'tasks',
      'notifications_log',
      'student_clinical_hours',
      'audit_log',
      'instructor_availability',
    ];

    const countResults = await Promise.all(
      tables.map(async (t) => ({ table: t, count: await safeCount(supabase, t) }))
    );

    const tableCounts: Record<string, number | null> = {};
    for (const r of countResults) {
      tableCounts[r.table] = r.count;
    }

    // ─── 2. Recent errors (last 7 days) ───────────────────────────────────────
    let recentErrorCount = 0;
    let recentErrorEntries: Array<{ id: string; action: string; user_email: string | null; created_at: string; description: string | null }> = [];

    try {
      const { count: errCount } = await supabase
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .ilike('action', '%error%')
        .gte('created_at', last7d);
      recentErrorCount = errCount ?? 0;

      const { data: errEntries } = await supabase
        .from('audit_log')
        .select('id, action, user_email, created_at, description')
        .ilike('action', '%error%')
        .gte('created_at', last7d)
        .order('created_at', { ascending: false })
        .limit(10);
      recentErrorEntries = errEntries ?? [];
    } catch {
      // audit_log may not have error rows – silently ignore
    }

    // ─── 3. Recent activity counts ────────────────────────────────────────────
    const activityTables = [
      'lab_users',
      'students',
      'lab_days',
      'scenarios',
      'shifts',
      'shift_signups',
      'tasks',
    ];

    const [counts24h, counts7d, counts30d] = await Promise.all([
      Promise.all(activityTables.map((t) => safeCountSince(supabase, t, last24h))),
      Promise.all(activityTables.map((t) => safeCountSince(supabase, t, last7d))),
      Promise.all(activityTables.map((t) => safeCountSince(supabase, t, last30d))),
    ]);

    const activityMetrics = {
      last24h: counts24h.reduce((a, b) => a + b, 0),
      last7d: counts7d.reduce((a, b) => a + b, 0),
      last30d: counts30d.reduce((a, b) => a + b, 0),
      dailyBreakdown: await buildDailyBreakdown(supabase, activityTables),
    };

    // ─── 4. Cron / scheduled job status ──────────────────────────────────────
    const [lastEmailDigest, lastLabDay, lastShift, lastAuditEntry] = await Promise.all([
      safeMostRecent(supabase, 'notifications_log'),
      safeMostRecent(supabase, 'lab_days', 'updated_at'),
      safeMostRecent(supabase, 'shifts', 'updated_at'),
      safeMostRecent(supabase, 'audit_log'),
    ]);

    const cronStatus = {
      emailDigest: {
        label: 'Email Digest',
        lastRun: lastEmailDigest,
        healthy: lastEmailDigest
          ? new Date(lastEmailDigest).getTime() > now.getTime() - 3 * 24 * 60 * 60 * 1000
          : false,
      },
      certExpiryCheck: {
        label: 'Cert Expiry Check',
        lastRun: lastAuditEntry,
        healthy: lastAuditEntry
          ? new Date(lastAuditEntry).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
          : false,
      },
      labDaySync: {
        label: 'Lab Day Sync',
        lastRun: lastLabDay,
        healthy: lastLabDay !== null,
      },
      shiftUpdates: {
        label: 'Shift Updates',
        lastRun: lastShift,
        healthy: lastShift !== null,
      },
    };

    // ─── 5. Storage estimates (rough, based on row counts × avg sizes) ───────
    const AVG_ROW_BYTES: Record<string, number> = {
      lab_users: 512,
      students: 768,
      cohorts: 256,
      lab_days: 1024,
      lab_stations: 256,
      scenarios: 2048,
      shifts: 512,
      shift_signups: 256,
      tasks: 1024,
      notifications_log: 1536,
      student_clinical_hours: 512,
      audit_log: 768,
      instructor_availability: 256,
    };

    const storageEstimates: Record<string, number> = {};
    let totalBytes = 0;
    for (const t of tables) {
      const rows = tableCounts[t] ?? 0;
      const bytes = rows * (AVG_ROW_BYTES[t] ?? 512);
      storageEstimates[t] = bytes;
      totalBytes += bytes;
    }

    return NextResponse.json({
      success: true,
      tableCounts,
      recentErrors: {
        count: recentErrorCount,
        entries: recentErrorEntries,
      },
      activityMetrics,
      cronStatus,
      storageEstimates: {
        byTable: storageEstimates,
        totalBytes,
        totalMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
      },
      serverTime: now.toISOString(),
      environment: process.env.NODE_ENV ?? 'unknown',
    });
  } catch (error) {
    console.error('System health check failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system health data' },
      { status: 500 }
    );
  }
}

async function buildDailyBreakdown(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tables: string[]
): Promise<Array<{ date: string; count: number }>> {
  const days: Array<{ date: string; count: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const label = dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let dayTotal = 0;
    for (const t of tables) {
      try {
        const { count } = await supabase
          .from(t)
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());
        dayTotal += count ?? 0;
      } catch {
        // Skip table if unavailable
      }
    }

    days.push({ date: label, count: dayTotal });
  }

  return days;
}
