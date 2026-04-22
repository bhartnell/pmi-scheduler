'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  ChevronRight,
  Users,
  ClipboardList,
  Home,
  Archive,
  Table as TableIcon,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { formatCohortNumber } from '@/lib/format-cohort';

/**
 * Internship Tracker — cohort picker.
 *
 * Primary entry to internship management. Replaces the former
 * filtered-table view (now at /clinical/internships/all for power-user
 * cross-cohort filtering) with a cohort-card grid organized around the
 * fact that internships are Paramedic-only and typically scoped to
 * one active PM cohort at a time.
 *
 * Sections:
 *   1. Active PM cohorts (normally 1-2 cards when a cohort extends
 *      past the normal window and overlaps with the next).
 *   2. Recently completed (last 6 months), collapsed by default.
 *   3. Archive link.
 */

interface InternshipSummary {
  id: string;
  cohort_id: string;
  current_phase: string;
  provisional_license_obtained: boolean | null;
  phase_1_meeting_scheduled: string | null;
  phase_2_meeting_scheduled: string | null;
  final_exam_scheduled: string | null;
  students: { status: string } | null;
}

interface Cohort {
  id: string;
  cohort_number: number | string;
  current_semester: number | null;
  is_active: boolean;
  is_archived: boolean;
  start_date: string | null;
  expected_end_date: string | null;
  program: {
    id: string;
    abbreviation: string;
    name: string;
  } | null;
}

interface CohortWithStats extends Cohort {
  internships: InternshipSummary[];
  total: number;
  byPhase: Record<string, number>;
  notLicensed: number;
  meetingsPending: number;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function InternshipCohortPickerPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [internshipsByCohort, setInternshipsByCohort] = useState<
    Record<string, InternshipSummary[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Pull all PM-ish cohorts including recently-archived so the
      //    "recently completed" section has something to show.
      const cohortsRes = await fetch(
        '/api/lab-management/cohorts?include_archived=true'
      );
      const cohortsJson = await cohortsRes.json();
      const all: Cohort[] = (cohortsJson.cohorts || []).filter((c: Cohort) => {
        const abbr = c.program?.abbreviation?.toUpperCase() || '';
        return abbr === 'PM' || abbr === 'PMD';
      });
      setCohorts(all);

      // 2. Pull internships for each cohort in parallel. We need this to
      //    render phase breakdowns + alert indicators on the cards.
      const perCohort = await Promise.all(
        all.map(async (c) => {
          try {
            const r = await fetch(
              `/api/clinical/internships?cohortId=${c.id}`
            );
            const j = await r.json();
            const list: InternshipSummary[] = j?.success ? j.internships : [];
            return [c.id, list] as [string, InternshipSummary[]];
          } catch {
            return [c.id, [] as InternshipSummary[]] as [string, InternshipSummary[]];
          }
        })
      );
      const map: Record<string, InternshipSummary[]> = {};
      for (const [id, list] of perCohort) map[id] = list;
      setInternshipsByCohort(map);
    } catch {
      setError('Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Derive card stats ───────────────────────────────────────────────────

  const cohortStats: CohortWithStats[] = useMemo(() => {
    return cohorts.map((c) => {
      const list = internshipsByCohort[c.id] || [];
      const byPhase: Record<string, number> = {};
      let notLicensed = 0;
      let meetingsPending = 0;
      for (const i of list) {
        const p = i.current_phase || 'pre_internship';
        byPhase[p] = (byPhase[p] || 0) + 1;
        if (!i.provisional_license_obtained) notLicensed++;
        // Meeting is pending if the expected stage has been reached
        // (current or past) but no scheduled date is set. Using phase
        // position as a proxy for whether the meeting "should" be scheduled.
        if (
          (i.current_phase === 'phase_1_mentorship' ||
            i.current_phase === 'phase_2_evaluation' ||
            i.current_phase === 'extended' ||
            i.current_phase === 'completed') &&
          !i.phase_1_meeting_scheduled
        ) {
          meetingsPending++;
        } else if (
          (i.current_phase === 'phase_2_evaluation' ||
            i.current_phase === 'extended' ||
            i.current_phase === 'completed') &&
          !i.phase_2_meeting_scheduled
        ) {
          meetingsPending++;
        } else if (i.current_phase === 'completed' && !i.final_exam_scheduled) {
          meetingsPending++;
        }
      }
      return {
        ...c,
        internships: list,
        total: list.length,
        byPhase,
        notLicensed,
        meetingsPending,
      };
    });
  }, [cohorts, internshipsByCohort]);

  // Partition cohorts by status.
  // Active: is_active && !is_archived. Most internship activity lives here.
  // Recently completed: archived in the last ~6 months. Still useful for
  // reference when reviewing a just-finished cohort.
  // Fully archived: older than 6 months — hidden unless user jumps to
  // /academics/cohorts or the all-table view.
  const partitioned = useMemo(() => {
    const active: CohortWithStats[] = [];
    const recent: CohortWithStats[] = [];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    for (const c of cohortStats) {
      if (c.is_active && !c.is_archived) {
        active.push(c);
      } else if (c.is_archived) {
        const endDate = c.expected_end_date
          ? new Date(c.expected_end_date)
          : null;
        if (endDate && endDate >= sixMonthsAgo) {
          recent.push(c);
        }
        // else: older, hidden
      }
    }
    // Active first, sort by semester descending (most advanced first).
    active.sort((a, b) => {
      const as = a.current_semester ?? 0;
      const bs = b.current_semester ?? 0;
      return bs - as;
    });
    recent.sort((a, b) => {
      const an = typeof a.cohort_number === 'number'
        ? a.cohort_number
        : parseFloat(String(a.cohort_number)) || 0;
      const bn = typeof b.cohort_number === 'number'
        ? b.cohort_number
        : parseFloat(String(b.cohort_number)) || 0;
      return bn - an;
    });
    return { active, recent };
  }, [cohortStats]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/clinical"
                className="flex items-center gap-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 flex-shrink-0"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Clinical</span>
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Internship Tracker
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a Paramedic cohort
                </p>
              </div>
            </div>
            <Link
              href="/clinical/internships/all"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              title="Legacy filtered-table view across all cohorts"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Table view</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && partitioned.active.length === 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-12">
            Loading cohorts…
          </div>
        )}

        {/* Active cohorts */}
        {!loading && partitioned.active.length === 0 && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Briefcase className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400">
              No active Paramedic cohorts found.
            </p>
          </div>
        )}

