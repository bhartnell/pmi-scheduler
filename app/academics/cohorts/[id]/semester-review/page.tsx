'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  GitCompare,
  Download,
  Loader2,
  CheckCircle2,
  Circle,
  Plus,
  Repeat,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

/**
 * Semester Review — Template vs Actual comparison.
 *
 * Shows four buckets per semester: covered, not_yet, repeated, additions.
 * "Not yet" is the primary mid-semester planning surface — template
 * items with zero actuals, sorted most-overdue-first by template_number.
 */

interface Run {
  station_id: string;
  lab_day_id: string;
  date: string;
  week_number: number | null;
  custom_title: string | null;
  resolved_via: string;
}

type MatchMethod = 'exact' | 'contains' | 'fuzzy' | 'none';

interface Bucket {
  name: string;
  skill_id: string | null;
  min_attempts?: number;
  platinum_skill?: boolean;
  template_number?: number | null;
  match_method?: MatchMethod;
  runs: Run[];
}

interface Addition {
  station_id: string;
  lab_day_id: string;
  date: string;
  week_number: number | null;
  name: string;
  custom_title: string | null;
  resolved_skill_id: string | null;
  resolved_via: string;
}

interface ReviewResponse {
  success: boolean;
  cohort?: {
    id: string;
    cohort_number: number | string | null;
    current_semester: number | null;
    program_abbr: string | null;
  };
  semester?: number | null;
  template_count?: number;
  template_station_count?: number;
  actual_lab_day_count?: number;
  actual_station_count?: number;
  buckets?: {
    covered: Bucket[];
    not_yet: Bucket[];
    repeated: Bucket[];
    additions: Addition[];
  };
  error?: string;
}

