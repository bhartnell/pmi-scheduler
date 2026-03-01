'use client';

/**
 * Admin Bulk Data Operations
 *
 * Allows admins to perform bulk operations on database records:
 * - Update Status: Change the status field on multiple records at once
 * - Assign Cohort: Move records to a different cohort
 * - Delete Records: Permanently delete records matching filters
 * - Export Records: Download matching records as CSV or JSON
 *
 * Features:
 * - Filter builder with field/operator/value conditions
 * - Dry run preview showing affected records before execution
 * - Operation history with rollback for update operations
 * - Toast notifications for success/failure feedback
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Database,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  X,
  Eye,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Users,
  Filter,
  Settings2,
  Clock,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OperationType = 'update_status' | 'assign_cohort' | 'delete_records' | 'export_records';
type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in_list';
type OperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';

interface FilterCondition {
  id: string; // local UI id for keying
  field: string;
  operator: FilterOperator;
  value: string;
}

interface BulkOperationLog {
  id: string;
  operation_type: string;
  target_table: string;
  affected_count: number;
  parameters: Record<string, unknown>;
  status: OperationStatus;
  performed_by: string;
  created_at: string;
}

interface Cohort {
  id: string;
  cohort_number: number;
  program?: { name: string; abbreviation: string };
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

// ---------------------------------------------------------------------------
// Constants / config
// ---------------------------------------------------------------------------

const TARGET_TABLES = [
  { value: 'students', label: 'Students' },
  { value: 'lab_days', label: 'Lab Days' },
  { value: 'shifts', label: 'Shifts' },
  { value: 'lab_users', label: 'Users' },
  { value: 'student_internships', label: 'Student Internships' },
] as const;

const FILTER_FIELDS: Record<string, { label: string; value: string }[]> = {
  students: [
    { value: 'status', label: 'Status' },
    { value: 'cohort_id', label: 'Cohort ID' },
    { value: 'agency', label: 'Agency' },
    { value: 'created_at', label: 'Created At' },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
  ],
  lab_days: [
    { value: 'is_active', label: 'Is Active' },
    { value: 'cohort_id', label: 'Cohort ID' },
    { value: 'date', label: 'Date' },
    { value: 'created_at', label: 'Created At' },
  ],
  shifts: [
    { value: 'status', label: 'Status' },
    { value: 'department', label: 'Department' },
    { value: 'date', label: 'Date' },
    { value: 'created_at', label: 'Created At' },
  ],
  lab_users: [
    { value: 'role', label: 'Role' },
    { value: 'is_active', label: 'Is Active' },
    { value: 'created_at', label: 'Created At' },
    { value: 'email', label: 'Email' },
  ],
  student_internships: [
    { value: 'status', label: 'Status' },
    { value: 'cohort_id', label: 'Cohort ID' },
    { value: 'current_phase', label: 'Current Phase' },
    { value: 'created_at', label: 'Created At' },
  ],
};

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'in_list', label: 'In list (comma-separated)' },
];

const OPERATIONS: { value: OperationType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'update_status', label: 'Update Status', icon: Settings2, color: 'bg-blue-500' },
  { value: 'assign_cohort', label: 'Assign Cohort', icon: Users, color: 'bg-green-500' },
  { value: 'delete_records', label: 'Delete Records', icon: Trash2, color: 'bg-red-500' },
  { value: 'export_records', label: 'Export Records', icon: Download, color: 'bg-purple-500' },
];

const STATUS_CONFIG: Record<OperationStatus, { label: string; badge: string }> = {
  pending: { label: 'Pending', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
  running: { label: 'Running', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  completed: { label: 'Completed', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  failed: { label: 'Failed', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  rolled_back: { label: 'Rolled Back', badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
};

// Student status options (common statuses)
const STUDENT_STATUSES = ['active', 'inactive', 'withdrawn', 'graduated', 'on_leave', 'remediation'];
const INTERNSHIP_STATUSES = ['pending', 'active', 'completed', 'withdrawn'];
const SHIFT_STATUSES = ['open', 'filled', 'cancelled'];
const USER_ROLES = ['superadmin', 'admin', 'lead_instructor', 'instructor', 'volunteer_instructor', 'student', 'guest', 'pending'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

function Toast({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  const colorMap = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  };

  const IconMap = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Database };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = IconMap[toast.type];
        return (
          <div key={toast.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg ${colorMap[toast.type]}`}>
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm flex-1">{toast.message}</p>
            <button onClick={() => onDismiss(toast.id)} className="ml-1 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BulkOperationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [loading, setLoading] = useState(true);

  // Operation config state
  const [selectedOperation, setSelectedOperation] = useState<OperationType>('update_status');
  const [targetTable, setTargetTable] = useState('students');
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});

  // Operation parameters sub-state
  const [newStatus, setNewStatus] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  // Preview / execution state
  const [previewData, setPreviewData] = useState<{ records: Record<string, unknown>[]; total: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // History
  const [history, setHistory] = useState<BulkOperationLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  // Cohorts for assign_cohort operation
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
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
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/admin/bulk-operations');
      const data = await res.json();
      if (data.success) setHistory(data.operations || []);
    } catch {
      // ignore
    }
    setHistoryLoading(false);
  }, []);

  const fetchCohorts = useCallback(async () => {
    try {
      const res = await fetch('/api/cohorts');
      const data = await res.json();
      if (data.cohorts) setCohorts(data.cohorts);
      else if (Array.isArray(data)) setCohorts(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!loading && currentUser) {
      fetchHistory();
      fetchCohorts();
    }
  }, [loading, currentUser, fetchHistory, fetchCohorts]);

  // Reset preview when config changes
  useEffect(() => {
    setPreviewData(null);
  }, [selectedOperation, targetTable, filters]);

  // ---------------------------------------------------------------------------
  // Toast helpers
  // ---------------------------------------------------------------------------

  const addToast = (type: ToastMessage['type'], message: string) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ---------------------------------------------------------------------------
  // Filter management
  // ---------------------------------------------------------------------------

  const addFilter = () => {
    const availableFields = FILTER_FIELDS[targetTable] || [];
    if (availableFields.length === 0) return;
    setFilters((prev) => [
      ...prev,
      { id: generateId(), field: availableFields[0].value, operator: 'equals', value: '' },
    ]);
  };

  const updateFilter = (id: string, updates: Partial<Omit<FilterCondition, 'id'>>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  // ---------------------------------------------------------------------------
  // Build parameters from form state
  // ---------------------------------------------------------------------------

  const buildParameters = useCallback((): Record<string, unknown> => {
    if (selectedOperation === 'update_status') return { new_status: newStatus };
    if (selectedOperation === 'assign_cohort') return { cohort_id: cohortId };
    if (selectedOperation === 'delete_records') return { confirmed: deleteConfirmed };
    if (selectedOperation === 'export_records') return { format: exportFormat };
    return {};
  }, [selectedOperation, newStatus, cohortId, deleteConfirmed, exportFormat]);

  // ---------------------------------------------------------------------------
  // Dry run preview
  // ---------------------------------------------------------------------------

  const handleDryRun = async () => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: selectedOperation,
          target_table: targetTable,
          filters: filters.map(({ id: _id, ...f }) => f),
          parameters: buildParameters(),
          dry_run: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData({ records: data.preview || [], total: data.total_matching || 0 });
        addToast('info', `Preview: ${data.total_matching} record(s) would be affected`);
      } else {
        addToast('error', data.error || 'Preview failed');
      }
    } catch {
      addToast('error', 'Network error during preview');
    }
    setPreviewLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Execute operation
  // ---------------------------------------------------------------------------

  const handleExecute = async () => {
    setShowConfirmDialog(false);
    setExecuting(true);
    try {
      const params = buildParameters();

      // For export operations, trigger a file download
      if (selectedOperation === 'export_records') {
        const res = await fetch('/api/admin/bulk-operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: selectedOperation,
            target_table: targetTable,
            filters: filters.map(({ id: _id, ...f }) => f),
            parameters: params,
          }),
        });

        if (res.ok && (res.headers.get('Content-Disposition') || '').includes('attachment')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const contentDisposition = res.headers.get('Content-Disposition') || '';
          const filename = contentDisposition.match(/filename="([^"]+)"/)?.[1] || `bulk-export.${exportFormat}`;
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          const count = res.headers.get('X-Affected-Count') || '?';
          addToast('success', `Exported ${count} records successfully`);
        } else {
          const data = await res.json();
          addToast('error', data.error || 'Export failed');
        }
        await fetchHistory();
        setExecuting(false);
        return;
      }

      const res = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: selectedOperation,
          target_table: targetTable,
          filters: filters.map(({ id: _id, ...f }) => f),
          parameters: params,
        }),
      });
      const data = await res.json();

      if (data.success) {
        addToast('success', data.message || `Operation completed: ${data.affected_count} records affected`);
        setPreviewData(null);
        await fetchHistory();
      } else {
        addToast('error', data.error || 'Operation failed');
      }
    } catch {
      addToast('error', 'Network error during execution');
    }
    setExecuting(false);
  };

  // ---------------------------------------------------------------------------
  // Rollback
  // ---------------------------------------------------------------------------

  const handleRollback = async (operationId: string) => {
    if (rollingBack) return;
    setRollingBack(operationId);
    try {
      const res = await fetch(`/api/admin/bulk-operations/${operationId}/rollback`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', data.message || `Rolled back operation successfully`);
        await fetchHistory();
      } else {
        addToast('error', data.error || 'Rollback failed');
      }
    } catch {
      addToast('error', 'Network error during rollback');
    }
    setRollingBack(null);
  };

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------

  const isRollbackable = (op: BulkOperationLog) =>
    ['update_status', 'assign_cohort'].includes(op.operation_type) && op.status === 'completed';

  const getStatusOptions = () => {
    if (targetTable === 'students') return STUDENT_STATUSES;
    if (targetTable === 'student_internships') return INTERNSHIP_STATUSES;
    if (targetTable === 'shifts') return SHIFT_STATUSES;
    if (targetTable === 'lab_users') return USER_ROLES;
    return [];
  };

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session || !currentUser) return null;

  const availableFields = FILTER_FIELDS[targetTable] || [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Bulk Operations</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Database className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Data Operations</h1>
              <p className="text-gray-600 dark:text-gray-400">Update statuses, assign cohorts, delete old records, and export data in bulk</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Warning banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100 text-sm">Use with caution</p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Bulk operations affect many records at once. Always use "Dry Run Preview" before executing. Delete operations cannot be undone.
            </p>
          </div>
        </div>

        {/* === OPERATION BUILDER === */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-500" />
              Operation Builder
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1: Choose operation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                1. Choose Operation
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {OPERATIONS.map((op) => {
                  const Icon = op.icon;
                  const isSelected = selectedOperation === op.value;
                  return (
                    <button
                      key={op.value}
                      onClick={() => {
                        setSelectedOperation(op.value);
                        setPreviewData(null);
                        setDeleteConfirmed(false);
                      }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-sm font-medium ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? op.color : 'bg-gray-100 dark:bg-gray-600'}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                      </div>
                      {op.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Choose target table */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                2. Target Table
              </label>
              <select
                value={targetTable}
                onChange={(e) => {
                  setTargetTable(e.target.value);
                  setFilters([]);
                  setPreviewData(null);
                }}
                className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TARGET_TABLES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Step 3: Filter builder */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  3. Filter Conditions (all conditions must match)
                </label>
                <button
                  onClick={addFilter}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Filter
                </button>
              </div>

              {filters.length === 0 && (
                <div className="py-6 flex flex-col items-center gap-2 text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  <Filter className="w-8 h-8 opacity-40" />
                  <span>No filters applied — all records in the table will be targeted</span>
                  <button
                    onClick={addFilter}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Add a filter condition
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {filters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2 flex-wrap">
                    <select
                      value={filter.field}
                      onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                      className="flex-1 min-w-32 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {availableFields.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>

                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                      className="flex-1 min-w-36 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      placeholder="Value..."
                      className="flex-1 min-w-32 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                    />

                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Remove filter"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4: Operation-specific parameters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                4. Operation Parameters
              </label>

              {selectedOperation === 'update_status' && (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">New Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select new status...</option>
                    {getStatusOptions().map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {getStatusOptions().length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      The selected table may not support status updates.
                    </p>
                  )}
                </div>
              )}

              {selectedOperation === 'assign_cohort' && (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Target Cohort</label>
                  <select
                    value={cohortId}
                    onChange={(e) => setCohortId(e.target.value)}
                    className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select cohort...</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.program?.abbreviation || ''} Cohort {c.cohort_number}
                      </option>
                    ))}
                  </select>
                  {cohorts.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No cohorts found.</p>
                  )}
                </div>
              )}

              {selectedOperation === 'delete_records' && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-red-800 dark:text-red-200 text-sm">Permanent Deletion</p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                        Deleted records cannot be recovered. Always run a Dry Run Preview first to confirm what will be deleted.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-red-800 dark:text-red-200">
                      I understand this action is irreversible and I have verified the preview
                    </span>
                  </label>
                </div>
              )}

              {selectedOperation === 'export_records' && (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Export Format</label>
                  <div className="flex gap-3">
                    {(['csv', 'json'] as const).map((fmt) => (
                      <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={fmt}
                          checked={exportFormat === fmt}
                          onChange={() => setExportFormat(fmt)}
                          className="text-blue-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase">{fmt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 5: Action buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleDryRun}
                disabled={previewLoading || executing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Dry Run Preview
              </button>

              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={
                  executing ||
                  previewLoading ||
                  (selectedOperation === 'delete_records' && !deleteConfirmed) ||
                  (selectedOperation === 'update_status' && !newStatus) ||
                  (selectedOperation === 'assign_cohort' && !cohortId)
                }
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Execute Operation
              </button>
            </div>
          </div>
        </div>

        {/* === PREVIEW RESULTS === */}
        {previewData !== null && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-500" />
                Dry Run Preview
              </h2>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                {previewData.total} record{previewData.total !== 1 ? 's' : ''} would be affected
              </span>
            </div>

            {previewData.records.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Filter className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p>No records match the current filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      {Object.keys(previewData.records[0]).slice(0, 8).map((col) => (
                        <th key={col} className="px-4 py-2 text-left text-gray-600 dark:text-gray-400 font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {previewData.records.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        {Object.entries(row).slice(0, 8).map(([col, val]) => (
                          <td key={col} className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-32 truncate">
                            {val === null || val === undefined ? (
                              <span className="text-gray-400 italic">null</span>
                            ) : typeof val === 'object' ? (
                              <span className="text-gray-400">[object]</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.total > 20 && (
                  <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                    Showing first 20 of {previewData.total} matching records
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* === OPERATION HISTORY === */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              Operation History
            </h2>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1"
              title="Refresh history"
            >
              <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {historyLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Database className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p>No operations have been performed yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Operation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Table</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Affected</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Performed By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {history.map((op) => {
                    const statusCfg = STATUS_CONFIG[op.status] || STATUS_CONFIG.completed;
                    const canRollback = isRollbackable(op);
                    return (
                      <tr key={op.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {op.operation_type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {op.target_table}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {op.affected_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.badge}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-40 truncate">
                          {op.performed_by}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {fmtDate(op.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {canRollback && (
                            <button
                              onClick={() => handleRollback(op.id)}
                              disabled={rollingBack === op.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                              title="Roll back this operation"
                            >
                              {rollingBack === op.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              Rollback
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* === CONFIRM DIALOG === */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirmDialog(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-50">
            <div className="flex items-start gap-3 mb-4">
              {selectedOperation === 'delete_records' ? (
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
              ) : (
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                  <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Confirm Operation</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  You are about to execute a <strong>{selectedOperation.replace(/_/g, ' ')}</strong> operation on{' '}
                  <strong>{targetTable}</strong>.
                  {previewData && (
                    <span>
                      {' '}This will affect approximately <strong>{previewData.total}</strong> record{previewData.total !== 1 ? 's' : ''}.
                    </span>
                  )}
                </p>
                {selectedOperation === 'delete_records' && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium">
                    This action cannot be undone.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className={`px-4 py-2 text-sm text-white rounded-lg font-medium ${
                  selectedOperation === 'delete_records'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Yes, Execute
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
