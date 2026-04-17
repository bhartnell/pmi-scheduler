'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Circle,
  CircleDot,
  CheckCircle2,
  Loader2,
  Search,
  ArrowUpDown,
  Download,
} from 'lucide-react';

/**
 * Lab-planning reference panel.
 *
 * Answers "has this cohort practiced this skill this semester, and how
 * many times?" by aggregating distinct lab_day_id counts per skill.
 *
 * This is NOT a student tracker — Platinum handles per-student competency.
 * This panel is a scheduling aid: when building a new lab day you can
 * glance right and see which skills have been under-practiced.
 *
 * Collapsible by default on mobile; expanded on desktop.
 */

type CoverageStatus = 'multiple' | 'once' | 'not_yet';
type SortKey = 'name' | 'count' | 'last_run';
type SortDir = 'asc' | 'desc';

interface SkillRow {
  skill_id: string;
  name: string;
  category: string | null;
  lab_day_count: number;
  last_run_date: string | null;
  status: CoverageStatus;
  in_program: boolean;
}

interface CoverageResponse {
  success: boolean;
  cohort?: {
    id: string;
    cohort_number: number | null;
    current_semester: number | null;
    program_abbr: string | null;
  };
  semester?: number | null;
  total_lab_days?: number;
  skills?: SkillRow[];
  error?: string;
}

type Filter = 'all' | 'not_yet' | 'once' | 'multiple';

interface Props {
  cohortId: string | null | undefined;
  /** Override semester. If omitted, uses cohort.current_semester. */
  semester?: number | null;
  /** Start expanded on desktop. Collapsed defaults on smaller viewports. */
  defaultExpanded?: boolean;
  /** Render as inline card (no sticky positioning). Used on the cohort hub. */
  inline?: boolean;
}

const STATUS_META: Record<
  CoverageStatus,
  { icon: typeof Circle; label: string; classes: string }
