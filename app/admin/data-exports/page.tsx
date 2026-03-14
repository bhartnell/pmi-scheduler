'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Download,
  Archive,
  Clock,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Trash2,
  HardDrive,
  Calendar,
  FolderOpen,
  ExternalLink,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { formatCohortNumber } from '@/lib/format-cohort';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportArchive {
  id: string;
  export_type: 'weekly' | 'semester_end' | 'course_end' | 'manual';
  label: string | null;
  cohort_id: string | null;
  folder_path: string;
  files: { name: string; path: string; size: number; row_count: number }[];
  total_size: number;
  total_records: number;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  status: string;
}

interface Cohort {
  id: string;
  cohort_number: number | string;
  program?: { name: string; abbreviation: string };
  current_semester?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_COLORS: Record<string, string> = {
  weekly: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  semester_end: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  course_end: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  manual: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const TYPE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  semester_end: 'Semester End',
  course_end: 'Course End',
  manual: 'Manual',
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DataExportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<{ role: string; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Archives
  const [archives, setArchives] = useState<ExportArchive[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Cohorts
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

  // Export actions
  const [exporting, setExporting] = useState<string | null>(null); // action being performed
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Semester archive modal
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [semesterLabel, setSemesterLabel] = useState('');

  // Course archive modal
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseLabel, setCourseLabel] = useState('');
  const [selectedCohortId, setSelectedCohortId] = useState('');

  // Download modal
  const [downloadArchive, setDownloadArchive] = useState<ExportArchive | null>(null);
  const [downloadUrls, setDownloadUrls] = useState<{ name: string; url: string; size: number; row_count: number }[]>([]);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) fetchCurrentUser();
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        fetchArchives();
        fetchCohorts();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchArchives = useCallback(async (type?: string) => {
    setArchivesLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      const res = await fetch(`/api/admin/data-exports?${params}`);
      const data = await res.json();
      if (data.success) setArchives(data.archives || []);
    } catch (error) {
      console.error('Error fetching archives:', error);
    }
    setArchivesLoading(false);
  }, []);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=false&include_archived=true');
      const data = await res.json();
      if (data.success) setCohorts(data.cohorts || []);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  // ---------------------------------------------------------------------------
  // Export actions
  // ---------------------------------------------------------------------------

