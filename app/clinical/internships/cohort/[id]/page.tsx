'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Users,
  Briefcase,
  CheckCircle2,
  Circle,
  Calendar,
  ClipboardList,
  AlertTriangle,
  ExternalLink,
  ClipboardCheck,
} from 'lucide-react';
import { formatCohortNumber } from '@/lib/format-cohort';

/**
 * PM Internship Cohort Hub.
 *
 * Landing page after selecting a cohort on /clinical/internships.
 * Replaces the cross-cohort filtered table with a cohort-scoped view
 * organized around three workflows:
 *   A. Provisional License Tracker (Semester 4 only, auto-hides at 100%)
 *   B. Phase Overview with per-phase student lists
 *   C. Meeting Status (Phase 1 Eval, Phase 2 Eval, Final Exam)
 *
 * A student extended beyond their cohort's normal end stays on this
 * page (not moved to a newer cohort) because their internship record's
 * cohort_id is still the original cohort.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = 'pre_internship' | 'phase_1_mentorship' | 'phase_2_evaluation' | 'extended' | 'completed';

interface Internship {
  id: string;
  student_id: string;
  cohort_id: string;
  current_phase: Phase | string;
  status: string;
  provisional_license_obtained: boolean | null;
  provisional_license_date: string | null;
  phase_1_start_date: string | null;
  phase_2_start_date: string | null;
  extension_date: string | null;
  // Meeting schedule dates (drive "scheduled?" counts + Next Step display)
  pre_internship_meeting_scheduled: string | null;
  pre_internship_meeting_completed: boolean | null;
  phase_1_meeting_scheduled: string | null;
  phase_2_meeting_scheduled: string | null;
  final_exam_scheduled: string | null;
  // Canonical eval scheduling + completion (pre-existing columns)
  phase_1_eval_scheduled: string | null;
  phase_1_eval_completed: boolean | null;
  phase_2_eval_scheduled: string | null;
  phase_2_eval_completed: boolean | null;
  extension_eval_date: string | null;
  extension_eval_completed: boolean | null;
  shift_type: string | null;
  preceptor_id: string | null;
  agency_id: string | null;
  agency_name: string | null;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  field_preceptors: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  agencies: {
    id: string;
    name: string;
    abbreviation: string | null;
  } | null;
}

interface CohortInfo {
  id: string;
  cohort_number: number | string;
  current_semester: number | null;
  start_date: string | null;
  expected_end_date: string | null;
  program: { abbreviation: string; name: string } | null;
}

// ─── Phase metadata ─────────────────────────────────────────────────────────

const PHASE_ORDER: Phase[] = [
  'pre_internship',
  'phase_1_mentorship',
  'phase_2_evaluation',
  'extended',
  'completed',
];

const PHASE_META: Record<string, { label: string; classes: string; chip: string }> = {
  pre_internship: {
    label: 'Pre-Internship',
    classes: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    chip: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  },
  phase_1_mentorship: {
    label: 'Phase 1',
    classes: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  phase_2_evaluation: {
    label: 'Phase 2',
    classes: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  },
  extended: {
    label: 'Extended',
    classes: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    chip: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Short date: "May 3" if the year matches today, otherwise "May 3, 2025".
 */
function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T12:00:00');
    const thisYear = new Date().getFullYear();
    if (d.getFullYear() === thisYear) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type NextStepTone = 'blocked' | 'action' | 'pending' | 'ready' | 'done';

interface NextStep {
  label: string;
  tone: NextStepTone;
  /** Where to send the user. If omitted the step renders as informational text. */
  href?: string;
}

const NEXT_STEP_CLASSES: Record<NextStepTone, string> = {
  blocked:
    'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  action:
    'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  pending:
    'text-yellow-800 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800',
  ready:
    'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  done:
    'text-emerald-700 dark:text-emerald-300',
};

/**
 * Compute the single "Next Step" for a student, derived from the sequential
 * gate-by-gate logic described in the product spec. Returning the *first*
 * unmet gate gives users a direct "what do I do now?" answer in the table.
 *
 * For meeting links: there's no internal scheduler route yet beyond
 * /scheduling/polls/create. We link those action items to the student's
 * internship file where the MeetingRow UI (added in Part 2.4) provides
 * the Create Meeting button + paste-link flow.
 *
 * TODO: once a dedicated meeting-scheduler page exists, swap href to that.
 */