        {partitioned.active.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3">
              Active
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partitioned.active.map((c) => (
                <CohortCard key={c.id} cohort={c} />
              ))}
            </div>
          </section>
        )}

        {/* Recently completed — collapsed by default */}
        {partitioned.recent.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowRecent((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3 hover:text-gray-900 dark:hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Recently completed ({partitioned.recent.length})
              </span>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  showRecent ? 'rotate-90' : ''
                }`}
              />
            </button>
            {showRecent && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-80">
                {partitioned.recent.map((c) => (
                  <CohortCard key={c.id} cohort={c} muted />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// ─── Cohort Card subcomponent ──────────────────────────────────────────────

function CohortCard({
  cohort,
  muted = false,
}: {
  cohort: CohortWithStats;
  muted?: boolean;
}) {
  const cohortLabel = `${cohort.program?.abbreviation || 'PM'} Group ${formatCohortNumber(cohort.cohort_number)}`;
  const sem = cohort.current_semester;
  const isSemester4 = sem === 4;
  const showLicenseAlert = isSemester4 && cohort.notLicensed > 0;

  const phases: Array<[string, string, number]> = [
    ['Pre-Intern', 'pre_internship', cohort.byPhase['pre_internship'] || 0],
    ['Phase 1', 'phase_1_mentorship', cohort.byPhase['phase_1_mentorship'] || 0],
    ['Phase 2', 'phase_2_evaluation', cohort.byPhase['phase_2_evaluation'] || 0],
    ['Extended', 'extended', cohort.byPhase['extended'] || 0],
    ['Completed', 'completed', cohort.byPhase['completed'] || 0],
  ];

  return (
    <Link
      href={`/clinical/internships/cohort/${cohort.id}`}
      className={`block bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow p-5 group ${
        muted ? 'hover:opacity-100' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {cohortLabel}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            {sem != null && (
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                Semester {sem}
              </span>
            )}
            {cohort.is_archived && (
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                Archived
              </span>
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {cohort.total} student{cohort.total === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
      </div>

      {/* Phase breakdown */}
      <div className="grid grid-cols-5 gap-1 mb-3 text-center">
        {phases.map(([label, , count]) => (
          <div
            key={label}
            className="bg-gray-50 dark:bg-gray-700/40 rounded px-1 py-1.5"
          >
            <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
              {count}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase truncate">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Alert indicators — only render when action needed */}
      {(showLicenseAlert || cohort.meetingsPending > 0) && (
        <div className="flex flex-wrap gap-2">
          {showLicenseAlert && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-3 h-3" />
              {cohort.notLicensed}/{cohort.total} not yet licensed
            </span>
          )}
          {cohort.meetingsPending > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Clock className="w-3 h-3" />
              {cohort.meetingsPending} meeting
              {cohort.meetingsPending === 1 ? '' : 's'} pending
            </span>
          )}
        </div>
      )}

      {!showLicenseAlert && cohort.meetingsPending === 0 && !muted && (
        <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
          <ClipboardList className="w-3 h-3" />
          No outstanding actions
        </div>
      )}
    </Link>
  );
}
