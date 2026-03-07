'use client';

/**
 * Student Lab History Page
 *
 * Read-only view of the student's lab day attendance history:
 *   - List of past lab days with attendance status
 *   - Per lab day: date, title, location, stations completed, skills practiced
 *   - Filter by date range and attendance status
 *   - Attendance summary stats
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  X,
  MapPin,
  ChevronDown,
  ChevronUp,
  Beaker,
  ClipboardCheck,
} from 'lucide-react';
import { parseDateSafe } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StationCompletion {
  id: string;
  stationCode: string | null;
  stationName: string;
  category: string;
  result: string;
  completedAt: string;
}

interface SkillSignoff {
  id: string;
  skillName: string;
  skillCategory: string;
  signedOffAt: string;
  signedOffBy: string;
}

interface LabRecord {
  id: string;
  labDayId: string;
  date: string | null;
  title: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string | null;
  markedAt: string;
  stations: StationCompletion[];
  skillsSignedOff: SkillSignoff[];
}

interface LabSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendanceRate: number;
}

interface LabsData {
  success: boolean;
  studentFound: boolean;
  message?: string;
  labs: LabRecord[];
  summary: LabSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return parseDateSafe(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatWeekday(dateStr: string | null): string {
  if (!dateStr) return '';
  return parseDateSafe(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${ampm}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  present: {
    label: 'Present',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    icon: CheckCircle,
  },
  late: {
    label: 'Late',
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: Clock,
  },
  excused: {
    label: 'Excused',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: AlertCircle,
  },
  absent: {
    label: 'Absent',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    icon: XCircle,
  },
};

const RESULT_STYLES: Record<string, string> = {
  pass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  needs_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  incomplete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentLabHistoryPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<LabsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedLabs, setExpandedLabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (session?.user?.email) {
      fetchLabs();
    }
  }, [session]);

  const fetchLabs = async () => {
    try {
      const res = await fetch('/api/student/labs');
      if (!res.ok) {
        if (res.status === 403) {
          setError('This page is only accessible to students.');
        } else {
          setError('Failed to load lab history. Please try again.');
        }
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching lab history:', err);
      setError('Failed to load lab history. Please try again.');
    }
    setLoading(false);
  };

  const toggleLab = (id: string) => {
    setExpandedLabs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
  };

  const hasActiveFilters = search || statusFilter;

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ─── Student not found ──────────────────────────────────────────────────
  if (!data.studentFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
              No Student Record Found
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {data.message || 'Your student record has not been set up yet. Please contact your instructor.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { labs, summary } = data;

  // ─── Filter labs ────────────────────────────────────────────────────────
  const filteredLabs = labs.filter((lab) => {
    const matchesSearch =
      search === '' ||
      (lab.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (lab.location || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === '' || lab.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="flex items-center gap-1 hover:text-cyan-600 dark:hover:text-cyan-400">
          <Home className="w-3.5 h-3.5" />
          Home
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/student" className="hover:text-cyan-600 dark:hover:text-cyan-400">
          Student
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-white">Lab History</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Lab History
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your past lab days, attendance, and completed stations
        </p>
      </div>

      {/* Summary Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Calendar className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary.attendanceRate}% Attendance
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {summary.total} lab day{summary.total !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              summary.attendanceRate >= 90
                ? 'bg-green-500'
                : summary.attendanceRate >= 75
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${summary.attendanceRate}%` }}
          />
        </div>

        {/* Status breakdown */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {summary.present} Present
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {summary.late} Late
            </span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {summary.excused} Excused
            </span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {summary.absent} Absent
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by lab title or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg ${
                hasActiveFilters
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-300'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Attendance Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  >
                    <option value="">All Statuses</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {filteredLabs.length} lab day{filteredLabs.length !== 1 ? 's' : ''} found
      </div>

      {/* Labs List */}
      {filteredLabs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No lab days found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {hasActiveFilters
              ? 'Try adjusting your filters or search term'
              : 'No lab attendance records available yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLabs.map((lab) => {
            const cfg = STATUS_CONFIG[lab.status] || STATUS_CONFIG.absent;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedLabs.has(lab.id);
            const hasDetails = lab.stations.length > 0 || lab.skillsSignedOff.length > 0;

            return (
              <div
                key={lab.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
              >
                {/* Lab day row */}
                <div
                  className={`flex items-center gap-4 px-5 py-4 ${
                    hasDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
                  }`}
                  onClick={() => hasDetails && toggleLab(lab.id)}
                >
                  {/* Date badge */}
                  {lab.date && (
                    <div className="shrink-0 text-center w-14">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
                        {formatWeekday(lab.date)}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                        {parseDateSafe(lab.date).getDate()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {parseDateSafe(lab.date).toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                    </div>
                  )}

                  {/* Lab info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {lab.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                      {(lab.startTime || lab.endTime) && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {lab.startTime ? formatTime(lab.startTime) : ''}
                          {lab.startTime && lab.endTime ? ' - ' : ''}
                          {lab.endTime ? formatTime(lab.endTime) : ''}
                        </span>
                      )}
                      {lab.location && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {lab.location}
                        </span>
                      )}
                      {lab.stations.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Beaker className="w-3 h-3" />
                          {lab.stations.length} station{lab.stations.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {lab.skillsSignedOff.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <ClipboardCheck className="w-3 h-3" />
                          {lab.skillsSignedOff.length} skill{lab.skillsSignedOff.length !== 1 ? 's' : ''} signed off
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </span>
                    {hasDetails && (
                      isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && hasDetails && (
                  <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 bg-gray-50/50 dark:bg-gray-700/20">
                    {/* Stations completed */}
                    {lab.stations.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                          Stations Completed
                        </h4>
                        <div className="space-y-1.5">
                          {lab.stations.map((station) => (
                            <div
                              key={station.id}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white dark:bg-gray-800"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Beaker className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="text-sm text-gray-900 dark:text-white truncate">
                                  {station.stationName}
                                </span>
                                {station.stationCode && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                                    ({station.stationCode})
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${RESULT_STYLES[station.result] || 'bg-gray-100 text-gray-700'}`}>
                                {station.result === 'pass'
                                  ? 'Pass'
                                  : station.result === 'needs_review'
                                  ? 'Needs Review'
                                  : station.result === 'incomplete'
                                  ? 'Incomplete'
                                  : station.result}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skills signed off */}
                    {lab.skillsSignedOff.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                          Skills Signed Off
                        </h4>
                        <div className="space-y-1.5">
                          {lab.skillsSignedOff.map((skill) => (
                            <div
                              key={skill.id}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white dark:bg-gray-800"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-sm text-gray-900 dark:text-white truncate">
                                  {skill.skillName}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">
                                {skill.signedOffBy ? skill.signedOffBy.split('@')[0] : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {lab.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium">Notes:</span> {lab.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
