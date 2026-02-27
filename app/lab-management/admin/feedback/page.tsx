'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  Archive,
  Eye,
  FileText,
  Upload,
} from 'lucide-react';

interface FeedbackReport {
  id: string;
  report_type: 'bug' | 'feature' | 'other';
  description: string;
  page_url: string | null;
  user_email: string;
  user_agent: string | null;
  status: 'new' | 'read' | 'in_progress' | 'needs_investigation' | 'resolved' | 'archived';
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  resolution_notes: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  read_at: string | null;
  read_by: string | null;
  archived_at: string | null;
}

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: AlertCircle, dotColor: 'bg-blue-500' },
  read: { label: 'Read', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Eye, dotColor: 'bg-gray-500' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock, dotColor: 'bg-yellow-500' },
  needs_investigation: { label: 'Needs Investigation', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: AlertCircle, dotColor: 'bg-orange-500' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle, dotColor: 'bg-green-500' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: Archive, dotColor: 'bg-gray-400' }
};

const TYPE_CONFIG = {
  bug: { label: 'BUG REPORT', bgColor: 'border-red-500 bg-red-50 dark:bg-red-900/20', headerBg: 'bg-red-100 dark:bg-red-900/40', textColor: 'text-red-700 dark:text-red-300', icon: Bug },
  feature: { label: 'FEATURE REQUEST', bgColor: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20', headerBg: 'bg-yellow-100 dark:bg-yellow-900/40', textColor: 'text-yellow-700 dark:text-yellow-300', icon: Lightbulb },
  other: { label: 'FEEDBACK', bgColor: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20', headerBg: 'bg-blue-100 dark:bg-blue-900/40', textColor: 'text-blue-700 dark:text-blue-300', icon: HelpCircle }
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', emoji: '🔴', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', dotColor: 'bg-red-500', selectColor: 'text-red-600 dark:text-red-400' },
  high: { label: 'High', emoji: '🟠', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', dotColor: 'bg-orange-500', selectColor: 'text-orange-600 dark:text-orange-400' },
  medium: { label: 'Medium', emoji: '🟡', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dotColor: 'bg-yellow-500', selectColor: 'text-yellow-600 dark:text-yellow-400' },
  low: { label: 'Low', emoji: '🟢', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', dotColor: 'bg-green-500', selectColor: 'text-green-600 dark:text-green-400' }
};

type StatusKey = keyof typeof STATUS_CONFIG;

export default function FeedbackAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterReporter, setFilterReporter] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [showArchived, setShowArchived] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [resolvedCollapsed, setResolvedCollapsed] = useState(false);
  const [editingResolutionId, setEditingResolutionId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ updated: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchReports();
    }
  }, [session, filterStatus, filterType, filterPriority, filterReporter, sortBy, showArchived]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let url = `/api/feedback?sortBy=${sortBy}&showArchived=${showArchived}&`;
      if (filterStatus !== 'all') url += `status=${filterStatus}&`;
      if (filterType !== 'all') url += `type=${filterType}&`;
      if (filterPriority !== 'all') url += `priority=${filterPriority}&`;
      if (filterReporter !== 'all') url += `reporter=${filterReporter}&`;

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

  const updateStatus = async (id: string, newStatus: StatusKey) => {
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

  const saveResolutionNotes = async (id: string, notes: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resolution_notes: notes })
      });

      const data = await res.json();
      if (data.success) {
        setReports(prev => prev.map(r => r.id === id ? data.report : r));
        setEditingResolutionId(null);
      }
    } catch (error) {
      console.error('Error saving resolution notes:', error);
    }
    setUpdatingId(null);
  };

  const handleCardExpand = async (report: FeedbackReport) => {
    const newExpanded = new Set(expandedIds);
    if (expandedIds.has(report.id)) {
      newExpanded.delete(report.id);
    } else {
      newExpanded.add(report.id);
      // Auto-mark as read if status is new
      if (report.status === 'new') {
        await updateStatus(report.id, 'read');
      }
    }
    setExpandedIds(newExpanded);
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
      return PRIORITY_CONFIG.medium;
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

  const exportCSV = async () => {
    const csvRows = [
      ['id', 'Date', 'Type', 'Priority', 'Status', 'Reporter', 'Page', 'Description', 'Resolution Notes'].join(',')
    ];

    reports.forEach(r => {
      const row = [
        r.id,
        formatDate(r.created_at),
        TYPE_CONFIG[r.report_type].label,
        (r.priority || 'medium').toUpperCase(),
        STATUS_CONFIG[r.status].label,
        r.user_email,
        r.page_url || 'N/A',
        `"${r.description.replace(/"/g, '""')}"`,
        r.resolution_notes ? `"${r.resolution_notes.replace(/"/g, '""')}"` : ''
      ].join(',');
      csvRows.push(row);
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (file: File) => {
    setImporting(true);
    setImportResult(null);

    try {
      // Preview: count rows to confirm
      const text = await file.text();
      const lines = text.trim().split('\n').filter(l => l.trim());
      const dataRows = lines.length - 1; // exclude header

      if (dataRows <= 0) {
        setImportResult({ updated: 0, skipped: 0, errors: ['CSV file has no data rows'] });
        setImporting(false);
        return;
      }

      // Confirm with user
      const proceed = window.confirm(`Import will process ${dataRows} feedback item${dataRows !== 1 ? 's' : ''}. Continue?`);
      if (!proceed) {
        setImporting(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/feedback/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setImportResult({
          updated: data.updated || 0,
          skipped: data.skipped || 0,
          errors: data.errors || [],
        });
        // Refresh the list
        fetchReports();
      } else {
        setImportResult({ updated: 0, skipped: 0, errors: [data.error || 'Import failed'] });
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({ updated: 0, skipped: 0, errors: ['Failed to process import'] });
    }
    setImporting(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetFilters = () => {
    setFilterStatus('all');
    setFilterType('all');
    setFilterPriority('all');
    setFilterReporter('all');
    setSortBy('priority');
    setShowArchived(false);
  };

  // Get unique reporters for filter
  const uniqueReporters = Array.from(new Set(reports.map(r => r.user_email))).sort();

  // Group reports by status
  const groupedReports: Record<StatusKey, FeedbackReport[]> = {
    new: [],
    read: [],
    in_progress: [],
    needs_investigation: [],
    resolved: [],
    archived: []
  };

  reports.forEach(report => {
    if (groupedReports[report.status]) {
      groupedReports[report.status].push(report);
    }
  });

  // Status counts for summary bar
  const statusCounts = {
    new: groupedReports.new.length,
    read: groupedReports.read.length,
    in_progress: groupedReports.in_progress.length,
    needs_investigation: groupedReports.needs_investigation.length,
    resolved: groupedReports.resolved.length,
    archived: groupedReports.archived.length
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
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
                  {total} total {showArchived ? '(including archived)' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportCSV(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing...' : 'Import Updates'}
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Import Result Banner */}
        {importResult && (
          <div className={`rounded-lg p-4 ${importResult.errors.length > 0 && importResult.updated === 0 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {importResult.updated > 0 ? (
                    <>Updated {importResult.updated} item{importResult.updated !== 1 ? 's' : ''}{importResult.skipped > 0 ? `, skipped ${importResult.skipped} unchanged` : ''}</>
                  ) : (
                    'No items updated'
                  )}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                    {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
              <button onClick={() => setImportResult(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}

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
                <option value="read">Read</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_investigation">Needs Investigation</option>
                <option value="resolved">Resolved</option>
                {showArchived && <option value="archived">Archived</option>}
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
              <label className="text-sm text-gray-600 dark:text-gray-400">Reporter:</label>
              <select
                value={filterReporter}
                onChange={(e) => setFilterReporter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="all">All</option>
                {uniqueReporters.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
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

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="priority">Priority</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showArchived"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="showArchived" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                Show Archived
              </label>
            </div>

            <button
              onClick={resetFilters}
              className="ml-auto px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG.new.dotColor}`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusCounts.new} New</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG.read.dotColor}`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusCounts.read} Read</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG.in_progress.dotColor}`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusCounts.in_progress} In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG.needs_investigation.dotColor}`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusCounts.needs_investigation} Investigate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG.resolved.dotColor}`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusCounts.resolved} Resolved</span>
            </div>
            {showArchived && (
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG.archived.dotColor}`}></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusCounts.archived} Archived</span>
              </div>
            )}
          </div>
        </div>

        {/* Render function for feedback cards */}
        {(() => {
          const renderFeedbackCard = (report: FeedbackReport) => {
            const typeConfig = TYPE_CONFIG[report.report_type];
            const statusConfig = STATUS_CONFIG[report.status];
            const priorityConfig = getPriorityConfig(report.priority);
            const StatusIcon = statusConfig.icon;
            const TypeIcon = typeConfig.icon;
            const isExpanded = expandedIds.has(report.id);

            const cardStyles = report.status === 'new'
              ? 'font-semibold bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
              : report.status === 'read'
              ? 'bg-white dark:bg-gray-800'
              : report.status === 'in_progress'
              ? 'bg-white dark:bg-gray-800 border-l-4 border-yellow-500'
              : report.status === 'needs_investigation'
              ? 'bg-white dark:bg-gray-800 border-l-4 border-orange-500'
              : report.status === 'resolved'
              ? 'opacity-70 bg-gray-50 dark:bg-gray-900'
              : 'opacity-50 bg-gray-50 dark:bg-gray-900';

            return (
              <div
                key={report.id}
                className={`rounded-lg border-2 overflow-hidden shadow-sm ${typeConfig.bgColor} ${cardStyles}`}
              >
                {/* Header Row - Clickable to expand */}
                <div
                  className={`px-4 py-3 ${typeConfig.headerBg} border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity`}
                  onClick={() => handleCardExpand(report)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${priorityConfig.color}`}>
                        {priorityConfig.emoji} {(report.priority || 'medium').toUpperCase()}
                      </span>
                      <TypeIcon className={`w-5 h-5 ${typeConfig.textColor}`} />
                      <span className={`font-bold ${typeConfig.textColor}`}>{typeConfig.label}</span>
                      <span className={`ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
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
                  {!isExpanded && (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 truncate">
                      {report.description}
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <>
                    <div className="px-4 py-4 bg-white dark:bg-gray-800">
                      <pre className="whitespace-pre-wrap font-sans text-gray-900 dark:text-white text-sm leading-relaxed">
                        {report.description}
                      </pre>

                      {/* Screenshot preview */}
                      {report.screenshot_url && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Screenshot:</p>
                          <a
                            href={report.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Click to open full-size"
                          >
                            <img
                              src={report.screenshot_url}
                              alt="Feedback screenshot"
                              className="max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity cursor-zoom-in"
                            />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Resolution Info */}
                    {report.status === 'resolved' && (
                      <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
                        {editingResolutionId === report.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={resolutionText}
                              onChange={(e) => setResolutionText(e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                              rows={3}
                              placeholder="Enter resolution notes..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveResolutionNotes(report.id, resolutionText)}
                                disabled={updatingId === report.id}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingResolutionId(null)}
                                className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {report.resolved_at && (
                              <p className="text-sm text-green-800 dark:text-green-300">
                                Resolved by <span className="font-medium">{report.resolved_by}</span> on {formatDate(report.resolved_at)}
                              </p>
                            )}
                            {report.resolution_notes ? (
                              <p className="mt-1 text-sm text-green-700 dark:text-green-400 italic">
                                {report.resolution_notes}
                              </p>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingResolutionId(report.id);
                                  setResolutionText(report.resolution_notes || '');
                                }}
                                className="mt-1 text-sm text-green-600 hover:text-green-700 underline"
                              >
                                Add resolution notes
                              </button>
                            )}
                          </>
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

                      {/* Status Dropdown */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Status:</span>
                        <select
                          value={report.status}
                          onChange={(e) => updateStatus(report.id, e.target.value as StatusKey)}
                          disabled={updatingId === report.id}
                          className="px-2 py-1 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="new">New</option>
                          <option value="read">Read</option>
                          <option value="in_progress">In Progress</option>
                          <option value="needs_investigation">Needs Investigation</option>
                          <option value="resolved">Resolved</option>
                          <option value="archived">Archived</option>
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

                      {report.status !== 'archived' && (
                        <button
                          onClick={() => updateStatus(report.id, 'archived')}
                          disabled={updatingId === report.id}
                          className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {updatingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                          Archive
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          };

          // Main render logic
          if (reports.length === 0) {
            return (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No feedback reports found</p>
              </div>
            );
          }

          const statusOrder: StatusKey[] = ['new', 'read', 'in_progress', 'needs_investigation', 'resolved'];
          if (showArchived) statusOrder.push('archived');

          return (
            <div className="space-y-6">
              {statusOrder.map(statusKey => {
                const items = groupedReports[statusKey];
                if (items.length === 0) return null;

                const isResolved = statusKey === 'resolved';
                const sectionTitle = STATUS_CONFIG[statusKey].label.toUpperCase();

                return (
                  <div key={statusKey} className="space-y-3">
                    <div
                      className={`flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600 pb-2 ${isResolved ? 'cursor-pointer hover:text-gray-800 dark:hover:text-gray-200' : ''}`}
                      onClick={isResolved ? () => setResolvedCollapsed(!resolvedCollapsed) : undefined}
                    >
                      <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[statusKey].dotColor}`}></div>
                      <span>{sectionTitle} ({items.length})</span>
                      {isResolved && (
                        resolvedCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                      )}
                    </div>
                    {!(isResolved && resolvedCollapsed) && (
                      <div className="space-y-3">
                        {items.map(renderFeedbackCard)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
