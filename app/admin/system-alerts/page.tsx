'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  HardDrive,
  Clock,
  TrendingUp,
  UserX,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface AlertStats {
  resolvedToday: number;
  lastHealthCheck: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function getAlertTypeIcon(alertType: string) {
  switch (alertType) {
    case 'storage': return HardDrive;
    case 'cron_failure': return Clock;
    case 'error_rate': return TrendingUp;
    case 'login_anomaly': return UserX;
    case 'performance': return Zap;
    default: return AlertCircle;
  }
}

function getAlertTypeLabel(alertType: string): string {
  switch (alertType) {
    case 'storage': return 'Storage';
    case 'cron_failure': return 'Cron Failure';
    case 'error_rate': return 'Error Rate';
    case 'login_anomaly': return 'Login Anomaly';
    case 'performance': return 'Performance';
    default: return alertType;
  }
}

const SEVERITY_ORDER: Record<SystemAlert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function sortAlerts(alerts: SystemAlert[]): SystemAlert[] {
  return [...alerts].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: SystemAlert['severity'] }) {
  const config = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  }[severity];

  const Icon = severity === 'critical' ? AlertTriangle : severity === 'warning' ? AlertCircle : Info;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config}`}>
      <Icon className="w-3 h-3" />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function AlertCard({
  alert,
  onResolve,
  resolving,
}: {
  alert: SystemAlert;
  onResolve: (id: string, resolved: boolean) => void;
  resolving: string | null;
}) {
  const TypeIcon = getAlertTypeIcon(alert.alert_type);

  const cardBorder = {
    critical: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10',
    warning: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10',
    info: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10',
  }[alert.severity];

  const isResolving = resolving === alert.id;

  return (
    <div className={`rounded-lg border-2 p-4 ${cardBorder}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <TypeIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={alert.severity} />
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                {getAlertTypeLabel(alert.alert_type)}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {relativeTime(alert.created_at)}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mt-1">{alert.title}</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{alert.message}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {fmtDateTime(alert.created_at)}
          </p>
        </div>
        <button
          onClick={() => onResolve(alert.id, !alert.is_resolved)}
          disabled={isResolving}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            alert.is_resolved
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isResolving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : alert.is_resolved ? (
            'Unresolve'
          ) : (
            'Resolve'
          )}
        </button>
      </div>
      {alert.is_resolved && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2">
          Resolved by {alert.resolved_by ?? 'unknown'} on {fmtDateTime(alert.resolved_at)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SystemAlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [stats, setStats] = useState<AlertStats>({ resolvedToday: 0, lastHealthCheck: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/admin');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  // Fetch alerts
  const fetchAlerts = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (severityFilter) params.set('severity', severityFilter);

      const res = await fetch(`/api/admin/system-alerts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [typeFilter, severityFilter]);

  useEffect(() => {
    if (currentUser) {
      fetchAlerts();
    }
  }, [currentUser, fetchAlerts]);

  // Resolve/unresolve alert
  const handleResolve = async (id: string, resolved: boolean) => {
    setResolving(id);
    try {
      const res = await fetch('/api/admin/system-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolved }),
      });
      const data = await res.json();
      if (data.success) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? data.alert : a))
        );
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
    } finally {
      setResolving(null);
    }
  };

  if (status === 'loading' || !currentUser) {
    return <PageLoader />;
  }

  // Separate active vs resolved
  const activeAlerts = sortAlerts(
    alerts.filter((a) => !a.is_resolved)
  );
  const resolvedAlerts = sortAlerts(
    alerts.filter((a) => a.is_resolved)
  );

  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter((a) => a.severity === 'warning').length;

  const ALERT_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'storage', label: 'Storage' },
    { value: 'cron_failure', label: 'Cron Failure' },
    { value: 'error_rate', label: 'Error Rate' },
    { value: 'login_anomaly', label: 'Login Anomaly' },
    { value: 'performance', label: 'Performance' },
  ];

  const SEVERITIES = [
    { value: '', label: 'All Severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">System Alerts</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Alerts</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Monitoring and health alerts for the application
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchAlerts(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
            <div className="h-32 bg-white dark:bg-gray-800 rounded-xl" />
            <div className="h-32 bg-white dark:bg-gray-800 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SummaryCard
                label="Active Critical"
                value={criticalCount}
                color={criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}
              />
              <SummaryCard
                label="Active Warnings"
                value={warningCount}
                color={warningCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}
              />
              <SummaryCard
                label="Resolved Today"
                value={stats.resolvedToday}
                color="text-green-600 dark:text-green-400"
              />
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {stats.lastHealthCheck ? relativeTime(stats.lastHealthCheck) : 'Never'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last Health Check</p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ALERT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {(typeFilter || severityFilter) && (
                  <button
                    onClick={() => { setTypeFilter(''); setSeverityFilter(''); }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Active Alerts */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Active Alerts
                {activeAlerts.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 rounded-full">
                    {activeAlerts.length}
                  </span>
                )}
              </h2>

              {activeAlerts.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center gap-3">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                  <p className="font-semibold text-gray-900 dark:text-white">No Active Alerts</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    All systems are operating normally. The health check cron runs every hour.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onResolve={handleResolve}
                      resolving={resolving}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Resolved Alerts (collapsible) */}
            <section>
              <button
                onClick={() => setShowResolved((v) => !v)}
                className="w-full flex items-center justify-between text-left p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Resolved Alerts
                  {resolvedAlerts.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                      {resolvedAlerts.length}
                    </span>
                  )}
                </h2>
                {showResolved ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {showResolved && (
                <div className="mt-3 space-y-3">
                  {resolvedAlerts.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No resolved alerts.
                    </div>
                  ) : (
                    resolvedAlerts.map((alert) => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onResolve={handleResolve}
                        resolving={resolving}
                      />
                    ))
                  )}
                </div>
              )}
            </section>

            {/* Info note */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">About System Alerts</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    The system health cron job runs every hour and checks storage usage, cron job
                    health, error rates, login anomalies, and database performance. Alerts are
                    automatically deduplicated — resolving an alert allows a new one to be created
                    if the issue persists in the next check.
                  </p>
                  <div className="mt-2">
                    <Link
                      href="/admin/system-health"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View detailed System Health dashboard
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