function computeNextStep(i: Internship, cohortId: string): NextStep {
  const internshipHref = `/clinical/internships/${i.id}?cohortId=${cohortId}`;
  const phase = (i.current_phase || 'pre_internship') as Phase;

  // COMPLETED: no further action.
  if (phase === 'completed') {
    return { label: '', tone: 'done' };
  }

  // EXTENDED: eval-scheduled → eval-completed → complete internship.
  if (phase === 'extended') {
    if (!i.extension_eval_date) {
      return { label: 'Schedule extension eval', tone: 'action', href: internshipHref };
    }
    if (!i.extension_eval_completed) {
      return {
        label: `Extension eval — ${formatShortDate(i.extension_eval_date)}`,
        tone: 'pending',
        href: internshipHref,
      };
    }
    return { label: 'Complete internship', tone: 'action', href: internshipHref };
  }

  // PHASE 2: schedule eval → run eval → advance/extend decision → ready.
  if (phase === 'phase_2_evaluation') {
    if (!i.phase_2_eval_scheduled) {
      return { label: 'Schedule Phase 2 eval', tone: 'action', href: internshipHref };
    }
    if (!i.phase_2_eval_completed) {
      return {
        label: `Phase 2 eval — ${formatShortDate(i.phase_2_eval_scheduled)}`,
        tone: 'pending',
        href: internshipHref,
      };
    }
    // Eval done but student hasn't moved to completed/extended yet.
    return { label: 'Complete or extend?', tone: 'action', href: internshipHref };
  }

  // PHASE 1: schedule eval → run eval → advance/extend decision → ready.
  if (phase === 'phase_1_mentorship') {
    if (!i.phase_1_eval_scheduled) {
      return { label: 'Schedule Phase 1 eval', tone: 'action', href: internshipHref };
    }
    if (!i.phase_1_eval_completed) {
      return {
        label: `Phase 1 eval — ${formatShortDate(i.phase_1_eval_scheduled)}`,
        tone: 'pending',
        href: internshipHref,
      };
    }
    return { label: 'Advance or extend?', tone: 'action', href: internshipHref };
  }

  // PRE-INTERNSHIP: license → placement → meeting scheduled → meeting done → ready.
  if (!i.provisional_license_obtained) {
    return { label: 'Get provisional license', tone: 'blocked' };
  }
  if (!i.agency_id || !i.preceptor_id) {
    return { label: 'Confirm placement', tone: 'blocked', href: internshipHref };
  }
  if (!i.pre_internship_meeting_scheduled) {
    return { label: 'Schedule pre-internship meeting', tone: 'action', href: internshipHref };
  }
  if (!i.pre_internship_meeting_completed) {
    return {
      label: `Pre-internship meeting — ${formatShortDate(i.pre_internship_meeting_scheduled)}`,
      tone: 'pending',
      href: internshipHref,
    };
  }
  return { label: 'Ready to start Phase 1', tone: 'ready' };
}

