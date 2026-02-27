import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertInsert {
  alert_type: 'storage' | 'cron_failure' | 'error_rate' | 'login_anomaly' | 'performance';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helper: create alert if no unresolved alert of the same type already exists
// ---------------------------------------------------------------------------
async function maybeCreateAlert(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  alert: AlertInsert
): Promise<'created' | 'deduplicated'> {
  // Check for existing unresolved alert of the same type
  const { data: existing } = await supabase
    .from('system_alerts')
    .select('id')
    .eq('alert_type', alert.alert_type)
    .eq('resolved', false)
    .limit(1)
    .single();

  if (existing) {
    return 'deduplicated';
  }

  await supabase.from('system_alerts').insert({
    alert_type: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    metadata: alert.metadata ?? null,
    resolved: false,
  });

  return 'created';
}

// ---------------------------------------------------------------------------
// Check 1: Storage usage (estimated from row counts × avg row sizes)
// ---------------------------------------------------------------------------
async function checkStorage(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ triggered: boolean; result: string }> {
  try {
    const tables = [
      'lab_users', 'students', 'cohorts', 'lab_days', 'lab_stations',
      'scenarios', 'shifts', 'shift_signups', 'tasks', 'notifications_log',
      'student_clinical_hours', 'audit_log', 'instructor_availability',
    ];

    const AVG_ROW_BYTES: Record<string, number> = {
      lab_users: 512, students: 768, cohorts: 256, lab_days: 1024,
      lab_stations: 256, scenarios: 2048, shifts: 512, shift_signups: 256,
      tasks: 1024, notifications_log: 1536, student_clinical_hours: 512,
      audit_log: 768, instructor_availability: 256,
    };

    let totalBytes = 0;
    for (const table of tables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true });
        const rows = count ?? 0;
        totalBytes += rows * (AVG_ROW_BYTES[table] ?? 512);
      } catch {
        // skip unavailable tables
      }
    }

    const totalMB = totalBytes / 1024 / 1024;
    // Free Supabase tier is 500 MB; alert at 80% = 400 MB
    const THRESHOLD_MB = 400;

    if (totalMB > THRESHOLD_MB) {
      const pct = Math.round((totalMB / 500) * 100);
      await maybeCreateAlert(supabase, {
        alert_type: 'storage',
        severity: totalMB > 450 ? 'critical' : 'warning',
        title: 'High Storage Usage',
        message: `Estimated database size is ${totalMB.toFixed(1)} MB (${pct}% of 500 MB free tier). Consider archiving old records.`,
        metadata: { totalMB: Math.round(totalMB * 100) / 100, thresholdMB: THRESHOLD_MB },
      });
      return { triggered: true, result: `${totalMB.toFixed(1)} MB (above threshold)` };
    }

    return { triggered: false, result: `${totalMB.toFixed(1)} MB (ok)` };
  } catch (err) {
    console.error('[SYSTEM-HEALTH] Storage check error:', err);
    return { triggered: false, result: 'check failed' };
  }
}

// ---------------------------------------------------------------------------
// Check 2: Cron job health (look at last run timestamps)
// ---------------------------------------------------------------------------
async function checkCronHealth(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ triggered: boolean; result: string }> {
  try {
    const now = Date.now();
    const issues: string[] = [];

    // Email digest: should run daily. Alert if no notification in last 3 days.
    const { data: lastNotif } = await supabase
      .from('notifications_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastNotifTime = lastNotif?.created_at
      ? new Date(lastNotif.created_at).getTime()
      : 0;
    const notifAgeDays = (now - lastNotifTime) / (1000 * 60 * 60 * 24);

    if (notifAgeDays > 3) {
      issues.push(`Email digest hasn't run in ${Math.round(notifAgeDays)} days`);
    }

    // Audit log: should have recent entries (any activity). Alert if nothing in 7 days.
    const { data: lastAudit } = await supabase
      .from('audit_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastAuditTime = lastAudit?.created_at
      ? new Date(lastAudit.created_at).getTime()
      : 0;
    const auditAgeDays = (now - lastAuditTime) / (1000 * 60 * 60 * 24);

    if (auditAgeDays > 7) {
      issues.push(`Audit log has had no entries in ${Math.round(auditAgeDays)} days`);
    }

    if (issues.length > 0) {
      await maybeCreateAlert(supabase, {
        alert_type: 'cron_failure',
        severity: 'warning',
        title: 'Scheduled Job May Be Stale',
        message: issues.join('. ') + '.',
        metadata: {
          notifLastRunDaysAgo: Math.round(notifAgeDays),
          auditLastEntryDaysAgo: Math.round(auditAgeDays),
        },
      });
      return { triggered: true, result: issues.join('; ') };
    }

    return { triggered: false, result: 'all jobs healthy' };
  } catch (err) {
    console.error('[SYSTEM-HEALTH] Cron health check error:', err);
    return { triggered: false, result: 'check failed' };
  }
}

// ---------------------------------------------------------------------------
// Check 3: Error rate (bug feedback reports in last 24 hours)
// ---------------------------------------------------------------------------
async function checkErrorRate(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ triggered: boolean; result: string }> {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const BUG_THRESHOLD = 10;

    const { count } = await supabase
      .from('feedback_reports')
      .select('id', { count: 'exact', head: true })
      .eq('report_type', 'bug')
      .gte('created_at', since24h);

    const bugCount = count ?? 0;

    if (bugCount > BUG_THRESHOLD) {
      await maybeCreateAlert(supabase, {
        alert_type: 'error_rate',
        severity: bugCount > 20 ? 'critical' : 'warning',
        title: 'High Bug Report Rate',
        message: `${bugCount} bug reports submitted in the last 24 hours (threshold: ${BUG_THRESHOLD}). Review feedback for patterns.`,
        metadata: { bugCount, threshold: BUG_THRESHOLD, since: since24h },
      });
      return { triggered: true, result: `${bugCount} bug reports (above threshold)` };
    }

    return { triggered: false, result: `${bugCount} bug reports (ok)` };
  } catch (err) {
    console.error('[SYSTEM-HEALTH] Error rate check error:', err);
    return { triggered: false, result: 'check failed' };
  }
}

// ---------------------------------------------------------------------------
// Check 4: Login anomalies (high volume of access requests in a day)
// ---------------------------------------------------------------------------
async function checkLoginAnomalies(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ triggered: boolean; result: string }> {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const ACCESS_REQUEST_THRESHOLD = 20;

    const { count } = await supabase
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h);

    const requestCount = count ?? 0;

    if (requestCount > ACCESS_REQUEST_THRESHOLD) {
      await maybeCreateAlert(supabase, {
        alert_type: 'login_anomaly',
        severity: requestCount > 40 ? 'critical' : 'warning',
        title: 'Unusual Access Request Volume',
        message: `${requestCount} new access requests submitted in the last 24 hours (threshold: ${ACCESS_REQUEST_THRESHOLD}). This may indicate unusual sign-up activity.`,
        metadata: { requestCount, threshold: ACCESS_REQUEST_THRESHOLD, since: since24h },
      });
      return { triggered: true, result: `${requestCount} access requests (above threshold)` };
    }

    return { triggered: false, result: `${requestCount} access requests (ok)` };
  } catch (err) {
    console.error('[SYSTEM-HEALTH] Login anomaly check error:', err);
    return { triggered: false, result: 'check failed' };
  }
}

