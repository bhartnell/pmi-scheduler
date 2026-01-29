'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface FeedbackReport {
  id: string;
  report_type: 'bug' | 'feature' | 'other';
  description: string;
  page_url: string | null;
  user_email: string;
  user_agent: string | null;
  status: 'new' | 'in_progress' | 'resolved' | 'wont_fix';
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: XCircle }
};

const TYPE_CONFIG = {
  bug: { label: 'Bug', color: 'text-red-600 dark:text-red-400', icon: Bug },
  feature: { label: 'Feature', color: 'text-yellow-600 dark:text-yellow-400', icon: Lightbulb },
  other: { label: 'Other', color: 'text-blue-600 dark:text-blue-400', icon: HelpCircle }
};

export default function FeedbackAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchReports();
    }
  }, [session, filterStatus, filterType]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let url = '/api/feedback?';
      if (filterStatus !== 'all') url += `status=${filterStatus}&`;
      if (filterType !== 'all') url += `type=${filterType}&`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setReports(data.reports || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });

      const data = await res.json();
      if (data.success) {
        setReports(prev => prev.map(r => r.id === id ? data.report : r));
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
    setUpdatingId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const newCount = reports.filter(r => r.status === 'new').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Feedback Reports</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback Reports</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {total} total reports {newCount > 0 && <span className="text-red-600">({newCount} new)</span>}
                </p>
              </div>
            </div>
            <button
              onClick={fetchReports}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="wont_fix">Won't Fix</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="all">All</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No feedback reports found</p>
            </div>
          ) : (
            reports.map((report) => {
              const statusConfig = STATUS_CONFIG[report.status];
              const typeConfig = TYPE_CONFIG[report.report_type];
              const StatusIcon = statusConfig.icon;
              const TypeIcon = typeConfig.icon;
              const isExpanded = expandedId === report.id;

              return (
                <div
                  key={report.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
                >
                  {/* Main Row */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Badge */}
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </div>

                      {/* Type Icon */}
                      <TypeIcon className={`w-5 h-5 mt-0.5 ${typeConfig.color}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                          <span>{report.user_email}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(report.created_at)}</span>
                          {report.page_url && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-xs truncate max-w-[200px]">{report.page_url}</span>
                            </>
                          )}
                        </div>
                        <p className={`text-gray-900 dark:text-white ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {report.description}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {formatDate(report.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t dark:border-gray-700 pt-4 space-y-4">
                      {/* Full Description */}
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Description</label>
                        <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap">{report.description}</p>
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <label className="text-gray-500 dark:text-gray-400">Page</label>
                          <p className="font-mono text-xs text-gray-900 dark:text-white break-all">
                            {report.page_url || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <label className="text-gray-500 dark:text-gray-400">User</label>
                          <p className="text-gray-900 dark:text-white">{report.user_email}</p>
                        </div>
                        <div>
                          <label className="text-gray-500 dark:text-gray-400">Browser</label>
                          <p className="text-gray-900 dark:text-white text-xs truncate">
                            {report.user_agent ? report.user_agent.split(' ').slice(-2).join(' ') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <label className="text-gray-500 dark:text-gray-400">Submitted</label>
                          <p className="text-gray-900 dark:text-white">{formatDate(report.created_at)}</p>
                        </div>
                      </div>

                      {/* Resolution Info */}
                      {report.resolved_at && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-sm text-green-800 dark:text-green-300">
                            Resolved by {report.resolved_by} on {formatDate(report.resolved_at)}
                          </p>
                          {report.resolution_notes && (
                            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                              {report.resolution_notes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        {report.status !== 'resolved' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(report.id, 'resolved'); }}
                            disabled={updatingId === report.id}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                          >
                            {updatingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Mark Resolved
                          </button>
                        )}
                        {report.status === 'new' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(report.id, 'in_progress'); }}
                            disabled={updatingId === report.id}
                            className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm disabled:opacity-50"
                          >
                            <Clock className="w-4 h-4" />
                            Mark In Progress
                          </button>
                        )}
                        {report.status !== 'wont_fix' && report.status !== 'resolved' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(report.id, 'wont_fix'); }}
                            disabled={updatingId === report.id}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Won't Fix
                          </button>
                        )}
                        {report.page_url && (
                          <Link
                            href={report.page_url}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Visit Page
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
