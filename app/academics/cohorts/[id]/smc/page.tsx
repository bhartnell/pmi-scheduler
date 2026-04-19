'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Target,
  Search,
  Download,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Star,
  Settings,
} from 'lucide-react';
import { hasMinRole, type Role } from '@/lib/permissions';

/**
 * SMC (Student Minimum Competency) completion view.
 *
 * Primary question: "Which required skills have been covered this
 * semester and which still need to happen before semester end?"
 *
 * SMC is the source of truth (not the template). Shows every SMC
 * requirement for the cohort's program + semester with a status
 * indicator. Default sort is "not yet first" so the gap list is
 * immediately visible.
 */

type MatchMethod =
  | 'station_skills'
  | 'title_exact'
  | 'title_contains'
  | 'title_fuzzy'
  | null;

interface SmcRow {
  id: string;
  skill_id: string | null;
  skill_name: string;
  category: string | null;
  min_attempts: number;
  is_platinum: boolean;
  /** EMT: week the skill is introduced (1-14). Null for AEMT/Paramedic. */
  week_number?: number | null;
  /** AEMT: CoAEMSP skills marked * allow simulation toward min_attempts. */
  sim_permitted?: boolean;
  covered: boolean;
  lab_day_count: number;
  first_covered_date: string | null;
  last_run_date: string | null;
  match_method: MatchMethod;
  matched_stations: Array<{
    date: string;
    lab_day_id: string;
    week_number: number | null;
    custom_title: string | null;
  }>;
}

interface SmcResponse {
  success: boolean;
  cohort?: {
    id: string;
    cohort_number: number | string | null;
    current_semester: number | null;
    program_id: string | null;
    program_abbr: string | null;
  };
  semester?: number | null;
  total_lab_days?: number;
  smc_count?: number;
  covered_count?: number;
  results?: SmcRow[];
  error?: string;
}

type StatusFilter = 'all' | 'not_yet' | 'covered' | 'weak_match';
type SortKey = 'status' | 'name' | 'last_run' | 'count';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

const METHOD_META: Record<
  Exclude<MatchMethod, null>,
  { label: string; strength: 'strong' | 'medium' | 'weak' }
> = {
  station_skills: { label: 'Skill link', strength: 'strong' },
  title_exact: { label: 'Exact name', strength: 'strong' },
  title_contains: { label: 'Contains', strength: 'medium' },
  title_fuzzy: { label: 'Fuzzy', strength: 'weak' },
};