  const triggerExport = async (action: string, label?: string, cohortId?: string) => {
    setExporting(action);
    setExportSuccess(null);
    setExportError(null);

    try {
      const res = await fetch('/api/admin/data-exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, label, cohort_id: cohortId }),
      });
      const data = await res.json();

      if (data.success) {
        setExportSuccess(
          `Export complete: ${data.archive.total_records} records across ${data.archive.files?.length || 0} files (${formatBytes(data.archive.total_size)})`
        );
        fetchArchives(typeFilter || undefined);
      } else {
        setExportError(data.error || 'Export failed');
      }
    } catch (error) {
      setExportError('An unexpected error occurred');
    }
    setExporting(null);
  };

  const handleDownload = async (archive: ExportArchive) => {
    setDownloadArchive(archive);
    setDownloadLoading(true);
    setDownloadUrls([]);

    try {
      const res = await fetch(`/api/admin/data-exports/${archive.id}/download`);
      const data = await res.json();
      if (data.success) setDownloadUrls(data.files || []);
    } catch (error) {
      console.error('Error getting download URLs:', error);
    }
    setDownloadLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Data Export Archives</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Archive className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Export Archives</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Automated weekly exports, semester archives, and manual backups stored in Supabase Storage
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Manual Export */}
          <button
            onClick={() => triggerExport('manual')}
            disabled={!!exporting}
            className="text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800 disabled:opacity-50"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Export All Now</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Export all critical data tables to CSV and store in Supabase Storage
            </p>
            {exporting === 'manual' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Exporting...
              </div>
            )}
          </button>

          {/* Semester Archive */}
          <button
            onClick={() => {
              setSemesterLabel(`Spring ${new Date().getFullYear()}`);
              setShowSemesterModal(true);
            }}
            disabled={!!exporting}
            className="text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800 disabled:opacity-50"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Semester Archive</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Archive all data for a semester — permanent storage, not auto-deleted
            </p>
          </button>

          {/* Course Archive */}
          <button
            onClick={() => {
              setCourseLabel('');
              setSelectedCohortId('');
              setShowCourseModal(true);
            }}
            disabled={!!exporting}
            className="text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-green-200 dark:hover:border-green-800 disabled:opacity-50"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FolderOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Course Archive</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Archive data for a specific cohort semester — permanent storage
            </p>
          </button>

          {/* Google Drive (Future) */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow opacity-50 cursor-not-allowed border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <ExternalLink className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-500 dark:text-gray-400 text-sm">Google Drive</h3>
            </div>
            <p className="text-xs text-gray-400">Coming soon — push exports to shared Google Drive</p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {exportSuccess && (
          <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Export successful</p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">{exportSuccess}</p>
            </div>
            <button onClick={() => setExportSuccess(null)} className="ml-auto text-green-400 hover:text-green-600">×</button>
          </div>
        )}
        {exportError && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-100">Export failed</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{exportError}</p>
            </div>
            <button onClick={() => setExportError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['weekly', 'semester_end', 'course_end', 'manual'] as const).map((type) => {
            const count = archives.filter((a) => a.export_type === type).length;
            return (
              <div key={type} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{TYPE_LABELS[type]} exports</div>
              </div>
            );
          })}
        </div>

        {/* Export History Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" /> Export History
            </h2>
            <div className="flex items-center gap-3">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  fetchArchives(e.target.value || undefined);
                }}
                className="px-3 py-1.5 border rounded-lg text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="">All Types</option>
                <option value="weekly">Weekly</option>
                <option value="semester_end">Semester End</option>
                <option value="course_end">Course End</option>
                <option value="manual">Manual</option>
              </select>
              <button
                onClick={() => fetchArchives(typeFilter || undefined)}
                disabled={archivesLoading}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${archivesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {archivesLoading && archives.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : archives.length === 0 ? (
            <div className="p-8 text-center">
              <Archive className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No export archives yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Use the buttons above to create your first export, or wait for the weekly cron job
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Label</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Files</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Records</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {archives.map((archive) => (
                    <tr key={archive.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        <div>{formatDate(archive.created_at)}</div>
                        <div className="text-xs text-gray-400">{timeAgo(archive.created_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[archive.export_type] || TYPE_COLORS.manual}`}>
                          {TYPE_LABELS[archive.export_type] || archive.export_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {archive.label || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {archive.files?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {(archive.total_records || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatBytes(archive.total_size || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {archive.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" /> Completed
                          </span>
                        ) : archive.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-3 h-3" /> Failed
                          </span>
                        )}
                        {archive.expires_at && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Expires {new Date(archive.expires_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(archive)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Data Protection Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-blue-500" /> Data Protection Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="font-medium text-green-800 dark:text-green-300">FK Cascade Protection</div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                199 CASCADE FKs changed to RESTRICT across all core tables
              </div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="font-medium text-green-800 dark:text-green-300">Delete Triggers</div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                16 row-level + 15 mass delete protection triggers active
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="font-medium text-blue-800 dark:text-blue-300">Weekly Exports</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Automated every Sunday night, retained 90 days
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Semester Archive Modal */}
      {showSemesterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Semester Archive</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Archive Label
                </label>
                <input
                  type="text"
                  value={semesterLabel}
                  onChange={(e) => setSemesterLabel(e.target.value)}
                  placeholder="e.g., Spring 2026"
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This will export all critical data tables and store them permanently in Supabase Storage under <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">semester-end/{semesterLabel.toLowerCase().replace(/\s+/g, '-') || '...'}</code>
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSemesterModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSemesterModal(false);
                  triggerExport('semester_end', semesterLabel);
                }}
                disabled={!semesterLabel.trim()}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                <Archive className="w-4 h-4 inline mr-1" /> Create Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Archive Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Course Archive</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Cohort
                </label>
                <select
                  value={selectedCohortId}
                  onChange={(e) => {
                    setSelectedCohortId(e.target.value);
                    const c = cohorts.find((x) => x.id === e.target.value);
                    if (c) {
                      setCourseLabel(`${c.program?.abbreviation || 'PM'} Group ${formatCohortNumber(c.cohort_number)} ${c.current_semester || 'Semester 1'}`);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="">Select a cohort...</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.program?.abbreviation} Group {formatCohortNumber(c.cohort_number)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Archive Label
                </label>
                <input
                  type="text"
                  value={courseLabel}
                  onChange={(e) => setCourseLabel(e.target.value)}
                  placeholder="e.g., PM Group 14 Semester 1"
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Exports all data filtered to the selected cohort. Stored permanently.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCourseModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCourseModal(false);
                  triggerExport('course_end', courseLabel, selectedCohortId);
                }}
                disabled={!courseLabel.trim() || !selectedCohortId}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
              >
                <FolderOpen className="w-4 h-4 inline mr-1" /> Create Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {downloadArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Download Files</h3>
              <button
                onClick={() => { setDownloadArchive(null); setDownloadUrls([]); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {downloadArchive.label} — {downloadArchive.files?.length || 0} files
            </p>

            {downloadLoading ? (
              <div className="p-6 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                <p className="text-sm text-gray-500 mt-2">Generating download links...</p>
              </div>
            ) : downloadUrls.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No files available for download
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {downloadUrls.map((file, i) => (
                  <a
                    key={i}
                    href={file.url}
                    download
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</div>
                        <div className="text-xs text-gray-500">{file.row_count.toLocaleString()} records · {formatBytes(file.size)}</div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
