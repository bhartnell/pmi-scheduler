'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  BarChart3,
  Users,
  Calendar,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Loader2,
  TrendingUp,
  Award,
  Clock,
} from 'lucide-react';
import { ROLE_LABELS, type Role } from '@/lib/permissions';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface InstructorWorkload {
  id: string;
  name: string;
  email: string;
  role: string;
  labDaysCount: number;
  totalHours: number;
  stationTypes: Record<string, number>;
  availabilityRate: number | null;
  lastLabDate: string | null;
}

interface WorkloadReport {
  instructors: InstructorWorkload[];
  dateRange: { start: string; end: string };
  pollTotals: number;
}

type SortField = 'name' | 'role' | 'labDaysCount' | 'totalHours' | 'lastLabDate';
type SortDir = 'asc' | 'desc';

function getWorkloadBadge(labDaysCount: number): { label: string; className: string } {
  if (labDaysCount === 0) return { label: 'None', className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' };
  if (labDaysCount <= 4) return { label: 'Light', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' };
  if (labDaysCount <= 8) return { label: 'Moderate', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' };
  if (labDaysCount <= 12) return { label: 'Heavy', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' };
  return { label: 'Overloaded', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' };
}

function formatStationType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InstructorWorkloadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [report, setReport] = useState<WorkloadReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Table state
  const [sortField, setSortField] = useState<SortField>('labDaysCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
      fetchReport();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts || []);
      }
    } catch {
      // Non-critical — cohort filter just won't be populated
    }
  };

  const fetchReport = async (overrides?: { startDate?: string; endDate?: string; cohortId?: string; role?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const sd = overrides?.startDate ?? startDate;
      const ed = overrides?.endDate ?? endDate;
      const cid = overrides?.cohortId !== undefined ? overrides.cohortId : selectedCohort;
      const rf = overrides?.role !== undefined ? overrides.role : roleFilter;

      const params = new URLSearchParams({ startDate: sd, endDate: ed });
      if (cid) params.set('cohortId', cid);
      if (rf) params.set('role', rf);

      const res = await fetch(`/api/reports/instructor-workload?${params}`);
      const data = await res.json();

      if (data.success) {
        setReport(data);
      } else {
        setError(data.error || 'Failed to load report');
      }
    } catch {
      setError('Failed to load report. Please try again.');
    }
    setLoading(false);
  };

  const handleApply = () => {
    fetchReport();
  };

  const handleReset = () => {
    setStartDate(firstOfMonth);
    setEndDate(today);
    setSelectedCohort('');
    setRoleFilter('');
    fetchReport({ startDate: firstOfMonth, endDate: today, cohortId: '', role: '' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const headers = ['Name', 'Email', 'Role', 'Lab Days', 'Est. Hours', 'Workload', 'Last Lab Date', 'Availability Rate'];
    const rows = sortedInstructors.map((d) => {
      const badge = getWorkloadBadge(d.labDaysCount);
      return [
        d.name,
        d.email,
        ROLE_LABELS[d.role as Role] || d.role,
        d.labDaysCount,
        d.totalHours,
        badge.label,
        d.lastLabDate ? new Date(d.lastLabDate + 'T00:00:00').toLocaleDateString() : 'None',
        d.availabilityRate !== null ? `${d.availabilityRate}%` : 'N/A',
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instructor-workload-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sorting logic
  const sortedInstructors = [...(report?.instructors || [])].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'role') {
      cmp = a.role.localeCompare(b.role);
    } else if (sortField === 'labDaysCount') {
      cmp = a.labDaysCount - b.labDaysCount;
    } else if (sortField === 'totalHours') {
      cmp = a.totalHours - b.totalHours;
    } else if (sortField === 'lastLabDate') {
      const aDate = a.lastLabDate || '';
      const bDate = b.lastLabDate || '';
      cmp = aDate.localeCompare(bDate);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Summary card data
  const activeInstructors = sortedInstructors.filter((i) => i.labDaysCount > 0);
  const totalActive = activeInstructors.length;
  const avgLabs = totalActive > 0
    ? (activeInstructors.reduce((s, i) => s + i.labDaysCount, 0) / totalActive).toFixed(1)
    : '0';
  const mostAssigned = sortedInstructors.length > 0
    ? [...sortedInstructors].sort((a, b) => b.labDaysCount - a.labDaysCount)[0]
    : null;
  const leastAssigned = activeInstructors.length > 0
    ? [...activeInstructors].sort((a, b) => a.labDaysCount - b.labDaysCount)[0]
    : null;

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );

  if (status === 'loading') {
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
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link href="/lab-management/reports" className="hover:text-blue-600 dark:hover:text-blue-400">
              Reports
            </Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-gray-900 dark:text-white">Instructor Workload</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instructor Workload Analytics</h1>
                <p className="text-gray-600 dark:text-gray-400">View and compare instructor lab assignments and workload distribution</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cohort
              </label>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.program.abbreviation} Group {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">All Roles</option>
                <option value="instructor">Instructor</option>
                <option value="lead_instructor">Lead Instructor</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleApply}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                Apply
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
              {report && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Report content */}
        {!loading && report && (
          <>
            {/* Date range info */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              Showing data from{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(report.dateRange.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {' '}to{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(report.dateRange.end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Active Instructors</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalActive}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  of {report.instructors.length} total
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Avg Labs / Instructor</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{avgLabs}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  est. {(parseFloat(avgLabs) * 4).toFixed(0)} hrs avg
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <Award className="w-4 h-4" />
                  <span className="text-sm font-medium">Most Assigned</span>
                </div>
                {mostAssigned ? (
                  <>
                    <p className="text-base font-bold text-gray-900 dark:text-white truncate">{mostAssigned.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {mostAssigned.labDaysCount} lab day{mostAssigned.labDaysCount !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Least Assigned</span>
                </div>
                {leastAssigned ? (
                  <>
                    <p className="text-base font-bold text-gray-900 dark:text-white truncate">{leastAssigned.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {leastAssigned.labDaysCount} lab day{leastAssigned.labDaysCount !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No active instructors</p>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Instructor Breakdown
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({sortedInstructors.length} instructor{sortedInstructors.length !== 1 ? 's' : ''})
                  </span>
                </h2>
              </div>

              {sortedInstructors.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No instructors found for the selected filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <SortButton field="name">Name</SortButton>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <SortButton field="role">Role</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="labDaysCount">Lab Days</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="totalHours">Hours (est.)</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">Workload</th>
                        <th className="px-4 py-3 text-center hidden md:table-cell">Station Types</th>
                        <th className="px-4 py-3 text-center hidden lg:table-cell">Availability</th>
                        <th className="px-4 py-3 text-center">
                          <SortButton field="lastLabDate">Last Lab</SortButton>
                        </th>
                        <th className="px-4 py-3 text-center">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {sortedInstructors.map((instructor) => {
                        const badge = getWorkloadBadge(instructor.labDaysCount);
                        const isExpanded = expandedRow === instructor.id;
                        const stationTypeEntries = Object.entries(instructor.stationTypes).sort((a, b) => b[1] - a[1]);

                        return (
                          <React.Fragment key={instructor.id}>
                            <tr
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 dark:text-white">{instructor.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{instructor.email}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-700 dark:text-gray-300 text-xs">
                                  {ROLE_LABELS[instructor.role as Role] || instructor.role}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-gray-900 dark:text-white text-base">
                                  {instructor.labDaysCount}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">
                                {instructor.totalHours}h
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center hidden md:table-cell">
                                {stationTypeEntries.length > 0 ? (
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {stationTypeEntries.slice(0, 3).map(([type, count]) => (
                                      <span
                                        key={type}
                                        className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                                        title={`${formatStationType(type)}: ${count}`}
                                      >
                                        {formatStationType(type)} ({count})
                                      </span>
                                    ))}
                                    {stationTypeEntries.length > 3 && (
                                      <span className="text-xs text-gray-400">+{stationTypeEntries.length - 3} more</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">None</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center hidden lg:table-cell">
                                {instructor.availabilityRate !== null ? (
                                  <span className={`text-sm font-medium ${
                                    instructor.availabilityRate >= 80
                                      ? 'text-green-600 dark:text-green-400'
                                      : instructor.availabilityRate >= 50
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {instructor.availabilityRate}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 text-xs">
                                {instructor.lastLabDate
                                  ? new Date(instructor.lastLabDate + 'T00:00:00').toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'None'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => setExpandedRow(isExpanded ? null : instructor.id)}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded row */}
                            {isExpanded && (
                              <tr key={`${instructor.id}-expanded`} className="bg-blue-50/50 dark:bg-blue-900/10">
                                <td colSpan={9} className="px-6 py-4">
                                  <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Station Type Breakdown
                                      </h4>
                                      {stationTypeEntries.length > 0 ? (
                                        <div className="space-y-1">
                                          {stationTypeEntries.map(([type, count]) => (
                                            <div key={type} className="flex items-center gap-2">
                                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                <div
                                                  className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full"
                                                  style={{
                                                    width: `${Math.min(100, (count / Math.max(...Object.values(instructor.stationTypes))) * 100)}%`,
                                                  }}
                                                />
                                              </div>
                                              <span className="text-xs text-gray-600 dark:text-gray-400 w-6 text-right font-medium">
                                                {count}
                                              </span>
                                              <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[100px]">
                                                {formatStationType(type)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">No station assignments</p>
                                      )}
                                    </div>

                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                        Workload Summary
                                      </h4>
                                      <dl className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                          <dt className="text-gray-500 dark:text-gray-400">Total Lab Days</dt>
                                          <dd className="font-medium text-gray-900 dark:text-white">{instructor.labDaysCount}</dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-gray-500 dark:text-gray-400">Estimated Hours</dt>
                                          <dd className="font-medium text-gray-900 dark:text-white">{instructor.totalHours}h</dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-gray-500 dark:text-gray-400">Last Lab Date</dt>
                                          <dd className="font-medium text-gray-900 dark:text-white">
                                            {instructor.lastLabDate
                                              ? new Date(instructor.lastLabDate + 'T00:00:00').toLocaleDateString('en-US', {
                                                  month: 'long',
                                                  day: 'numeric',
                                                  year: 'numeric',
                                                })
                                              : 'None in period'}
                                          </dd>
                                        </div>
                                        {instructor.availabilityRate !== null && (
                                          <div className="flex justify-between">
                                            <dt className="text-gray-500 dark:text-gray-400">Availability Rate</dt>
                                            <dd className="font-medium text-gray-900 dark:text-white">
                                              {instructor.availabilityRate}%
                                            </dd>
                                          </div>
                                        )}
                                      </dl>
                                    </div>
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
            </div>

            {/* Workload Legend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Workload Legend</h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'None', desc: '0 labs', className: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
                  { label: 'Light', desc: '1-4 labs/period', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
                  { label: 'Moderate', desc: '5-8 labs/period', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
                  { label: 'Heavy', desc: '9-12 labs/period', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
                  { label: 'Overloaded', desc: '13+ labs/period', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
                ].map(({ label, desc, className }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty state when no report loaded yet */}
        {!loading && !report && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to Load</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Adjust the filters above and click Apply to view instructor workload data.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