> = {
  multiple: {
    icon: CheckCircle2,
    label: 'Done multiple times',
    classes: 'text-green-600 dark:text-green-400',
  },
  once: {
    icon: CircleDot,
    label: 'Done once',
    classes: 'text-amber-600 dark:text-amber-400',
  },
  not_yet: {
    icon: Circle,
    label: 'Not yet',
    classes: 'text-gray-400 dark:text-gray-500',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  // ISO date from Postgres — render as MM/DD
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function SkillCoveragePanel({
  cohortId,
  semester,
  defaultExpanded = true,
  inline = false,
}: Props) {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  // Sort state. Default 'name asc' matches the API's default ordering
  // (display_order, then name), so the initial render doesn't reshuffle.
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const fetchCoverage = useCallback(async () => {
    if (!cohortId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (semester != null) qs.set('semester', String(semester));
      const url = `/api/lab-management/cohorts/${cohortId}/skill-coverage${
        qs.toString() ? `?${qs.toString()}` : ''
      }`;
      const res = await fetch(url);
      const json: CoverageResponse = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load skill coverage');
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError('Failed to load skill coverage');
    } finally {
      setLoading(false);
    }
  }, [cohortId, semester]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const filteredSkills = useMemo(() => {
    if (!data?.skills) return [];
    const q = search.trim().toLowerCase();
    const filtered = data.skills.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
    // Sort on a copy — the source array is memoized from the API response.
    // For name: simple locale compare. For count: numeric. For last_run:
    // ISO date string compare (safe because YYYY-MM-DD sorts correctly).
    // Nulls go to the end on asc, start on desc for last_run/count.
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      if (sortKey === 'count') {
        return (a.lab_day_count - b.lab_day_count) * dir;
      }
      // last_run: nulls always at bottom regardless of dir
      const aNull = !a.last_run_date;
      const bNull = !b.last_run_date;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return a.last_run_date!.localeCompare(b.last_run_date!) * dir;
    });
    return sorted;
  }, [data, filter, search, sortKey, sortDir]);

  // Export currently-filtered rows (respects search + status filter) as CSV.
  // Filename includes cohort number + semester so downloaded files are
  // self-identifying when multiple are saved for comparison.
  const handleExportCsv = useCallback(() => {
    if (!data?.skills) return;
    const cohortLabel = data.cohort?.cohort_number
      ? `Cohort${String(data.cohort.cohort_number).replace(/\.0$/, '')}`
      : 'Cohort';
    const semLabel =
      data.semester != null ? `Semester${data.semester}` : 'AllSemesters';
    const today = new Date().toISOString().split('T')[0];
    const filename = `SkillCoverage_${cohortLabel}_${semLabel}_${today}.csv`;

    const escape = (v: string | number | null | undefined): string => {
      if (v == null) return '';
      const s = String(v);
      // Quote any cell containing a comma, quote, or newline, per RFC 4180.
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = [
      'Skill',
      'Category',
      'Lab Days',
      'Last Run',
      'Status',
      'In Program',
    ];
    const statusLabel: Record<CoverageStatus, string> = {
      multiple: 'Done multiple times',
      once: 'Done once',
      not_yet: 'Not yet',
    };
    const lines = [header.map(escape).join(',')];
    for (const s of filteredSkills) {
      lines.push(
        [
          escape(s.name),
          escape(s.category || ''),
          escape(s.lab_day_count),
          escape(s.last_run_date || ''),
          escape(statusLabel[s.status]),
          escape(s.in_program ? 'yes' : 'no'),
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, filteredSkills]);

  const counts = useMemo(() => {
    const c = { multiple: 0, once: 0, not_yet: 0, total: 0 };
    for (const s of data?.skills || []) {
      c.total++;
      c[s.status]++;
    }
    return c;
  }, [data]);

  if (!cohortId) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${
          inline ? '' : 'border border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="px-4 py-3 flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <ClipboardCheck className="w-4 h-4" />
          Select a cohort to see skill coverage
        </div>
      </div>
    );
  }

  const effectiveSemester = data?.semester ?? null;
  const semesterLabel =
    effectiveSemester !== null ? `Semester ${effectiveSemester}` : 'All semesters';

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${
        inline ? '' : 'border border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Header — always visible, click to collapse/expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
          <ClipboardCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Skill Coverage
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {semesterLabel}
          </span>
        </div>
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        )}
        {!loading && data && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="w-3 h-3" />
              {counts.multiple}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <CircleDot className="w-3 h-3" />
              {counts.once}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Circle className="w-3 h-3" />
              {counts.not_yet}
            </span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {error && (
            <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {!error && (
            <>
              {/* Filters */}
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by name..."
                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'not_yet', 'once', 'multiple'] as Filter[]).map(
                    (f) => {
                      const active = filter === f;
                      const label =
                        f === 'all'
                          ? `All (${counts.total})`
                          : f === 'not_yet'
                            ? `Not yet (${counts.not_yet})`
                            : f === 'once'
                              ? `Once (${counts.once})`
                              : `Multiple (${counts.multiple})`;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFilter(f)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    }
                  )}
                </div>
                {/* Sort + CSV export row. Sort dropdown + direction toggle
                    is more compact than column headers in this narrow panel. */}
                <div className="flex items-center gap-2 pt-1">
                  <ArrowUpDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                    aria-label="Sort by"
                  >
                    <option value="name">Name</option>
                    <option value="last_run">Last practiced</option>
                    <option value="count">Times practiced</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                    }
                    className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    aria-label={
                      sortDir === 'asc' ? 'Ascending' : 'Descending'
                    }
                    title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={!data?.skills?.length}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Download as CSV"
                  >
                    <Download className="w-3 h-3" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                </div>
              </div>

              {/* Skill list */}
              <div
                className={`overflow-y-auto ${
                  inline ? 'max-h-[600px]' : 'max-h-[70vh]'
                }`}
              >
                {loading && !data && (
                  <div className="px-4 py-8 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </div>
                )}

                {!loading && filteredSkills.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No skills match your filter.
                  </div>
                )}

                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredSkills.map((s) => {
                    const meta = STATUS_META[s.status];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={s.skill_id}
                        className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${meta.classes}`}
                          aria-label={meta.label}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 dark:text-white truncate">
                            {s.name}
                            {!s.in_program && (
                              <span
                                className="ml-2 text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400"
                                title="Not on the program list — ran anyway"
                              >
                                extra
                              </span>
                            )}
                          </div>
                          {s.category && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {s.category}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                            {s.lab_day_count === 0
                              ? '—'
                              : `${s.lab_day_count}×`}
                          </div>
                          {s.last_run_date && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatDate(s.last_run_date)}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Footer */}
              {data && (
                <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
                  {data.total_lab_days ?? 0} lab day
                  {(data.total_lab_days ?? 0) === 1 ? '' : 's'} ·{' '}
                  {counts.total} skill{counts.total === 1 ? '' : 's'}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
