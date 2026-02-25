'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  History,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Download,
  Filter,
  BookOpen,
  Star,
  Eye,
  Navigation,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type LabRole = 'lab_lead' | 'roamer' | 'observer';

interface StationInfo {
  station_number: number;
  station_type: string;
  custom_title: string | null;
}

interface HistoryEntry {
  id: string;
  role: LabRole;
  notes: string | null;
  lab_day_id: string | null;
  lab_date: string | null;
  lab_title: string;
  cohort_id: string | null;
  cohort_number: number | null;
  program_abbreviation: string | null;
  stations: StationInfo[];
}

interface CohortOption {
  id: string;
  cohort_number: number;
  program_abbreviation: string;
}

interface Stats {
  totalLabDays: number;
  totalHours: number;
  byRole: {
    lab_lead: number;
    roamer: number;
    observer: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(dateString: string): string {
  return parseLocalDate(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function roleLabel(role: LabRole): string {
  switch (role) {
    case 'lab_lead': return 'Lab Lead';
    case 'roamer': return 'Roamer';
    case 'observer': return 'Observer';
  }
}

function roleColorClasses(role: LabRole): { badge: string; icon: string } {
  switch (role) {
    case 'lab_lead':
      return {
        badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        icon: 'text-blue-600 dark:text-blue-400',
      };
    case 'roamer':
      return {
        badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
        icon: 'text-green-600 dark:text-green-400',
      };
    case 'observer':
      return {
        badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
        icon: 'text-gray-500 dark:text-gray-400',
      };
  }
}

function RoleIcon({ role, className }: { role: LabRole; className?: string }) {
  switch (role) {
    case 'lab_lead': return <Star className={className} />;
    case 'roamer': return <Navigation className={className} />;
    case 'observer': return <Eye className={className} />;
  }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(entries: HistoryEntry[], instructorName: string) {
  const headers = ['Date', 'Lab Day', 'Cohort', 'Role', 'Stations'];
  const rows = entries.map((e) => [
    e.lab_date ? formatDate(e.lab_date) : 'Unknown',
    e.lab_title,
    e.cohort_number !== null
      ? `${e.program_abbreviation || 'PMI'} Cohort ${e.cohort_number}`
      : 'Unknown Cohort',
    roleLabel(e.role),
    e.stations.length > 0
      ? e.stations.map(s => `Station ${s.station_number}${s.custom_title ? ` (${s.custom_title})` : ''}`).join('; ')
      : '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `teaching-history-${instructorName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function InstructorHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalLabDays: 0,
    totalHours: 0,
    byRole: { lab_lead: 0, roamer: 0, observer: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const loadHistory = useCallback(async () => {
    if (!session?.user?.email) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedCohort) params.set('cohortId', selectedCohort);
      if (selectedRole) params.set('role', selectedRole);

      const res = await fetch(`/api/instructor/history?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setEntries(data.entries || []);
        setCohorts(data.cohorts || []);
        setStats(data.stats || { totalLabDays: 0, totalHours: 0, byRole: { lab_lead: 0, roamer: 0, observer: 0 } });
      } else {
        setError(data.error || 'Failed to load teaching history');
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setError('Failed to load teaching history');
    }

    setLoading(false);
  }, [session, startDate, endDate, selectedCohort, selectedRole]);

  useEffect(() => {
    if (session?.user?.email) {
      loadHistory();
    }
  }, [session, loadHistory]);

  const instructorName = session?.user?.name || 'Instructor';

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
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/instructor" className="hover:text-blue-600 dark:hover:text-blue-400">Instructor Portal</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Teaching History</span>
          </div>

          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/instructor"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Teaching History</h1>
              </div>
            </div>

            <button
              onClick={() => exportToCSV(entries, instructorName)}
              disabled={entries.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Lab Days */}
          <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="flex items-center justify-center mb-1">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalLabDays}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Lab Days</div>
          </div>

          {/* Total Hours */}
          <div className="md:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalHours}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Est. Hours</div>
          </div>

          {/* Lab Lead */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="flex items-center justify-center mb-1">
              <Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.byRole.lab_lead}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Lab Lead</div>
          </div>

          {/* Roamer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="flex items-center justify-center mb-1">
              <Navigation className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.byRole.roamer}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Roamer</div>
          </div>

          {/* Observer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="flex items-center justify-center mb-1">
              <Eye className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-gray-600 dark:text-gray-300">{stats.byRole.observer}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Observer</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Cohort */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cohort</label>
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Cohorts</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.program_abbreviation} Cohort {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="lab_lead">Lab Lead</option>
                <option value="roamer">Roamer</option>
                <option value="observer">Observer</option>
              </select>
            </div>
          </div>

          {/* Clear filters */}
          {(startDate || endDate || selectedCohort || selectedRole) && (
            <div className="mt-3">
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedCohort('');
                  setSelectedRole('');
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Results Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Lab Day Assignments
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
              </span>
            </h2>
          </div>

          {error ? (
            <div className="p-8 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={loadHistory}
                className="mt-3 text-blue-600 dark:text-blue-400 hover:underline text-sm"
              >
                Try again
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No teaching history found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Lab day role assignments will appear here once you have been assigned as Lab Lead, Roamer, or Observer.
              </p>
              {(startDate || endDate || selectedCohort || selectedRole) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedCohort('');
                    setSelectedRole('');
                  }}
                  className="mt-3 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  Clear filters to see all entries
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Lab Day</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Cohort</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Station(s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {entries.map((entry) => {
                      const colors = roleColorClasses(entry.role);
                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                        >
                          {/* Date */}
                          <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              {entry.lab_date ? formatDate(entry.lab_date) : 'Unknown'}
                            </div>
                          </td>

                          {/* Lab Day */}
                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                            {entry.lab_day_id ? (
                              <Link
                                href={`/lab-management/schedule/${entry.lab_day_id}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {entry.lab_title}
                              </Link>
                            ) : (
                              entry.lab_title
                            )}
                          </td>

                          {/* Cohort */}
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {entry.cohort_number !== null ? (
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                {entry.program_abbreviation} Cohort {entry.cohort_number}
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                              <RoleIcon role={entry.role} className={`w-3.5 h-3.5 ${colors.icon}`} />
                              {roleLabel(entry.role)}
                            </span>
                          </td>

                          {/* Stations */}
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {entry.stations.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {entry.stations.map((s, i) => (
                                  <span
                                    key={i}
                                    className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs"
                                  >
                                    {s.custom_title ? `Station ${s.station_number}: ${s.custom_title}` : `Station ${s.station_number}`}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y dark:divide-gray-700">
                {entries.map((entry) => {
                  const colors = roleColorClasses(entry.role);
                  return (
                    <div key={entry.id} className="p-4 space-y-2">
                      {/* Date + Role */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {entry.lab_date ? formatDate(entry.lab_date) : 'Unknown'}
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                          <RoleIcon role={entry.role} className={`w-3.5 h-3.5 ${colors.icon}`} />
                          {roleLabel(entry.role)}
                        </span>
                      </div>

                      {/* Lab Day title */}
                      <div className="font-medium text-gray-900 dark:text-white">
                        {entry.lab_day_id ? (
                          <Link
                            href={`/lab-management/schedule/${entry.lab_day_id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {entry.lab_title}
                          </Link>
                        ) : (
                          entry.lab_title
                        )}
                      </div>

                      {/* Cohort */}
                      {entry.cohort_number !== null && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4" />
                          {entry.program_abbreviation} Cohort {entry.cohort_number}
                        </div>
                      )}

                      {/* Stations */}
                      {entry.stations.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.stations.map((s, i) => (
                            <span
                              key={i}
                              className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs"
                            >
                              {s.custom_title ? `Station ${s.station_number}: ${s.custom_title}` : `Station ${s.station_number}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer note */}
        {entries.length > 0 && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 pb-4">
            Estimated hours based on 8 hours per lab day. Export CSV for CE documentation.
          </p>
        )}
      </main>
    </div>
  );
}
