'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Download,
  Database,
  Users,
  FlaskConical,
  Stethoscope,
  ClipboardList,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileText,
  Calendar,
  Filter,
  Clock,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportType = 'cohort' | 'students' | 'labs' | 'clinical' | 'assessments' | 'full_backup';
type ExportFormat = 'csv' | 'json';

interface Cohort {
  id: string;
  cohort_number: number;
  program?: { name: string; abbreviation: string };
}

interface ExportHistoryEntry {
  id: string;
  exported_by_email: string;
  exported_by_name: string | null;
  export_type: string;
  format: string;
  cohort_id: string | null;
  start_date: string | null;
  end_date: string | null;
  record_count: number;
  file_size_bytes: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Export type cards config
// ---------------------------------------------------------------------------

const EXPORT_TYPES: {
  type: ExportType;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: string;
  warning?: string;
}[] = [
  {
    type: 'cohort',
    icon: Database,
    title: 'Cohort Data',
    description: 'Cohort info with enrolled students and lab day summary',
    color: 'bg-blue-500',
  },
  {
    type: 'students',
    icon: Users,
    title: 'Student Records',
    description: 'All students with contact info, agency, status, and cohort',
    color: 'bg-green-500',
  },
  {
    type: 'labs',
    icon: FlaskConical,
    title: 'Lab Schedule & Attendance',
    description: 'Lab days, stations, and station assignments',
    color: 'bg-purple-500',
  },
  {
    type: 'clinical',
    icon: Stethoscope,
    title: 'Clinical & Internships',
    description: 'Internships, clinical hours, site visits',
    color: 'bg-orange-500',
  },
  {
    type: 'assessments',
    icon: ClipboardList,
    title: 'Assessments & Skills',
    description: 'Scenario assessments and skill sign-offs',
    color: 'bg-teal-500',
  },
  {
    type: 'full_backup',
    icon: HardDrive,
    title: 'Full Backup',
    description: 'Everything combined — cohorts, students, labs, clinical, assessments',
    color: 'bg-gray-700',
    warning: 'This export may be large and take several seconds to generate.',
  },
];

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

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DataExportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<{ role: string; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState<ExportType>('students');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Cohorts list
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{ filename: string; size: string; records: number } | null>(null);
  const [exportError, setExportError] = useState('');

  // Export history
  const [history, setHistory] = useState<ExportHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
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
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
        fetchCohorts();
        fetchHistory();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchCohorts = async () => {
    setCohortsLoading(true);
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=false&include_archived=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
    setCohortsLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/data-export', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching export history:', error);
    }
    setHistoryLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Export handler
  // ---------------------------------------------------------------------------

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(null);
    setExportError('');

    try {
      const params = new URLSearchParams();
      params.set('type', selectedType);
      params.set('format', selectedFormat);
      if (selectedCohortId) params.set('cohort_id', selectedCohortId);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await fetch(`/api/admin/data-export?${params}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Export failed' }));
        setExportError(errData.error || 'Export failed. Please try again.');
        return;
      }

      // Read response metadata from headers
      const recordCount = parseInt(res.headers.get('X-Export-Record-Count') || '0');
      const fileSizeBytes = parseInt(res.headers.get('X-Export-File-Size') || '0');

      // Get the content-disposition header to extract the filename
      const contentDisposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `pmi-export.${selectedFormat}`;

      // Trigger browser download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess({
        filename,
        size: formatBytes(fileSizeBytes || blob.size),
        records: recordCount,
      });

      // Refresh history
      fetchHistory();
    } catch (error) {
      console.error('Export error:', error);
      setExportError('An unexpected error occurred. Please try again.');
    } finally {
      setExporting(false);
    }
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

  const selectedTypeConfig = EXPORT_TYPES.find((t) => t.type === selectedType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
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
            <span className="text-gray-900 dark:text-white">Data Export</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Download className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Export</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Export program data as CSV or JSON for reporting and analysis
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Export Type Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Select Export Type
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {EXPORT_TYPES.map((et) => {
              const Icon = et.icon;
              const isSelected = selectedType === et.type;
              return (
                <button
                  key={et.type}
                  onClick={() => setSelectedType(et.type)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${et.color} flex-shrink-0`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">{et.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{et.description}</div>
                    </div>
                  </div>
                  {et.warning && isSelected && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{et.warning}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            Filters &amp; Options
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cohort filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cohort (optional)
              </label>
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                disabled={cohortsLoading}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation} Cohort {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date (optional)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* End date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date (optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Format selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Format
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFormat('csv')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    selectedFormat === 'csv'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  CSV
                </button>
                <button
                  onClick={() => setSelectedFormat('json')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    selectedFormat === 'json'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Export Button + Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Ready to export:{' '}
                <span className="text-blue-600 dark:text-blue-400">
                  {selectedTypeConfig?.title}
                </span>
                {' '}as{' '}
                <span className="text-blue-600 dark:text-blue-400 uppercase">{selectedFormat}</span>
              </h2>
              {(selectedCohortId || startDate || endDate) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Filters applied:{' '}
                  {selectedCohortId &&
                    (() => {
                      const c = cohorts.find((x) => x.id === selectedCohortId);
                      return c ? `${c.program?.abbreviation} Cohort ${c.cohort_number}` : 'Selected Cohort';
                    })()}
                  {startDate && ` · From ${startDate}`}
                  {endDate && ` · To ${endDate}`}
                </p>
              )}
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export
                </>
              )}
            </button>
          </div>

          {/* Success message */}
          {exportSuccess && (
            <div className="mt-4 flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Export complete
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  {exportSuccess.filename} &bull; {exportSuccess.records} records &bull; {exportSuccess.size}
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {exportError && (
            <div className="mt-4 flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-100">Export failed</p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{exportError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Exports */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              Recent Exports
            </h2>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center">
              <Download className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No exports yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Format
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Records
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Exported By
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize">
                          {entry.export_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase">
                          {entry.format}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {entry.record_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatBytes(entry.file_size_bytes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        <div>{entry.exported_by_name || '—'}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{entry.exported_by_email}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