// ---------------------------------------------------------------------------
// Check 5: Performance (large table sizes that may need maintenance)
// ---------------------------------------------------------------------------
async function checkPerformance(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ triggered: boolean; result: string }> {
  try {
    const AUDIT_LOG_THRESHOLD = 50000;
    const NOTIFICATIONS_THRESHOLD = 20000;
    const issues: string[] = [];

    const { count: auditCount } = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true });

    const { count: notifCount } = await supabase
      .from('notifications_log')
      .select('id', { count: 'exact', head: true });

    if ((auditCount ?? 0) > AUDIT_LOG_THRESHOLD) {
      issues.push(`audit_log has ${auditCount?.toLocaleString()} rows (consider archiving)`);
    }

    if ((notifCount ?? 0) > NOTIFICATIONS_THRESHOLD) {
      issues.push(`notifications_log has ${notifCount?.toLocaleString()} rows (consider pruning)`);
    }

    if (issues.length > 0) {
      await maybeCreateAlert(supabase, {
        alert_type: 'performance',
        severity: 'info',
        title: 'Large Tables Detected',
        message: issues.join('. ') + '. Large tables may slow down queries over time.',
        metadata: {
          auditLogCount: auditCount ?? 0,
          notificationsLogCount: notifCount ?? 0,
        },
      });
      return { triggered: true, result: issues.join('; ') };
    }

    return { triggered: false, result: 'all table sizes healthy' };
  } catch (err) {
    console.error('[SYSTEM-HEALTH] Performance check error:', err);
    return { triggered: false, result: 'check failed' };
  }
}

// ---------------------------------------------------------------------------
// GET /api/cron/system-health
//
// Vercel cron endpoint. Runs every hour (0 * * * *).
// Auth: Bearer token via CRON_SECRET env var.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[SYSTEM-HEALTH] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[SYSTEM-HEALTH] Health check cron started at', new Date().toISOString());

  const supabase = getSupabaseAdmin();

  // Run all checks in parallel, tolerating individual failures
  const [storageResult, cronResult, errorRateResult, loginResult, perfResult] =
    await Promise.allSettled([
      checkStorage(supabase),
      checkCronHealth(supabase),
      checkErrorRate(supabase),
      checkLoginAnomalies(supabase),
      checkPerformance(supabase),
    ]);

  const results = {
    storage: storageResult.status === 'fulfilled' ? storageResult.value : { triggered: false, result: 'check threw' },
    cronHealth: cronResult.status === 'fulfilled' ? cronResult.value : { triggered: false, result: 'check threw' },
    errorRate: errorRateResult.status === 'fulfilled' ? errorRateResult.value : { triggered: false, result: 'check threw' },
    loginAnomalies: loginResult.status === 'fulfilled' ? loginResult.value : { triggered: false, result: 'check threw' },
    performance: perfResult.status === 'fulfilled' ? perfResult.value : { triggered: false, result: 'check threw' },
  };

  const alertsCreated = Object.values(results).filter((r) => r.triggered).length;

  const summary = {
    success: true,
    alertsCreated,
    checks: results,
    duration_ms: Date.now() - startTime,
    checkedAt: new Date().toISOString(),
  };

  console.log('[SYSTEM-HEALTH] Completed:', {
    alertsCreated,
    duration_ms: summary.duration_ms,
  });

  return NextResponse.json(summary);
}
