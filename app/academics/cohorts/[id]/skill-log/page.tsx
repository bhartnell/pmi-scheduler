'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Search,
  Download,
  Loader2,
  Calendar,
  ExternalLink,
} from 'lucide-react';

/**
 * Full semester log view. Replaces the manual Google Doc the user was
 * maintaining with structure:
 *   Date | Skill or Scenario | Lab Name (clickable link) | Week | Day
 *
 * NOT a per-student tracker. Just what the cohort practiced and when.
 * Chronological, newest first. Filter: semester + kind (skill / scenario
 * / both). CSV export for printing or archiving.
 */

interface Entry {
  date: string;
  lab_day_id: string;
  lab_name: string | null;
  week_number: number | null;
  day_number: number | null;
  station_number: number | null;
  station_title: string | null;
  kind: 'skill' | 'scenario';
  item_id: string;
  item_name: string;
  item_category: string | null;
}

interface LogResponse {
  success: boolean;
  cohort?: {
    id: string;
    cohort_number: number | string | null;
    current_semester: number | null;
  };
  semester?: number | null;
  entries?: Entry[];
  error?: string;
}

type KindFilter = 'both' | 'skill' | 'scenario';
type SemesterFilter = 'current' | 'all' | '1' | '2' | '3' | '4';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function CohortSkillLogPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params?.id as string;

  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('both');
  const [semesterFilter, setSemesterFilter] =
    useState<SemesterFilter>('current');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  const fetchLog = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('kind', kindFilter);
      // 'current' requires knowing current_semester — server will default
      // to all semesters if not provided, so we explicitly include the
      // current_semester once we know it. For other values we pass through.
      if (semesterFilter === 'all') {
        // omit semester → server returns all
      } else if (semesterFilter === 'current') {
        if (data?.cohort?.current_semester != null) {
          qs.set('semester', String(data.cohort.current_semester));
        }
      } else {
        qs.set('semester', semesterFilter);
      }
      const res = await fetch(
        `/api/lab-management/cohorts/${cohortId}/skill-log?${qs.toString()}`
      );
      const json: LogResponse = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load skill log');
      } else {
        setData(json);
      }
    } catch {
      setError('Failed to load skill log');
    } finally {
      setLoading(false);
    }
    // `data` intentionally excluded — we only use it to bootstrap the
    // current_semester value; re-running the fetch on data change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, kindFilter, semesterFilter]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const filteredEntries = useMemo(() => {
    if (!data?.entries) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.entries;
    return data.entries.filter(
      (e) =>
        e.item_name.toLowerCase().includes(q) ||
        (e.lab_name?.toLowerCase().includes(q) ?? false) ||
        (e.station_title?.toLowerCase().includes(q) ?? false)
    );
  }, [data, search]);

  const handleExportCsv = useCallback(() => {
    if (!filteredEntries.length) return;
    const cohortLabel = data?.cohort?.cohort_number
      ? `Cohort${String(data.cohort.cohort_number).replace(/\.0$/, '')}`
      : 'Cohort';
    const semLabel =
      semesterFilter === 'all'
        ? 'AllSemesters'
        : semesterFilter === 'current'
          ? `Semester${data?.cohort?.current_semester ?? ''}`
          : `Semester${semesterFilter}`;
    const today = new Date().toISOString().split('T')[0];
    const filename = `SkillLog_${cohortLabel}_${semLabel}_${today}.csv`;

    const escape = (v: string | number | null | undefined): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      ['Date', 'Type', 'Skill or Scenario', 'Category', 'Lab Name', 'Week', 'Day', 'Station #', 'Station Title']
        .map(escape)
        .join(','),
    ];
    for (const e of filteredEntries) {
      lines.push(
        [
          escape(e.date),
          escape(e.kind),
          escape(e.item_name),
          escape(e.item_category || ''),
          escape(e.lab_name || ''),
          escape(e.week_number),
          escape(e.day_number),
          escape(e.station_number),
          escape(e.station_title || ''),
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
  }, [filteredEntries, data, semesterFilter]);

  const counts = useMemo(() => {
    const c = { skill: 0, scenario: 0, total: 0 };
    for (const e of data?.entries || []) {
      c.total++;
      c[e.kind]++;
    }
    return c;
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/academics/cohorts/${cohortId}`}
                className="flex items-center gap-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Cohort</span>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Lab Practice Log
                </h1>
                {data?.cohort && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cohort{' '}
                    {String(data.cohort.cohort_number).replace(/\.0$/, '')}
                    {semesterFilter === 'current' &&
                    data.cohort.current_semester != null
                      ? ` — Semester ${data.cohort.current_semester}`
                      : semesterFilter === 'all'
                        ? ' — All semesters'
                        : semesterFilter !== 'current'
                          ? ` — Semester ${semesterFilter}`
                          : ''}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleExportCsv}
              disabled={!filteredEntries.length}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skill, scenario, or lab name..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Semester:
              </span>
              {(['current', 'all', '1', '2', '3', '4'] as SemesterFilter[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSemesterFilter(f)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      semesterFilter === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {f === 'current' ? 'Current' : f === 'all' ? 'All' : f}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Show:
              </span>
              {(['both', 'skill', 'scenario'] as KindFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setKindFilter(f)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize ${
                    kindFilter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {f === 'both' ? 'All' : `${f}s`}
                </button>
              ))}
            </div>

            {data && (
              <div className="flex items-center gap-2 ml-auto text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  <ClipboardCheck className="w-3 h-3" />
                  {counts.skill} skills
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  <Calendar className="w-3 h-3" />
                  {counts.scenario} scenarios
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Log table */}
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

          {!loading && !error && filteredEntries.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {data?.entries?.length
                ? 'No entries match your filter.'
                : 'Nothing logged yet for this cohort + filter.'}
            </div>
          )}

          {filteredEntries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-left">
                  <tr>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Skill / Scenario
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Lab
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase text-center">
                      Week
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase text-center">
                      Day
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase text-center">
                      Station
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredEntries.map((e, idx) => (
                    <tr
                      key={`${e.lab_day_id}-${e.kind}-${e.item_id}-${idx}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-white">
                        {formatDate(e.date)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-900 dark:text-white font-medium">
                            {e.item_name}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                              e.kind === 'scenario'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}
                          >
                            {e.kind}
                          </span>
                          {e.item_category && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              {e.item_category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/labs/schedule/${e.lab_day_id}/edit`}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {e.lab_name || '(untitled)'}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        {e.station_title && (
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {e.station_title}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400 tabular-nums">
                        {e.week_number ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400 tabular-nums">
                        {e.day_number ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400 tabular-nums">
                        {e.station_number ?? '—'}
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
