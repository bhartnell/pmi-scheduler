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
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Download,
  ArrowUpDown
} from 'lucide-react';

interface FeedbackReport {
  id: string;
  report_type: 'bug' | 'feature' | 'other';
  description: string;
  page_url: string | null;
  user_email: string;
  user_agent: string | null;
  status: 'new' | 'in_progress' | 'resolved' | 'wont_fix';
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
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
  bug: { label: 'BUG REPORT', emoji: '', bgColor: 'border-red-500 bg-red-50 dark:bg-red-900/20', headerBg: 'bg-red-100 dark:bg-red-900/40', textColor: 'text-red-700 dark:text-red-300', icon: Bug },
  feature: { label: 'FEATURE REQUEST', emoji: '', bgColor: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20', headerBg: 'bg-yellow-100 dark:bg-yellow-900/40', textColor: 'text-yellow-700 dark:text-yellow-300', icon: Lightbulb },
  other: { label: 'FEEDBACK', emoji: '', bgColor: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20', headerBg: 'bg-blue-100 dark:bg-blue-900/40', textColor: 'text-blue-700 dark:text-blue-300', icon: HelpCircle }
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', emoji: '\uD83D\uDD34', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', dotColor: 'bg-red-500', selectColor: 'text-red-600 dark:text-red-400' },
  high: { label: 'High', emoji: '\uD83D\uDFE0', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', dotColor: 'bg-orange-500', selectColor: 'text-orange-600 dark:text-orange-400' },
  medium: { label: 'Medium', emoji: '\uD83D\uDFE1', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dotColor: 'bg-yellow-500', selectColor: 'text-yellow-600 dark:text-yellow-400' },
  low: { label: 'Low', emoji: '\uD83D\uDFE2', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dotColor: 'bg-green-500', selectColor: 'text-green-600 dark:text-green-400' }
};

export default function FeedbackAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('priority');

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchReports();
    }
  }, [session, filterStatus, filterType, filterPriority, sortBy]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let url = `/api/feedback?sortBy=${sortBy}&`;
      if (filterStatus !== 'all') url += `status=${filterStatus}&`;
      if (filterType !== 'all') url += `type=${filterType}&`;
      if (filterPriority !== 'all') url += `priority=${filterPriority}&`;

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

  const updatePriority = async (id: string, newPriority: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priority: newPriority })
      });

      const data = await res.json();
      if (data.success) {
        setReports(prev => prev.map(r => r.id === id ? data.report : r));
      }
    } catch (error) {
      console.error('Error updating priority:', error);
    }
    setUpdatingId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getPriorityConfig = (priority: string | null) => {
    if (!priority || !PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG]) {
      return PRIORITY_CONFIG.medium; // default to medium
    }
    return PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG];
  };

  const copyForClaude = async (report: FeedbackReport) => {
    const typeLabel = report.report_type === 'bug' ? 'BUG REPORT' :
                      report.report_type === 'feature' ? 'FEATURE REQUEST' : 'FEEDBACK';

    const priorityConfig = getPriorityConfig(report.priority);

    const clipboardText = `## ${typeLabel}

**Priority:** ${priorityConfig.emoji} ${priorityConfig.label}
**Date:** ${formatDate(report.created_at)}
**From:** ${report.user_email}
**Page:** ${report.page_url || 'N/A'}
**Status:** ${STATUS_CONFIG[report.status].label}

### Description
${report.description}

### Browser Info
${report.user_agent || 'Not available'}
`;

    try {
      await navigator.clipboard.writeText(clipboardText);
      setCopiedId(report.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const exportUnresolved = async () => {
    // Filter for unresolved reports (new or in_progress)
    const unresolvedReports = reports.filter(r => r.status === 'new' || r.status === 'in_progress');

    if (unresolvedReports.length === 0) {
      alert('No unresolved feedback to export');
      return;
    }

    // Generate markdown content for all unresolved items
    let markdownContent = `# Unresolved Feedback Report\n\nGenerated: ${new Date().toLocaleString()}\n\nTotal unresolved items: ${unresolvedReports.length}\n\n---\n\n`;

    unresolvedReports.forEach((report, index) => {
      const typeLabel = report.report_type === 'bug' ? 'BUG REPORT' :
                        report.report_type === 'feature' ? 'FEATURE REQUEST' : 'FEEDBACK';
      const priorityConfig = getPriorityConfig(report.priority);

      markdownContent += `## ${index + 1}. ${typeLabel}\n\n`;
      markdownContent += `- **Priority:** ${priorityConfig.emoji} ${priorityConfig.label}\n`;
      markdownContent += `- **Status:** ${STATUS_CONFIG[report.status].label}\n`;
      markdownContent += `- **Date:** ${formatDate(report.created_at)}\n`;
      markdownContent += `- **Reporter:** ${report.user_email}\n`;
      markdownContent += `- **Page:** ${report.page_url || 'N/A'}\n\n`;
      markdownContent += `### Description\n\n${report.description}\n\n`;
      markdownContent += `---\n\n`;
    });

    // Download as file
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unresolved-feedback-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        <div className="max-w-5xl mx-auto px-4 py-6">
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
                  {total} total reports {newCount > 0 && <span className="text-red-600 font-medium">({newCount} new)</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportUnresolved}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Unresolved
              </button>
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
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
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
                <option value="wont_fix">Won&apos;t Fix</option>
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

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Priority:</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="all">All</option>
                <option value="critical">{PRIORITY_CONFIG.critical.emoji} Critical</option>
                <option value="high">{PRIORITY_CONFIG.high.emoji} High</option>
                <option value="medium">{PRIORITY_CONFIG.medium.emoji} Medium</option>
                <option value="low">{PRIORITY_CONFIG.low.emoji} Low</option>
              </select>
            </div>

            <div className="ml-auto">
              <button
                onClick={() => setSortBy(prev => prev === 'priority' ? 'date' : 'priority')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
                Sort: {sortBy === 'priority' ? 'Priority' : 'Date'}
              </button>
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No feedback reports found</p>
            </div>
          ) : (
            reports.map((report) => {
              const typeConfig = TYPE_CONFIG[report.report_type];
              const statusConfig = STATUS_CONFIG[report.status];
              const priorityConfig = getPriorityConfig(report.priority);
              const StatusIcon = statusConfig.icon;
              const TypeIcon = typeConfig.icon;

              return (
                <div
                  key={report.id}
                  className={`rounded-lg border-2 overflow-hidden shadow-sm ${typeConfig.bgColor}`}
                >
                  {/* Header Row */}
                  <div className={`px-4 py-3 ${typeConfig.headerBg} border-b border-gray-200 dark:border-gray-700`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Priority Badge */}
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${priorityConfig.color}`}>
                          {priorityConfig.emoji} {(report.priority || 'medium').toUpperCase()}
                        </span>
                        <TypeIcon className={`w-5 h-5 ${typeConfig.textColor}`} />
                        <span className={`font-bold ${typeConfig.textColor}`}>{typeConfig.label}</span>
                        <span className={`ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        {formatDate(report.created_at)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">From:</span> {report.user_email}
                      {report.page_url && (
                        <span className="ml-4">
                          <span className="font-medium">Page:</span>{' '}
                          <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
                            {report.page_url}
                          </code>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-4 py-4 bg-white dark:bg-gray-800">
                    <pre className="whitespace-pre-wrap font-sans text-gray-900 dark:text-white text-sm leading-relaxed">
                      {report.description}
                    </pre>
                  </div>

                  {/* Resolution Info */}
                  {report.resolved_at && (
                    <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 border-t border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-800 dark:text-green-300">
                        Resolved by <span className="font-medium">{report.resolved_by}</span> on {formatDate(report.resolved_at)}
                      </p>
                      {report.resolution_notes && (
                        <p className="mt-1 text-sm text-green-700 dark:text-green-400 italic">
                          {report.resolution_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex flex-wrap items-center gap-2">
                    {/* Priority Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Priority:</span>
                      <select
                        value={report.priority || 'medium'}
                        onChange={(e) => updatePriority(report.id, e.target.value)}
                        disabled={updatingId === report.id}
                        className={`px-2 py-1 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 disabled:opacity-50 cursor-pointer ${getPriorityConfig(report.priority).selectColor}`}
                      >
                        <option value="critical">{PRIORITY_CONFIG.critical.emoji} Critical</option>
                        <option value="high">{PRIORITY_CONFIG.high.emoji} High</option>
                        <option value="medium">{PRIORITY_CONFIG.medium.emoji} Medium</option>
                        <option value="low">{PRIORITY_CONFIG.low.emoji} Low</option>
                      </select>
                    </div>

                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-500 mx-1" />

                    <button
                      onClick={() => copyForClaude(report)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {copiedId === report.id ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy for Claude
                        </>
                      )}
                    </button>

                    {report.status === 'new' && (
                      <button
                        onClick={() => updateStatus(report.id, 'in_progress')}
                        disabled={updatingId === report.id}
                        className="flex items-center gap-2 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {updatingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                        Mark In Progress
                      </button>
                    )}

                    {report.status !== 'resolved' && (
                      <button
                        onClick={() => updateStatus(report.id, 'resolved')}
                        disabled={updatingId === report.id}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {updatingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Mark Resolved
                      </button>
                    )}

                    {report.status !== 'wont_fix' && report.status !== 'resolved' && (
                      <button
                        onClick={() => updateStatus(report.id, 'wont_fix')}
                        disabled={updatingId === report.id}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Won&apos;t Fix
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