export default function SmcCompletionPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params?.id as string;

  const [data, setData] = useState<SmcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [semesterOverride, setSemesterOverride] = useState<number | null>(null);

  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  // Lightweight role fetch so the "Manage SMC" admin button only renders
  // for lead_instructor+. Non-admins hitting the admin URL still get
  // bounced by the page's own access gate; this is cosmetic only.
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    fetch('/api/instructor/me')
      .then((r) => r.json())
      .then((data) => {
        const role = (data.user?.role || data.role) as Role | undefined;
        if (role) setUserRole(role);
      })
      .catch(() => {
        // Non-fatal — button just won't render
      });
  }, [sessionStatus]);

  const canManageSmc = userRole ? hasMinRole(userRole, 'lead_instructor') : false;

  const fetchData = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (semesterOverride != null)
        qs.set('semester', String(semesterOverride));
      const res = await fetch(
        `/api/lab-management/cohorts/${cohortId}/smc-completion${
          qs.toString() ? `?${qs.toString()}` : ''
        }`
      );
      const json: SmcResponse = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load SMC completion');
      } else {
        setData(json);
      }
    } catch {
      setError('Failed to load SMC completion');
    } finally {
      setLoading(false);
    }
  }, [cohortId, semesterOverride]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    if (!data?.results) return [];
    const q = search.trim().toLowerCase();
    const filtered = data.results.filter((r) => {
      if (q && !r.skill_name.toLowerCase().includes(q)) return false;
      if (statusFilter === 'not_yet' && r.covered) return false;
      if (statusFilter === 'covered' && !r.covered) return false;
      if (
        statusFilter === 'weak_match' &&
        (!r.covered || (r.match_method !== 'title_contains' && r.match_method !== 'title_fuzzy'))
      )
        return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'status') {
        // Sort: not yet (0) first, then covered (1). Secondary by name.
        const aS = a.covered ? 1 : 0;
        const bS = b.covered ? 1 : 0;
        if (aS !== bS) return (aS - bS) * dir;
        return a.skill_name.localeCompare(b.skill_name);
      }
      if (sortKey === 'name') return a.skill_name.localeCompare(b.skill_name) * dir;
      if (sortKey === 'count') return (a.lab_day_count - b.lab_day_count) * dir;
      // last_run: null last on asc, first on desc
      const aNull = !a.last_run_date;
      const bNull = !b.last_run_date;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return a.last_run_date!.localeCompare(b.last_run_date!) * dir;
    });
    return sorted;
  }, [data, statusFilter, search, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c = { covered: 0, not_yet: 0, weak: 0, platinum_missing: 0, total: 0 };
    for (const r of data?.results || []) {
      c.total++;
      if (r.covered) {
        c.covered++;
        if (
          r.match_method === 'title_contains' ||
          r.match_method === 'title_fuzzy'
        )
          c.weak++;
      } else {
        c.not_yet++;
        if (r.is_platinum) c.platinum_missing++;
      }
    }
    return c;
  }, [data]);

  const handleExportCsv = useCallback(() => {
    if (!filteredRows.length) return;
    const cohortLabel = data?.cohort?.cohort_number
      ? `Cohort${String(data.cohort.cohort_number).replace(/\.0$/, '')}`
      : 'Cohort';
    const semLabel = `Semester${data?.semester ?? ''}`;
    const today = new Date().toISOString().split('T')[0];
    const filename = `SMC_${cohortLabel}_${semLabel}_${today}.csv`;

    const escape = (v: string | number | boolean | null | undefined): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      [
        'Skill',
        'Week',
        'Category',
        'Platinum',
        'Sim Permitted',
        'Min Attempts',
        'Covered',
        'Lab Days',
        'First Covered',
        'Last Run',
        'Match Method',
      ]
        .map(escape)
        .join(','),
    ];
    for (const r of filteredRows) {
      lines.push(
        [
          escape(r.skill_name),
          escape(r.week_number ?? ''),
          escape(r.category),
          escape(r.is_platinum ? 'yes' : 'no'),
          escape(r.sim_permitted ? 'yes' : 'no'),
          escape(r.min_attempts),
          escape(r.covered ? 'yes' : 'no'),
          escape(r.lab_day_count),
          escape(r.first_covered_date),
          escape(r.last_run_date),
          escape(r.match_method || 'none'),
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
  }, [filteredRows, data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/academics/cohorts/${cohortId}`}
                className="flex items-center gap-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  SMC Coverage
                </h1>
                {data?.cohort && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {data.cohort.program_abbr} Cohort{' '}
                    {String(data.cohort.cohort_number).replace(/\.0$/, '')} —
                    Semester {data.semester}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManageSmc && (
                <Link
                  href={`/academics/admin/smc?${
                    data?.cohort?.program_id
                      ? `program_id=${data.cohort.program_id}`
                      : ''
                  }${
                    data?.semester != null
                      ? `${data?.cohort?.program_id ? '&' : ''}semester=${data.semester}`
                      : ''
                  }`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                  title="Manage SMC requirements (lead instructor+)"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage SMC</span>
                </Link>
              )}
              <button
                onClick={handleExportCsv}
                disabled={!filteredRows.length}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                Covered
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {counts.covered}
                </span>
                <span className="text-sm text-gray-400">/ {counts.total}</span>
              </div>
              <div className="h-1.5 mt-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${counts.total ? (counts.covered / counts.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                Not Yet
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-700 dark:text-gray-200">
                {counts.not_yet}
              </div>
              {counts.platinum_missing > 0 && (
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  {counts.platinum_missing} platinum missing
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                Weak Matches
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {counts.weak}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                review suggested
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                Lab Days
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-700 dark:text-gray-200">
                {data.total_lab_days ?? 0}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                this semester
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skill name..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {data?.cohort && (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Sem:
                </span>
                {[1, 2, 3, 4].map((s) => {
                  const active =
                    (semesterOverride ?? data.cohort?.current_semester) === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSemesterOverride(s)}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', `All (${counts.total})`],
              ['not_yet', `Not yet (${counts.not_yet})`],
              ['covered', `Covered (${counts.covered})`],
              ['weak_match', `Weak matches (${counts.weak})`],
            ] as [StatusFilter, string][]).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  statusFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Sort:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
              >
                <option value="status">Status (not yet first)</option>
                <option value="name">Name</option>
                <option value="last_run">Last run</option>
                <option value="count">Times practiced</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="px-1.5 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* SMC list */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {error && (
            <div className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {loading && !data && (
            <div className="px-4 py-12 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading...
            </div>
          )}
          {!loading && !error && filteredRows.length === 0 && data && (
            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {data.results?.length
                ? 'No skills match your filter.'
                : 'No SMC requirements set for this program/semester yet.'}
            </div>
          )}
          {filteredRows.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredRows.map((r) => {
                const Icon = r.covered ? CheckCircle2 : Circle;
                const iconColor = r.covered
                  ? 'text-green-600 dark:text-green-400'
                  : r.is_platinum
                    ? 'text-amber-500'
                    : 'text-gray-400 dark:text-gray-500';
                const methodMeta = r.match_method
                  ? METHOD_META[r.match_method]
                  : null;
                const isWeak =
                  methodMeta?.strength === 'weak' ||
                  methodMeta?.strength === 'medium';
                return (
                  <li
                    key={r.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {typeof r.week_number === 'number' && r.week_number > 0 && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 tabular-nums"
                            title={`Introduced in week ${r.week_number}`}
                          >
                            Wk {r.week_number}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {r.skill_name}
                        </span>
                        {r.sim_permitted && (
                          <span
                            className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            title="Simulation permitted toward minimum attempts"
                          >
                            sim ok
                          </span>
                        )}
                        {r.is_platinum && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            title="Platinum skill"
                          >
                            <Star className="w-2.5 h-2.5 fill-current" />
                            platinum
                          </span>
                        )}
                        {r.skill_id === null && (
                          <span
                            className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            title="Not linked to skills catalog — admin review needed"
                          >
                            unlinked
                          </span>
                        )}
                        {isWeak && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            title={`Matched via ${methodMeta?.label.toLowerCase()} — review suggested`}
                          >
                            <AlertCircle className="w-2.5 h-2.5" />
                            {methodMeta?.label.toLowerCase()}
                          </span>
                        )}
                      </div>
                      {r.category && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {r.category}
                        </div>
                      )}
                      {r.covered && r.matched_stations.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Last:{' '}
                          <Link
                            href={`/labs/schedule/${r.matched_stations[0].lab_day_id}/edit`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {r.matched_stations[0].custom_title ||
                              '(untitled station)'}
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                        {r.covered ? `${r.lab_day_count}×` : '—'}
                      </div>
                      {r.last_run_date && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(r.last_run_date)}
                        </div>
                      )}
                      {!r.covered && r.min_attempts > 1 && (
                        <div className="text-xs text-gray-400">
                          0 / {r.min_attempts}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