function phaseStartDate(i: Internship): string | null {
  switch (i.current_phase) {
    case 'pre_internship':
      return null;
    case 'phase_1_mentorship':
      return i.phase_1_start_date;
    case 'phase_2_evaluation':
      return i.phase_2_start_date;
    case 'extended':
      return i.extension_date ?? i.phase_2_start_date ?? i.phase_1_start_date;
    case 'completed':
      return i.phase_2_start_date ?? i.phase_1_start_date;
    default:
      return null;
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PmInternshipCohortHub() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params?.id as string;

  const [cohort, setCohort] = useState<CohortInfo | null>(null);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<Phase | 'all'>('all');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  const fetchAll = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    setError(null);
    try {
      const [cohortRes, internshipsRes] = await Promise.all([
        fetch(`/api/lab-management/cohorts/${cohortId}`),
        fetch(`/api/clinical/internships?cohortId=${cohortId}`),
      ]);
      const cohortJson = await cohortRes.json();
      const intJson = await internshipsRes.json();
      if (cohortJson?.cohort || cohortJson?.id) {
        setCohort(cohortJson.cohort || cohortJson);
      }
      if (intJson?.success) {
        setInternships(intJson.internships || []);
      } else {
        setError(intJson?.error || 'Failed to load internships');
      }
    } catch {
      setError('Failed to load cohort internships');
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of internships) {
      const p = i.current_phase || 'pre_internship';
      counts[p] = (counts[p] || 0) + 1;
    }
    return counts;
  }, [internships]);

  const filteredInternships = useMemo(() => {
    if (selectedPhase === 'all') return internships;
    return internships.filter((i) => i.current_phase === selectedPhase);
  }, [internships, selectedPhase]);

  const isSemester4 = cohort?.current_semester === 4;

  // Provisional license tracker visibility: only on Sem 4 AND at least one
  // student still not licensed. Auto-hides once 100% are licensed.
  const licenseStats = useMemo(() => {
    const total = internships.length;
    const licensed = internships.filter((i) => i.provisional_license_obtained === true).length;
    return { total, licensed, missing: total - licensed };
  }, [internships]);

  const showLicenseTracker = isSemester4 && licenseStats.missing > 0;

  // Meeting stats for Section C.
  const meetingStats = useMemo(() => {
    const total = internships.length;
    const count = (key: keyof Internship) => {
      let scheduled = 0;
      for (const i of internships) {
        if (i[key]) scheduled++;
      }
      return { scheduled, total };
    };
    return {
      preInternship: count('pre_internship_meeting_scheduled'),
      phase1: count('phase_1_meeting_scheduled'),
      phase2: count('phase_2_meeting_scheduled'),
      final: count('final_exam_scheduled'),
    };
  }, [internships]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const cohortLabel = cohort
    ? `${cohort.program?.abbreviation || 'PM'} Group ${formatCohortNumber(cohort.cohort_number)}`
    : 'Cohort';

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/clinical/internships"
              className="flex items-center gap-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">All cohorts</span>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Internship Tracker — {cohortLabel}
              </h1>
              {cohort?.current_semester != null && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Semester {cohort.current_semester}
                  {internships.length > 0 &&
                    ` · ${internships.length} student${internships.length === 1 ? '' : 's'}`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/*
          Layout: on mobile the three sections stack as before
          (A → B → C). On lg+ Section B (the phase-overview table)
          takes the left main column, and Sections A + C sit in a
          ~340px right rail. Explicit grid placement preserves mobile
          DOM order; space-y-6 collapses into gap-6 when the grid
          kicks in.
        */}
        <div
          className={
            `space-y-6 lg:space-y-0 lg:grid lg:gap-6 ` +
            (showLicenseTracker
              ? 'lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_auto]'
              : 'lg:grid-cols-[minmax(0,1fr)_340px]')
          }
        >

        {/* ─── Section A: Provisional License Tracker ─────────────────── */}
        {showLicenseTracker && (
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 lg:col-start-2 lg:row-start-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Provisional License
              </h2>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {licenseStats.licensed} of {licenseStats.total} licensed
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: `${licenseStats.total > 0 ? (licenseStats.licensed / licenseStats.total) * 100 : 0}%`,
                }}
              />
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {internships.map((i) => {
                const name = i.students
                  ? `${i.students.last_name}, ${i.students.first_name}`
                  : '(unknown student)';
                const isLicensed = !!i.provisional_license_obtained;
                return (
                  <li
                    key={i.id}
                    className="py-2 flex items-center gap-3 text-sm"
                  >
                    {isLicensed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <Link
                      href={`/clinical/internships/${i.id}?cohortId=${cohortId}`}
                      className="flex-1 text-gray-900 dark:text-white hover:underline min-w-0 truncate"
                    >
                      {name}
                    </Link>
                    <span className="text-gray-500 dark:text-gray-400 text-xs flex-shrink-0">
                      {isLicensed
                        ? formatDate(i.provisional_license_date)
                        : 'Not yet'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ─── Section B: Phase Overview ──────────────────────────────── */}
        <section
          className={
            'bg-white dark:bg-gray-800 rounded-lg shadow p-5 lg:col-start-1 ' +
            (showLicenseTracker ? 'lg:row-start-1 lg:row-span-2' : 'lg:row-start-1')
          }
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Phase Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
            <button
              type="button"
              onClick={() => setSelectedPhase('all')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedPhase === 'all'
                  ? 'bg-teal-50 border-teal-300 dark:bg-teal-900/30 dark:border-teal-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {internships.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">
                All
              </div>
            </button>
            {PHASE_ORDER.map((phase) => {
              const meta = PHASE_META[phase];
              const count = phaseCounts[phase] || 0;
              const active = selectedPhase === phase;
              return (
                <button
                  key={phase}
                  type="button"
                  onClick={() => setSelectedPhase(phase)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    active
                      ? 'ring-2 ring-teal-400 dark:ring-teal-600 ' + meta.classes
                      : meta.classes + ' hover:opacity-80'
                  }`}
                >
                  <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {count}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 uppercase font-semibold">
                    {meta.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Student list under the selected phase */}
          {filteredInternships.length === 0 ? (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
              No students in this phase.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase">
                      Student
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase">
                      Phase
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase hidden sm:table-cell">
                      Phase started
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase hidden md:table-cell">
                      FTO
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase hidden md:table-cell">
                      Agency
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase hidden md:table-cell">
                      Next step
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredInternships.map((i) => {
                    const name = i.students
                      ? `${i.students.last_name}, ${i.students.first_name}`
                      : '(unknown)';
                    const phaseMeta =
                      PHASE_META[i.current_phase as string] ||
                      PHASE_META.pre_internship;
                    const nextStep = computeNextStep(i, cohortId);
                    const agencyLabel =
                      i.agencies?.abbreviation ||
                      i.agencies?.name ||
                      i.agency_name ||
                      null;
                    return (
                      <tr
                        key={i.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={`/clinical/internships/${i.id}?cohortId=${cohortId}`}
                            className="text-teal-700 dark:text-teal-300 hover:underline font-medium"
                          >
                            {name}
                          </Link>
                          {/* Mobile-only subtitle: agency + next step
                              (these columns are hidden < md). */}
                          <div className="md:hidden mt-1 flex flex-col gap-1">
                            {agencyLabel && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {agencyLabel}
                              </div>
                            )}
                            <div>
                              <NextStepCell step={nextStep} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${phaseMeta.chip}`}
                          >
                            {phaseMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap hidden sm:table-cell">
                          {formatDate(phaseStartDate(i))}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 hidden md:table-cell">
                          {i.field_preceptors
                            ? `${i.field_preceptors.first_name} ${i.field_preceptors.last_name}`
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 hidden md:table-cell">
                          {agencyLabel || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <NextStepCell step={nextStep} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ─── Section C: Meeting Status ──────────────────────────────── */}
        <section
          className={
            'bg-white dark:bg-gray-800 rounded-lg shadow p-5 lg:col-start-2 ' +
            (showLicenseTracker ? 'lg:row-start-2' : 'lg:row-start-1')
          }
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Meeting Status
          </h2>
          {/* In the right sidebar the 4-tile grid becomes a 2×2 on lg
              (narrow column). Mobile / md keep the existing responsive
              breakpoints. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:grid-cols-2">
            <MeetingCard
              title="Pre-Internship Agency"
              scheduled={meetingStats.preInternship.scheduled}
              total={meetingStats.preInternship.total}
              onShowUnscheduled={() => setSelectedPhase('pre_internship')}
            />
            <MeetingCard
              title="Phase 1 Evaluation"
              scheduled={meetingStats.phase1.scheduled}
              total={meetingStats.phase1.total}
              onShowUnscheduled={() =>
                setSelectedPhase('phase_1_mentorship')
              }
            />
            <MeetingCard
              title="Phase 2 Evaluation"
              scheduled={meetingStats.phase2.scheduled}
              total={meetingStats.phase2.total}
              onShowUnscheduled={() =>
                setSelectedPhase('phase_2_evaluation')
              }
            />
            <MeetingCard
              title="Final Exam"
              scheduled={meetingStats.final.scheduled}
              total={meetingStats.final.total}
              onShowUnscheduled={() => setSelectedPhase('completed')}
            />
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Click a student above to set individual meeting dates / links.
          </p>
        </section>

        </div>
        {/* /end sidebar layout wrapper */}

        {loading && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            Loading…
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Next-step cell ─────────────────────────────────────────────────────────

function NextStepCell({ step }: { step: NextStep }) {
  // Completed students: quiet green check, no action.
  if (step.tone === 'done') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-label="Completed" />;
  }

  const classes = NEXT_STEP_CLASSES[step.tone];

  // "Ready" rows: informational pill, no arrow, no link.
  if (step.tone === 'ready') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium rounded-full border px-2 py-0.5 ${classes}`}
      >
        <CheckCircle2 className="w-3 h-3" /> {step.label}
      </span>
    );
  }

  const body = (
    <span className="inline-flex items-center gap-1">
      {step.label}
      {step.href && <ExternalLink className="w-3 h-3 opacity-60" />}
    </span>
  );

  if (step.href) {
    return (
      <Link
        href={step.href}
        className={`inline-flex items-center text-xs font-medium rounded border px-2 py-1 hover:opacity-80 underline-offset-2 ${classes}`}
      >
        {body}
      </Link>
    );
  }

  // Non-linked action (e.g. "Get provisional license"): read-only badge.
  return (
    <span
      className={`inline-flex items-center text-xs font-medium rounded border px-2 py-1 ${classes}`}
    >
      {body}
    </span>
  );
}

// ─── Meeting card subcomponent ──────────────────────────────────────────────

function MeetingCard({
  title,
  scheduled,
  total,
  onShowUnscheduled,
}: {
  title: string;
  scheduled: number;
  total: number;
  onShowUnscheduled: () => void;
}) {
  const missing = total - scheduled;
  const allDone = missing === 0 && total > 0;
  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {title}
        </span>
        {allDone ? (
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
        ) : missing > 0 ? (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        ) : (
          <ClipboardList className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
        {scheduled}
        <span className="text-gray-400 text-base font-medium">/{total}</span>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        scheduled
      </div>
      {missing > 0 && (
        <button
          type="button"
          onClick={onShowUnscheduled}
          className="mt-2 text-xs text-teal-700 dark:text-teal-300 hover:underline inline-flex items-center gap-1"
        >
          {missing} pending
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