function formatDate(iso: string): string {
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

export default function SemesterReviewPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params?.id as string;

  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [semesterOverride, setSemesterOverride] = useState<number | null>(null);
  const [showWeakMatches, setShowWeakMatches] = useState(true);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  const fetchData = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (semesterOverride != null) qs.set('semester', String(semesterOverride));
      const res = await fetch(
        `/api/lab-management/cohorts/${cohortId}/semester-review${
          qs.toString() ? `?${qs.toString()}` : ''
        }`
      );
      const json: ReviewResponse = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load semester review');
      } else {
        setData(json);
      }
    } catch {
      setError('Failed to load semester review');
    } finally {
      setLoading(false);
    }
  }, [cohortId, semesterOverride]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buckets = data?.buckets;

  // Filter weak matches out when the toggle is off. "Weak" = template
  // item matched via fuzzy / none (name-only). Only applies to covered
  // and repeated (not_yet is definitionally not matched).
  const filterBucket = useCallback(
    (list: Bucket[]) =>
      showWeakMatches
        ? list
        : list.filter(
            (b) => b.match_method === 'exact' || b.match_method === 'contains'
          ),
    [showWeakMatches]
  );

  const visibleCovered = useMemo(
    () => (buckets ? filterBucket(buckets.covered) : []),
    [buckets, filterBucket]
  );
  const visibleRepeated = useMemo(
    () => (buckets ? filterBucket(buckets.repeated) : []),
    [buckets, filterBucket]
  );

  const handleExportCsv = useCallback(() => {
    if (!buckets) return;
    const cohortLabel = data?.cohort?.cohort_number
      ? `Cohort${String(data.cohort.cohort_number).replace(/\.0$/, '')}`
      : 'Cohort';
    const semLabel = `Semester${data?.semester ?? ''}`;
    const today = new Date().toISOString().split('T')[0];
    const filename = `SemesterReview_${cohortLabel}_${semLabel}_${today}.csv`;

    const escape = (v: string | number | boolean | null | undefined): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      [
        'Bucket',
        'Name',
        'Scheduled Template #',
        'Times Run',
        'Run Dates',
        'Match Method',
      ]
        .map(escape)
        .join(','),
    ];
    const pushBucket = (label: string, list: Bucket[]) => {
      for (const b of list) {
        lines.push(
          [
            escape(label),
            escape(b.name),
            escape(b.template_number ?? ''),
            escape(b.runs.length),
            escape(b.runs.map((r) => r.date).join(' | ')),
            escape(b.match_method || 'exact'),
          ].join(',')
        );
      }
    };
    pushBucket('Covered', buckets.covered);
    pushBucket('Not Yet Run', buckets.not_yet);
    pushBucket('Repeated', buckets.repeated);
    for (const a of buckets.additions) {
      lines.push(
        [
          escape('Addition'),
          escape(a.name),
          escape(''),
          escape(1),
          escape(a.date),
          escape(a.resolved_via),
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
  }, [buckets, data]);

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
                  <GitCompare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Semester Review
                </h1>
                {data?.cohort && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {data.cohort.program_abbr} Cohort{' '}
                    {String(data.cohort.cohort_number).replace(/\.0$/, '')} —
                    Semester {data.semester} · Template vs Actual
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleExportCsv}
              disabled={!buckets}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Summary + filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Semester:
              </span>
              {[1, 2, 3, 4].map((s) => {
                const active =
                  (semesterOverride ?? data?.cohort?.current_semester) === s;
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
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={showWeakMatches}
                onChange={(e) => setShowWeakMatches(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              Show weak (fuzzy) matches
            </label>
          </div>
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <StatCard
                label="Template items"
                value={
                  (buckets?.covered.length || 0) +
                  (buckets?.not_yet.length || 0) +
                  (buckets?.repeated.length || 0)
                }
                color="blue"
              />
              <StatCard
                label="Covered"
                value={buckets?.covered.length || 0}
                color="green"
              />
              <StatCard
                label="Not yet run"
                value={buckets?.not_yet.length || 0}
                color="amber"
              />
              <StatCard
                label="Additions"
                value={buckets?.additions.length || 0}
                color="gray"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading...
          </div>
        )}

        {/* Not Yet — primary planning surface, first */}
        {buckets && (
          <Section
            title="Not yet run"
            count={buckets.not_yet.length}
            icon={<Circle className="w-5 h-5 text-amber-500" />}
            accent="amber"
            description="Template items that haven't been covered yet this semester. Sorted by scheduled template number — most overdue first."
          >
            {buckets.not_yet.length === 0 ? (
              <EmptyRow message="Nothing missing — the template has been fully covered." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {buckets.not_yet.map((b) => (
                  <li key={b.name} className="px-4 py-2 flex items-center gap-3">
                    <Circle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {b.name}
                        {b.platinum_skill && (
                          <span className="ml-2 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            platinum
                          </span>
                        )}
                      </div>
                      {b.min_attempts && b.min_attempts > 1 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {`min ${b.min_attempts} attempts per CoAEMSP`}
                        </div>
                      )}
                    </div>
                    {b.template_number != null && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        Template #{b.template_number}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Covered */}
        {buckets && (
          <Section
            title="Covered"
            count={visibleCovered.length}
            icon={<CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
            accent="green"
            description="Template items that ran exactly once this semester."
          >
            {visibleCovered.length === 0 ? (
              <EmptyRow message="Nothing in this bucket yet." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {visibleCovered.map((b) => (
                  <li key={b.name} className="px-4 py-2 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {b.name}
                        {b.match_method === 'fuzzy' && (
                          <span
                            className="ml-2 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 inline-flex items-center gap-0.5"
                            title="Matched via fuzzy name similarity — review"
                          >
                            <AlertCircle className="w-2.5 h-2.5" />
                            fuzzy
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 flex-wrap justify-end">
                      {b.runs.map((r) => (
                        <Link
                          key={r.station_id}
                          href={`/labs/schedule/${r.lab_day_id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                          title={r.custom_title || undefined}
                        >
                          {formatDate(r.date)}
                          {r.week_number != null && ` · Wk${r.week_number}`}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Repeated */}
        {buckets && (
          <Section
            title="Repeated"
            count={visibleRepeated.length}
            icon={<Repeat className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            accent="blue"
            description="Template items that ran 2 or more times. Extra practice beyond the template plan."
          >
            {visibleRepeated.length === 0 ? (
              <EmptyRow message="Nothing in this bucket." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {visibleRepeated.map((b) => (
                  <li key={b.name} className="px-4 py-2 flex items-center gap-3">
                    <Repeat className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {b.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                        {b.runs.length}×
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-1 flex-wrap justify-end">
                        {b.runs.map((r) => (
                          <Link
                            key={r.station_id}
                            href={`/labs/schedule/${r.lab_day_id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {formatDate(r.date)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Additions */}
        {buckets && (
          <Section
            title="Additions"
            count={buckets.additions.length}
            icon={<Plus className="w-5 h-5 text-gray-500" />}
            accent="gray"
            description="Lab stations that ran but weren't in the template. Instructor availability, guest speakers, ad-hoc additions."
          >
            {buckets.additions.length === 0 ? (
              <EmptyRow message="No additions — everything that ran was in the template." />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {buckets.additions.map((a) => (
                  <li
                    key={a.station_id}
                    className="px-4 py-2 flex items-center gap-3"
                  >
                    <Plus className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {a.name}
                      </div>
                      {a.custom_title && a.custom_title !== a.name && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {a.custom_title}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/labs/schedule/${a.lab_day_id}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 tabular-nums"
                    >
                      {formatDate(a.date)}
                      {a.week_number != null && ` · Wk${a.week_number}`}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  count,
  icon,
  accent,
  description,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  accent: 'green' | 'amber' | 'blue' | 'gray';
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const accentHeader =
    accent === 'amber'
      ? 'border-l-4 border-amber-400'
      : accent === 'green'
        ? 'border-l-4 border-green-500'
        : accent === 'blue'
          ? 'border-l-4 border-blue-500'
          : 'border-l-4 border-gray-300';
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden ${accentHeader}`}
    >
      <summary className="cursor-pointer px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 flex items-center gap-2">
        {icon}
        <span className="font-semibold text-gray-900 dark:text-white">
          {title}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({count})
        </span>
        <span className="ml-auto text-xs text-gray-400 hidden sm:inline">
          {description}
        </span>
      </summary>
      <div className="border-t border-gray-200 dark:border-gray-700">
        {children}
      </div>
    </details>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'amber' | 'gray';
}) {
  const bg =
    color === 'green'
      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
      : color === 'amber'
        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
        : color === 'blue'
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          : 'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300';
  return (
    <div className={`rounded p-2 ${bg}`}>
      <div className="text-[10px] uppercase font-semibold opacity-70">
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {message}
    </div>
  );
}
