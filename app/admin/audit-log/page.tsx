'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Shield,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  AlertTriangle,
  FileText,
  ChevronLeft,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  User,
  Zap,
} from 'lucide-react';

import type { CurrentUserMinimal } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditStats {
  total: number;
  today: number;
  topUser: string | null;
  topAction: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ElementType> = {
  view: Eye,
  create: FileText,
  update: Edit,
  delete: Trash2,
  export: Download,
  login: LogIn,
  logout: LogOut,
  access_denied: AlertTriangle,
};

const ACTION_COLORS: Record<string, string> = {
  view: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  update: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  export: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  login: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  logout: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  access_denied: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

const RESOURCE_TYPES = [
  'student',
  'student_list',
  'student_assessment',
  'performance_note',
  'learning_style',
  'cohort',
  'lab_day',
  'scenario',
  'user',
  'guest_access',
  'certification',
  'audit_log',
];

const ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'export',
  'login',
  'logout',
  'access_denied',
];

const LIMIT_OPTIONS = [25, 50, 100, 200];

// ─── Helper components ───────────────────────────────────────────────────────

function UserAvatar({ email }: { email: string | null }) {
  const initial = email ? email[0].toUpperCase() : '?';
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex-shrink-0">
      {initial}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
          {value ?? '—'}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);

  // Filters
  const [userEmail, setUserEmail] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  // ── Auth ──────────────────────────────────────────────────────────────────

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
        setCurrentUser(data.user);
        if (data.user.role !== 'superadmin') {
          router.push('/admin');
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  // ── Data fetching ─────────────────────────────────────────────────────────

  const buildParams = useCallback(
    (extra?: Record<string, string>) => {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (userEmail) params.set('userEmail', userEmail);
      if (action) params.set('action', action);
      if (resourceType) params.set('resourceType', resourceType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search) params.set('search', search);
      if (extra) {
        Object.entries(extra).forEach(([k, v]) => params.set(k, v));
      }
      return params;
    },
    [page, limit, userEmail, action, resourceType, startDate, endDate, search]
  );

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-log?${buildParams()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
    setLoading(false);
  }, [buildParams]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-log?mode=stats');
      const data = await res.json();
      if (data.success) {
        setStats({
          total: data.total,
          today: data.today,
          topUser: data.topUser,
          topAction: data.topAction,
        });
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      fetchAuditLogs();
    }
  }, [currentUser, page, limit, fetchAuditLogs]);

  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      fetchStats();
    }
  }, [currentUser, fetchStats]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSearch = () => {
    setPage(1);
    fetchAuditLogs();
  };

  const handleClearFilters = () => {
    setUserEmail('');
    setAction('');
    setResourceType('');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setPage(1);
  };

  const handleExport = () => {
    const params = buildParams({ mode: 'export' });
    window.open(`/api/admin/audit-log?${params}`, '_blank');
  };

  const handlePurge = async (days: number) => {
    if (!purgeConfirm) {
      setPurgeConfirm(true);
      return;
    }
    setPurging(true);
    try {
      const res = await fetch(`/api/admin/audit-log?days=${days}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert(`Purged ${data.deleted} log entries older than ${days} days.`);
        fetchAuditLogs();
        fetchStats();
      } else {
        alert(data.error || 'Purge failed');
      }
    } catch {
      alert('Purge failed');
    }
    setPurging(false);
    setPurgeConfirm(false);
  };

  // ── Formatting helpers ────────────────────────────────────────────────────

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // ── Render guards ─────────────────────────────────────────────────────────

  if (status === 'loading' || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (currentUser.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Only superadmins can access audit logs.</p>
          <Link href="/admin" className="text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  const hasActiveFilters = userEmail || action || resourceType || startDate || endDate || search;

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Audit Log</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  FERPA compliance — track all access to protected educational records
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => { fetchAuditLogs(); fetchStats(); }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FileText}
            label="Total Entries"
            value={stats ? stats.total.toLocaleString() : '...'}
            color="bg-purple-600"
          />
          <StatCard
            icon={Activity}
            label="Entries Today"
            value={stats ? stats.today.toLocaleString() : '...'}
            color="bg-blue-600"
          />
          <StatCard
            icon={User}
            label="Most Active User (30d)"
            value={stats?.topUser ?? null}
            color="bg-teal-600"
          />
          <StatCard
            icon={Zap}
            label="Most Common Action (30d)"
            value={stats?.topAction ?? null}
            color="bg-indigo-600"
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Filters</h2>
            {hasActiveFilters && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                Active
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="xl:col-span-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                User Email
              </label>
              <input
                type="text"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by email..."
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Entity Type
              </label>
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {RESOURCE_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Search + buttons row */}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search Details
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search in descriptions..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSearch}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table controls bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing <span className="font-medium">{logs.length}</span> of{' '}
            <span className="font-medium">{total.toLocaleString()}</span> entries
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Rows per page:</label>
            <select
              value={limit}
              onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
              className="px-2 py-1 border rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No audit log entries found</p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="mt-3 text-blue-600 hover:underline text-sm"
                >
                  Clear filters to see all entries
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log) => {
                    const ActionIcon = ACTION_ICONS[log.action] || Eye;
                    const isExpanded = expandedRow === log.id;
                    const hasExtra = log.metadata || log.user_agent;

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <UserAvatar email={log.user_email} />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[160px]">
                                  {log.user_email || 'System'}
                                </div>
                                {log.user_role && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                    {log.user_role.replace(/_/g, ' ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                            >
                              <ActionIcon className="w-3 h-3" />
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                              {log.resource_type.replace(/_/g, ' ')}
                            </div>
                            {log.resource_id && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[120px]">
                                {log.resource_id}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-1">
                              <span className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                {log.resource_description || '—'}
                              </span>
                              {hasExtra && (
                                <button
                                  onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                  className="flex-shrink-0 text-blue-500 hover:text-blue-700 dark:text-blue-400 ml-1"
                                  title="Expand details"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                            {log.ip_address || '—'}
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {isExpanded && hasExtra && (
                          <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                            <td colSpan={6} className="px-6 py-3">
                              <div className="space-y-2 text-sm">
                                {log.resource_description && (
                                  <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      Full description:{' '}
                                    </span>
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {log.resource_description}
                                    </span>
                                  </div>
                                )}
                                {log.metadata && (
                                  <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      Metadata:{' '}
                                    </span>
                                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-800 dark:text-gray-200 break-all">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </code>
                                  </div>
                                )}
                                {log.user_agent && (
                                  <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      User Agent:{' '}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                                      {log.user_agent}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{page}</span> of{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                </span>
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Retention / Purge section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            Log Retention Policy
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Purge audit log entries older than a specified number of days. Minimum retention is 30 days.
          </p>
          <div className="flex flex-wrap gap-2">
            {[90, 180, 365].map((days) => (
              <button
                key={days}
                onClick={() => handlePurge(days)}
                disabled={purging}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  purgeConfirm
                    ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                    : 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {purging ? 'Purging...' : purgeConfirm ? `Confirm: Delete older than ${days}d` : `Purge > ${days} days`}
              </button>
            ))}
            {purgeConfirm && (
              <button
                onClick={() => setPurgeConfirm(false)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* FERPA Notice */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-purple-900 dark:text-purple-100">
                FERPA Compliance Notice
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                This audit log tracks all access to protected educational records in compliance with
                the Family Educational Rights and Privacy Act (FERPA). All log entries are retained
                for compliance reporting and security monitoring purposes. Only superadmins may view
                or export this log.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
