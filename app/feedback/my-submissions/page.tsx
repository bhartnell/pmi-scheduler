'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Archive,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Plus,
  FileText,
} from 'lucide-react';

// ---- Types ----

interface FeedbackReport {
  id: string;
  report_type: 'bug' | 'feature' | 'other';
  description: string;
  page_url: string | null;
  user_email: string;
  status: 'new' | 'read' | 'in_progress' | 'needs_investigation' | 'resolved' | 'archived';
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  resolution_notes: string | null;
  screenshot_url: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface Stats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
}

// ---- Config ----

const STATUS_CONFIG = {
  new: {
    label: 'New',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: AlertCircle,
    dotColor: 'bg-blue-500',
  },
  read: {
    label: 'Received',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: Eye,
    dotColor: 'bg-gray-400',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: Clock,
    dotColor: 'bg-amber-500',
  },
  needs_investigation: {
    label: 'Under Review',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    icon: AlertCircle,
    dotColor: 'bg-orange-500',
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    icon: CheckCircle,
    dotColor: 'bg-green-500',
  },
  archived: {
    label: 'Archived',
    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    icon: Archive,
    dotColor: 'bg-gray-400',
  },
};

const TYPE_CONFIG = {
  bug: {
    label: 'Bug Report',
    badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    borderColor: 'border-red-300 dark:border-red-700',
    icon: Bug,
  },
  feature: {
    label: 'Feature Request',
    badgeColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    icon: Lightbulb,
  },
  other: {
    label: 'Feedback',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    borderColor: 'border-blue-300 dark:border-blue-700',
    icon: HelpCircle,
  },
};

type StatusKey = keyof typeof STATUS_CONFIG;
type TypeKey = keyof typeof TYPE_CONFIG;

// ---- Helpers ----

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---- Component ----

export default function MySubmissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, in_progress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, filterType, filterStatus]);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/feedback/my-submissions?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setReports(data.reports || []);
        setStats(data.stats || { total: 0, open: 0, in_progress: 0, resolved: 0 });
      } else {
        setError(data.error || 'Failed to load submissions');
      }
    } catch (err) {
      setError('Failed to load submissions. Please try again.');
    }
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openFeedbackForm = () => {
    const feedbackBtn = document.querySelector<HTMLButtonElement>('[aria-label="Submit Feedback"]');
    feedbackBtn?.click();
  };

  // ---- Loading / auth guard ----

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  // ---- Render helpers ----

  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all';

  const renderCard = (report: FeedbackReport) => {
    const typeConfig = TYPE_CONFIG[report.report_type as TypeKey] || TYPE_CONFIG.other;
    const statusConfig = STATUS_CONFIG[report.status as StatusKey] || STATUS_CONFIG.new;
    const StatusIcon = statusConfig.icon;
    const TypeIcon = typeConfig.icon;
    const isExpanded = expandedIds.has(report.id);
    const isResolved = report.status === 'resolved' || report.status === 'archived';

    return (
      <div
        key={report.id}
        className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden transition-all ${typeConfig.borderColor} ${isResolved ? 'opacity-80' : ''}`}
      >
        {/* Card header — always visible, clickable to expand */}
        <button
          className="w-full text-left px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          onClick={() => toggleExpand(report.id)}
          aria-expanded={isExpanded}
        >
          <div className="flex items-start justify-between gap-3">
            {/* Left: type badge + description preview */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${typeConfig.badgeColor}`}>
                  <TypeIcon className="w-3.5 h-3.5" />
                  {typeConfig.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusConfig.label}
                </span>
              </div>
              <p className={`text-sm text-gray-700 dark:text-gray-200 ${isExpanded ? '' : 'line-clamp-2'}`}>
                {report.description}
              </p>
            </div>

            {/* Right: date + chevron */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {formatDateShort(report.created_at)}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-gray-100 dark:border-gray-700">
            {/* Full description */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Description
              </p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                {report.description}
              </pre>
            </div>

            {/* Meta info */}
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[70px]">Submitted:</span>
                <span>{formatDate(report.created_at)}</span>
              </div>
              {report.page_url && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[70px]">Page:</span>
                  <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                    {report.page_url}
                  </code>
                </div>
              )}
            </div>

            {/* Screenshot */}
            {report.screenshot_url && (
              <div className="px-5 pb-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Screenshot
                </p>
                <a
                  href={report.screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Click to open full size"
                >
                  <img
                    src={report.screenshot_url}
                    alt="Feedback screenshot"
                    className="max-w-xs rounded-lg border border-gray-200 dark:border-gray-600 hover:opacity-80 transition-opacity cursor-zoom-in"
                  />
                </a>
              </div>
            )}

            {/* Resolution notes — only shown if resolved */}
            {isResolved && (
              <div className="px-5 py-4 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-900/40">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                    {report.status === 'archived' ? 'Archived' : 'Resolved'}
                    {report.resolved_at ? ` on ${formatDateShort(report.resolved_at)}` : ''}
                  </p>
                </div>
                {report.resolution_notes ? (
                  <p className="text-sm text-green-700 dark:text-green-400 italic leading-relaxed">
                    {report.resolution_notes}
                  </p>
                ) : (
                  <p className="text-sm text-green-600 dark:text-green-500 italic">
                    No resolution notes provided.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ---- Page render ----

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 dark:text-white">My Feedback</span>
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Feedback</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Track the status of your submitted reports and requests
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSubmissions}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh"
                aria-label="Refresh submissions"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={openFeedbackForm}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Submit New
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Total</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.open}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Open</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.in_progress}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">In Progress</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">Resolved</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="filter-type" className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Type:
              </label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="other">Other Feedback</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-status" className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Status:
              </label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="read">Received</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_investigation">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => { setFilterType('all'); setFilterStatus('all'); }}
                className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">Something went wrong</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={fetchSubmissions}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            {hasActiveFilters ? (
              <>
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-1">No results match your filters</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Try adjusting the type or status filter above.
                </p>
                <button
                  onClick={() => { setFilterType('all'); setFilterStatus('all'); }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  You haven&apos;t submitted any feedback yet
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Found a bug or have a suggestion? Let us know using the feedback form.
                </p>
                <button
                  onClick={openFeedbackForm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Submit Feedback
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(renderCard)}
          </div>
        )}

        {/* Footer nav links */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 pb-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Help Center
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Settings
          </Link>
        </div>
      </main>
    </div>
  );
}
