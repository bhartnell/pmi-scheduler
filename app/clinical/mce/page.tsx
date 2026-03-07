'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Home,
  ShieldCheck,
  Users,
  Search,
  Save,
  Loader2,
  Download,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Info,
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';

// ─── Types ──────────────────────────────────────────────────────────

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface ClearanceRow {
  student_id: string;
  student_name: string;
  first_name: string;
  last_name: string;
  mce_provider: string;
  modules_required: number;
  modules_completed: number;
  completion_percent: number;
  clearance_status: string;
  clearance_date: string | null;
  cleared_by: string | null;
  notes: string;
  clearance_id: string | null;
}

// Local editable copy per row
interface EditableRow extends ClearanceRow {
  dirty: boolean;
}

type SortField = 'student_name' | 'mce_provider' | 'modules_required' | 'modules_completed' | 'completion_percent' | 'clearance_status' | 'clearance_date';
type SortDir = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'cleared', label: 'Cleared' },
] as const;

const PROVIDER_OPTIONS = ['Platinum Planner', 'FISDAP', 'Other'] as const;

const MCE_CATEGORIES = [
  'Airway Management',
  'Cardiology / ECG',
  'Medical Emergencies',
  'Trauma',
  'OB/Pediatrics',
  'Pharmacology',
  'Operations / Special Populations',
];

function statusBadge(status: string) {
  switch (status) {
    case 'cleared':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'submitted':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

// ─── Component ──────────────────────────────────────────────────────

export default function MCEClearanceTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortField, setSortField] = useState<SortField>('student_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [showCategories, setShowCategories] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // ── Auth & init ──

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (selectedCohort) {
      fetchClearanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCohort]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      const cohortsRes = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
        if (cohortsData.cohorts?.length > 0) {
          setSelectedCohort(cohortsData.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchClearanceData = async () => {
    try {
      const res = await fetch(`/api/clinical/mce?cohortId=${selectedCohort}`);
      const data = await res.json();
      if (data.success) {
        setRows(
          (data.clearances || []).map((c: ClearanceRow) => ({ ...c, dirty: false }))
        );
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Error fetching clearance data:', error);
    }
  };

  // ── Row editing ──

  const updateRow = useCallback((studentId: string, field: keyof ClearanceRow, value: unknown) => {
    setRows(prev =>
      prev.map(r => {
        if (r.student_id !== studentId) return r;
        const updated = { ...r, [field]: value, dirty: true };
        // Recalculate percent when required/completed change
        if (field === 'modules_required' || field === 'modules_completed') {
          const req = field === 'modules_required' ? (value as number) : r.modules_required;
          const comp = field === 'modules_completed' ? (value as number) : r.modules_completed;
          updated.completion_percent = req > 0 ? Math.round((comp / req) * 100) : 0;
        }
        return updated;
      })
    );
  }, []);

  const saveRow = async (row: EditableRow) => {
    setSavingRow(row.student_id);
    try {
      const res = await fetch('/api/clinical/mce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: row.student_id,
          mce_provider: row.mce_provider,
          modules_required: row.modules_required,
          modules_completed: row.modules_completed,
          clearance_status: row.clearance_status,
          clearance_date: row.clearance_date,
          notes: row.notes,
        }),
      });
      if (res.ok) {
        setRows(prev =>
          prev.map(r => (r.student_id === row.student_id ? { ...r, dirty: false } : r))
        );
      }
    } catch (error) {
      console.error('Error saving row:', error);
    }
    setSavingRow(null);
  };

  // ── Bulk actions ──

  const bulkMarkCleared = async () => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch('/api/clinical/mce', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_ids: Array.from(selectedIds),
          clearance_status: 'cleared',
        }),
      });
      if (res.ok) {
        await fetchClearanceData();
      }
    } catch (error) {
      console.error('Error bulk updating:', error);
    }
    setBulkSaving(false);
  };

  // ── Selection helpers ──

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map(r => r.student_id)));
    }
  };

  // ── Sort ──

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // ── Filtering + sorting ──

  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.student_name.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.clearance_status === statusFilter);
    }

    // Incomplete only
    if (showIncompleteOnly) {
      result = result.filter(r => r.clearance_status !== 'cleared');
    }

    // Sort
    result.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';

      switch (sortField) {
        case 'student_name':
          av = a.last_name.toLowerCase();
          bv = b.last_name.toLowerCase();
          break;
        case 'mce_provider':
          av = a.mce_provider.toLowerCase();
          bv = b.mce_provider.toLowerCase();
          break;
        case 'modules_required':
          av = a.modules_required;
          bv = b.modules_required;
          break;
        case 'modules_completed':
          av = a.modules_completed;
          bv = b.modules_completed;
          break;
        case 'completion_percent':
          av = a.completion_percent;
          bv = b.completion_percent;
          break;
        case 'clearance_status': {
          const order: Record<string, number> = { not_started: 0, in_progress: 1, submitted: 2, cleared: 3 };
          av = order[a.clearance_status] ?? 0;
          bv = order[b.clearance_status] ?? 0;
          break;
        }
        case 'clearance_date':
          av = a.clearance_date || '';
          bv = b.clearance_date || '';
          break;
      }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, searchQuery, statusFilter, showIncompleteOnly, sortField, sortDir]);

  // ── CSV export ──

  const exportCSV = () => {
    const headers = ['Student Name', 'mCE Provider', 'Required', 'Completed', 'Progress %', 'Status', 'Clearance Date', 'Notes'];
    const csvRows = [headers.join(',')];
    for (const r of filteredRows) {
      csvRows.push([
        `"${r.student_name}"`,
        `"${r.mce_provider}"`,
        r.modules_required,
        r.modules_completed,
        r.completion_percent,
        `"${statusLabel(r.clearance_status)}"`,
        r.clearance_date ? `"${new Date(r.clearance_date).toLocaleDateString()}"` : '',
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cohort = cohorts.find(c => c.id === selectedCohort);
    const cohortLabel = cohort ? `${cohort.program?.abbreviation || 'PMD'}_Group${cohort.cohort_number}` : 'export';
    a.download = `mce_clearance_${cohortLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Stats ──

  const clearedCount = rows.filter(r => r.clearance_status === 'cleared').length;
  const totalCount = rows.length;
  const overallPercent = totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0;

  // ── Loading/auth gates ──

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canEdit = userRole && canEditClinical(userRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
            <ChevronRight className="w-4 h-4" />
            <span>mCE Clearance</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">mCE Clearance Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400">Track mCE completion and clearance status</p>
              </div>
            </div>
            {totalCount > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {clearedCount}/{totalCount}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Cleared ({overallPercent}%)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <main id="main-content" className="max-w-full mx-auto px-4 py-6 space-y-4">
        {/* ── Filters ── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Cohort selector */}
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 min-w-[200px]"
              >
                <option value="">Select Cohort</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation || 'PMD'} Group {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Incomplete toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showIncompleteOnly}
                onChange={(e) => setShowIncompleteOnly(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded"
              />
              Show incomplete only
            </label>

            {/* Action buttons */}
            {canEdit && selectedIds.size > 0 && (
              <button
                onClick={bulkMarkCleared}
                disabled={bulkSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Mark Selected as Cleared ({selectedIds.size})
              </button>
            )}

            <button
              onClick={exportCSV}
              disabled={filteredRows.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {/* ── Data Table ── */}
        {selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {canEdit && (
                      <th className="px-3 py-3 text-center">
                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Select all rows">
                          {selectedIds.size === filteredRows.length && filteredRows.length > 0
                            ? <CheckSquare className="w-4 h-4" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                    )}
                    <HeaderCell field="student_name" label="Student Name" sortField={sortField} sortDir={sortDir} onSort={handleSort} sticky />
                    <HeaderCell field="mce_provider" label="mCE Provider" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <HeaderCell field="modules_required" label="Required" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <HeaderCell field="modules_completed" label="Completed" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <HeaderCell field="completion_percent" label="Progress" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <HeaderCell field="clearance_status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <HeaderCell field="clearance_date" label="Clearance Date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Notes
                    </th>
                    {canEdit && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEdit ? 10 : 8}
                        className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(row => (
                      <tr key={row.student_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {/* Checkbox */}
                        {canEdit && (
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => toggleSelect(row.student_id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label={`Select ${row.student_name}`}>
                              {selectedIds.has(row.student_id)
                                ? <CheckSquare className="w-4 h-4 text-green-600" />
                                : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                        )}

                        {/* Student Name */}
                        <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {row.student_name}
                          </div>
                        </td>

                        {/* Provider */}
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <select
                              value={row.mce_provider}
                              onChange={(e) => updateRow(row.student_id, 'mce_provider', e.target.value)}
                              className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 w-full min-w-[140px]"
                            >
                              {PROVIDER_OPTIONS.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-gray-700 dark:text-gray-300">{row.mce_provider}</span>
                          )}
                        </td>

                        {/* Required */}
                        <td className="px-4 py-3 text-center">
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              value={row.modules_required}
                              onChange={(e) => updateRow(row.student_id, 'modules_required', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-sm text-center border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                            />
                          ) : (
                            <span className="text-sm text-gray-700 dark:text-gray-300">{row.modules_required}</span>
                          )}
                        </td>

                        {/* Completed */}
                        <td className="px-4 py-3 text-center">
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              max={row.modules_required || undefined}
                              value={row.modules_completed}
                              onChange={(e) => updateRow(row.student_id, 'modules_completed', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-sm text-center border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                            />
                          ) : (
                            <span className="text-sm text-gray-700 dark:text-gray-300">{row.modules_completed}</span>
                          )}
                        </td>

                        {/* Progress bar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  row.completion_percent >= 100
                                    ? 'bg-green-500'
                                    : row.completion_percent >= 75
                                    ? 'bg-blue-500'
                                    : row.completion_percent >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(row.completion_percent, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                              {row.completion_percent}%
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <select
                              value={row.clearance_status}
                              onChange={(e) => updateRow(row.student_id, 'clearance_status', e.target.value)}
                              className={`px-2 py-1 text-xs font-medium rounded-full border-0 ${statusBadge(row.clearance_status)} cursor-pointer`}
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge(row.clearance_status)}`}>
                              {statusLabel(row.clearance_status)}
                            </span>
                          )}
                        </td>

                        {/* Clearance Date */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {canEdit ? (
                            <input
                              type="date"
                              value={row.clearance_date ? row.clearance_date.split('T')[0] : ''}
                              onChange={(e) => updateRow(row.student_id, 'clearance_date', e.target.value || null)}
                              className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                            />
                          ) : (
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {row.clearance_date ? new Date(row.clearance_date).toLocaleDateString() : '--'}
                            </span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <input
                              type="text"
                              value={row.notes}
                              onChange={(e) => updateRow(row.student_id, 'notes', e.target.value)}
                              placeholder="Add notes..."
                              className="w-full min-w-[150px] px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400"
                            />
                          ) : (
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {row.notes ? (
                                expandedNotes.has(row.student_id) ? (
                                  <button onClick={() => setExpandedNotes(prev => { const n = new Set(prev); n.delete(row.student_id); return n; })} className="text-left">
                                    {row.notes}
                                  </button>
                                ) : (
                                  <button onClick={() => setExpandedNotes(prev => new Set(prev).add(row.student_id))} className="text-left truncate max-w-[150px] block">
                                    {row.notes}
                                  </button>
                                )
                              ) : '--'}
                            </span>
                          )}
                        </td>

                        {/* Save button */}
                        {canEdit && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => saveRow(row)}
                              disabled={!row.dirty || savingRow === row.student_id}
                              className={`p-2 rounded-lg transition-colors ${
                                row.dirty
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                              }`}
                              title={row.dirty ? 'Save changes' : 'No changes'}
                              aria-label={row.dirty ? 'Save changes' : 'No changes'}
                            >
                              {savingRow === row.student_id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Save className="w-4 h-4" />}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── No cohort selected ── */}
        {!selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view mCE clearance data</p>
          </div>
        )}

        {/* ── mCE Categories Reference Panel ── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <button
            onClick={() => setShowCategories(!showCategories)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-gray-900 dark:text-white">
                Paramedic mCE Categories Reference
              </span>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform ${showCategories ? 'rotate-180' : ''}`}
            />
          </button>
          {showCategories && (
            <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Standard mCE categories for paramedic programs. These are tracked at the clearance level, not individually.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {MCE_CATEGORIES.map(cat => (
                  <div
                    key={cat}
                    className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300"
                  >
                    {cat}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Sortable header cell component ──────────────────────────────────

function HeaderCell({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  sticky,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  sticky?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none whitespace-nowrap ${
        sticky ? 'sticky left-0 bg-gray-50 dark:bg-gray-700 z-10' : ''
      }`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center">
        {label}
        {sortField === field ? (
          sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
        ) : (
          <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
        )}
      </span>
    </th>
  );
}
