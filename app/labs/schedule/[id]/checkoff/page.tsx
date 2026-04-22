'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Intubation Checkoff Day — Coordinator Mobile View (Parts 3 + 4 MVP).
 *
 * Optimized for Ryan moving between stations on his phone.
 *
 * Two sections:
 *   A. Station assignments (quick reference, collapsible).
 *      MVP shows station name/room/instructor — per-student assignments
 *      come with Part 2 (drag-and-drop).
 *   B. Checkoff tracker — combined status across both checkoff stations
 *      for one skill (intubation). Tap a student to toggle
 *      Complete / Retake / Reset. 5s poll keeps coordinator + examiners
 *      in sync.
 */

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Circle,
  ClipboardCheck,
  MapPin,
  ChevronDown,
  ChevronRight,
  Users,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type CheckoffStatus = 'not_started' | 'complete' | 'retake_needed';

interface RosterEntry {
  student_id: string;
  first_name: string;
  last_name: string;
  lab_group: { id: string; name: string } | null;
  status: CheckoffStatus;
  marked_at: string | null;
  station_id: string | null;
}

interface StationEntry {
  id: string;
  station_number: number | null;
  title: string | null;
  room: string | null;
  instructor_name: string | null;
  skill_sheet_id: string | null;
  is_checkoff: boolean;
}

interface Payload {
  success: true;
  lab_day: {
    id: string;
    date: string;
    title: string | null;
    cohort: { cohort_number: string | number; program: { abbreviation: string } } | null;
  };
  stations: StationEntry[];
  checkoff: {
    skill_sheet_id: string;
    skill_name: string | null;
    station_ids: string[];
  } | null;
  roster: RosterEntry[];
  progress: { complete: number; total: number };
}

// Station assignments payload (loaded in parallel; drives the "at Station 2 —
// Ambulance Org" subtitle under each roster row and the per-station panel
// in Section A).
interface AssignmentStation {
  id: string;
  station_number: number | null;
  title: string | null;
  room: string | null;
  instructor_name: string | null;
  is_checkoff: boolean;
  students: {
    student_id: string;
    first_name: string;
    last_name: string;
    lab_group: { id: string; name: string } | null;
  }[];
}
interface AssignmentsPayload {
  success: true;
  stations: AssignmentStation[];
  unassigned: {
    student_id: string;
    first_name: string;
    last_name: string;
    lab_group: { id: string; name: string } | null;
  }[];
}

// ─── Lab group colors (A=blue, B=green, C=orange) ──────────────────────────
const GROUP_COLORS: Record<string, string> = {
  A: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  B: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  C: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  D: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
};

function groupChipClasses(name: string | null): string {
  if (!name) return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  const letter = name.replace(/[^A-Z]/gi, '').toUpperCase().slice(-1);
  return GROUP_COLORS[letter] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function CheckoffCoordinatorPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params?.id as string;

  const [data, setData] = useState<Payload | null>(null);
  const [assignments, setAssignments] = useState<AssignmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // student_id being toggled
  const [stationsOpen, setStationsOpen] = useState(false);
  const [expandedStation, setExpandedStation] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Redirect unauth
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  // Fetch both the checkoff status and the station assignments in parallel
  // so the roster subtitle + Section A panel stay in sync.
  const fetchData = useCallback(async () => {
    if (!labDayId) return;
    try {
      const [statusRes, assignRes] = await Promise.all([
        fetch(`/api/lab-management/lab-days/${labDayId}/checkoff-status`),
        fetch(`/api/lab-management/lab-days/${labDayId}/station-assignments`),
      ]);
      const json = (await statusRes.json()) as
        | Payload
        | { success: false; error: string };
      if (!('success' in json) || !json.success) {
        setError((json as any).error || 'Failed to load checkoff status');
        return;
      }
      setData(json);
      try {
        const aj = (await assignRes.json()) as
          | AssignmentsPayload
          | { success: false; error: string };
        if ('success' in aj && aj.success) setAssignments(aj);
      } catch {
        // Assignment fetch is best-effort — roster still works without it.
      }
      setError(null);
      setLastSync(new Date());
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [labDayId]);

  useEffect(() => {
    fetchData();
    // 5s poll for coordinator ↔ examiner sync. Only polls when tab visible
    // to avoid Vercel function spam when phone screen is off.
    const int = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 5000);
    return () => clearInterval(int);
  }, [fetchData]);

  // Toggle one student.
  const toggle = useCallback(
    async (student: RosterEntry, action: 'complete' | 'retake' | 'reset') => {
      if (!data?.checkoff) return;
      setPending(student.student_id);

      // Optimistic update.
      const nextStatus: CheckoffStatus =
        action === 'complete'
          ? 'complete'
          : action === 'retake'
          ? 'retake_needed'
          : 'not_started';
      setData((prev) =>
        prev
          ? {
              ...prev,
              roster: prev.roster.map((r) =>
                r.student_id === student.student_id
                  ? { ...r, status: nextStatus }
                  : r
              ),
              progress: {
                ...prev.progress,
                complete: prev.roster.filter((r) =>
                  r.student_id === student.student_id
                    ? nextStatus === 'complete'
                    : r.status === 'complete'
                ).length,
              },
            }
          : prev
      );

      try {
        const r = await fetch(
          `/api/lab-management/lab-days/${labDayId}/checkoff-status`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: student.student_id,
              action,
              skill_sheet_id: data.checkoff.skill_sheet_id,
            }),
          }
        );
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || 'Save failed');
        }
        // Refresh for authoritative counters.
        await fetchData();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
        // Re-sync to discard the optimistic update.
        await fetchData();
      } finally {
        setPending(null);
      }
    },
    [data, labDayId, fetchData]
  );

  // ─── Render helpers ──────────────────────────────────────────────────────
  const cohortLabel = useMemo(() => {
    const c = data?.lab_day.cohort;
    if (!c) return '';
    return `${c.program?.abbreviation || ''} ${c.cohort_number}`.trim();
  }, [data]);

  const orgStations = useMemo(
    () => (data?.stations ?? []).filter((s) => !s.is_checkoff),
    [data]
  );

  // Pre-compute student_id → station label. Powers the subtitle under each
  // roster row ("Group 2 · Station 2 — Ambulance Org"). Falls back to just
  // the lab-group chip when a student isn't yet assigned.
  const stationLabelByStudent = useMemo(() => {
    const map = new Map<string, { station_number: number | null; title: string | null }>();
    for (const s of assignments?.stations ?? []) {
      if (s.is_checkoff) continue;
      for (const stu of s.students) {
        map.set(stu.student_id, {
          station_number: s.station_number,
          title: s.title,
        });
      }
    }
    return map;
  }, [assignments]);

  // Section-A panel source: the assignments payload's non-checkoff stations
  // (sorted by station_number). If assignments haven't loaded yet we fall
  // back to the checkoff-status payload so the basic reference list still
  // renders.
  const panelStations = useMemo(() => {
    if (assignments?.stations?.length) {
      return [...assignments.stations].sort(
        (a, b) => (a.station_number ?? 999) - (b.station_number ?? 999)
      );
    }
    return (data?.stations ?? []).map((s) => ({
      id: s.id,
      station_number: s.station_number,
      title: s.title,
      room: s.room,
      instructor_name: s.instructor_name,
      is_checkoff: s.is_checkoff,
      students: [] as AssignmentStation['students'],
    }));
  }, [assignments, data]);

  const assignedCount = useMemo(
    () =>
      (assignments?.stations ?? [])
        .filter((s) => !s.is_checkoff)
        .reduce((acc, s) => acc + s.students.length, 0),
    [assignments]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Loading checkoff view…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 text-center">
            {error || 'Could not load lab day'}
          </p>
          <div className="mt-4 text-center">
            <Link
              href={`/labs/schedule/${labDayId}`}
              className="text-teal-600 hover:underline text-sm"
            >
              Back to lab day
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { checkoff, roster, progress } = data;
  const pct = progress.total > 0
    ? Math.round((progress.complete / progress.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800 pb-24">
      {/* ─── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-3 py-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/labs/schedule/${labDayId}`}
              className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                {checkoff?.skill_name || 'Checkoff'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {cohortLabel && `${cohortLabel} · `}
                {new Date(data.lab_day.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">
                {progress.complete}
                <span className="text-gray-400 font-normal">/{progress.total}</span>
              </div>
              <div className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                complete
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {!checkoff && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">No checkoff skill detected</p>
            <p className="text-xs">
              This view expects two or more stations running the same skill, or
              a pinned checkoff skill on the lab day. Set this up via the
              station builder (or wait for Part 1 to formalize the setup).
            </p>
          </div>
        )}

        {/* ─── Section A: Station assignments (collapsible per station) ─── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <button
            type="button"
            onClick={() => setStationsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
              <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Station assignments
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                ({orgStations.length} org + {data.stations.length - orgStations.length} checkoff
                {assignments ? ` · ${assignedCount} assigned` : ''})
              </span>
            </span>
            {stationsOpen ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {stationsOpen && (
            <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {panelStations.length === 0 && (
                <div className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
                  No stations on this lab day.
                </div>
              )}
              {panelStations.map((s) => {
                const isOpen = expandedStation === s.id;
                const hasStudents = s.students.length > 0;
                return (
                  <div key={s.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStation((cur) => (cur === s.id ? null : s.id))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                          {s.station_number != null && (
                            <span className="inline-flex w-6 h-6 items-center justify-center bg-gray-100 dark:bg-gray-700 text-xs rounded font-semibold">
                              {s.station_number}
                            </span>
                          )}
                          <span className="truncate">{s.title || 'Station'}</span>
                          {s.is_checkoff && (
                            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                              Checkoff
                            </span>
                          )}
                          {!s.is_checkoff && hasStudents && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                              {s.students.length}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {[s.room, s.instructor_name].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      {!s.is_checkoff && (
                        <span className="ml-2 flex-shrink-0 text-gray-400">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </span>
                      )}
                    </button>
                    {isOpen && !s.is_checkoff && (
                      <div className="px-4 pb-3 pt-1">
                        {hasStudents ? (
                          <ul className="text-sm space-y-1">
                            {s.students.map((stu) => (
                              <li
                                key={stu.student_id}
                                className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
                              >
                                <span className="text-gray-400">•</span>
                                <span className="flex-1">
                                  {stu.last_name}, {stu.first_name}
                                </span>
                                {stu.lab_group && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${groupChipClasses(
                                      stu.lab_group.name
                                    )}`}
                                  >
                                    {stu.lab_group.name}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs italic text-gray-400 dark:text-gray-500">
                            No students assigned to this station yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="px-4 py-3 text-[11px] text-gray-400 dark:text-gray-500 italic">
                Assign students from the{' '}
                <Link
                  href={`/labs/schedule/${labDayId}/assignments`}
                  className="underline hover:text-gray-600 dark:hover:text-gray-300"
                >
                  setup view
                </Link>
                . Checkoff stations (students rotate through) have no pre-assignments.
              </div>
            </div>
          )}
        </section>

        {/* ─── Section B: Checkoff tracker ──────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
              <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Roster
            </div>
            {lastSync && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                synced {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {roster.length === 0 ? (
            <div className="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400">
              No students enrolled in this cohort.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {roster.map((r) => (
                <StudentRow
                  key={r.student_id}
                  entry={r}
                  stationLabel={stationLabelByStudent.get(r.student_id) ?? null}
                  pending={pending === r.student_id}
                  disabled={!checkoff}
                  onComplete={() => toggle(r, 'complete')}
                  onRetake={() => toggle(r, 'retake')}
                  onReset={() => toggle(r, 'reset')}
                />
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 italic">
          Tap a student to mark complete · long-press to mark retake needed
        </p>
      </main>
    </div>
  );
}

// ─── StudentRow ────────────────────────────────────────────────────────────
function StudentRow({
  entry,
  stationLabel,
  pending,
  disabled,
  onComplete,
  onRetake,
  onReset,
}: {
  entry: RosterEntry;
  stationLabel: { station_number: number | null; title: string | null } | null;
  pending: boolean;
  disabled: boolean;
  onComplete: () => void;
  onRetake: () => void;
  onReset: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);

  const status = entry.status;
  let icon: React.ReactNode;
  let rowBg = 'bg-white dark:bg-gray-800';
  if (status === 'complete') {
    icon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    rowBg = 'bg-emerald-50/60 dark:bg-emerald-900/10';
  } else if (status === 'retake_needed') {
    icon = <RotateCcw className="w-5 h-5 text-amber-500" />;
    rowBg = 'bg-amber-50/70 dark:bg-amber-900/10';
  } else {
    icon = <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />;
  }

  const primaryAction = () => {
    if (disabled) return;
    // Single tap cycles: not_started → complete; complete → open actions
    if (status === 'not_started') onComplete();
    else setActionsOpen((v) => !v);
  };

  return (
    <li className={`${rowBg} transition-colors`}>
      <button
        type="button"
        onClick={primaryAction}
        disabled={disabled || pending}
        className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
      >
        <span className="flex-shrink-0">
          {pending ? (
            <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
          ) : (
            icon
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-gray-900 dark:text-white truncate">
            {entry.last_name}, {entry.first_name}
          </span>
          <span className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {entry.lab_group && (
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${groupChipClasses(
                  entry.lab_group.name
                )}`}
              >
                {entry.lab_group.name}
              </span>
            )}
            {stationLabel && (
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <MapPin className="w-3 h-3" />
                {stationLabel.station_number != null && (
                  <>Station {stationLabel.station_number}</>
                )}
                {stationLabel.title && (
                  <span className="truncate max-w-[14ch] sm:max-w-none">
                    — {stationLabel.title}
                  </span>
                )}
              </span>
            )}
            {status === 'complete' && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Complete
              </span>
            )}
            {status === 'retake_needed' && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Retake needed
              </span>
            )}
            {status === 'not_started' && <span>Not yet</span>}
          </span>
        </span>
      </button>

      {actionsOpen && !disabled && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-700 pt-2">
          <button
            type="button"
            onClick={() => {
              setActionsOpen(false);
              onComplete();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Complete
          </button>
          <button
            type="button"
            onClick={() => {
              setActionsOpen(false);
              onRetake();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retake
          </button>
          <button
            type="button"
            onClick={() => {
              setActionsOpen(false);
              onReset();
            }}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Reset
          </button>
        </div>
      )}
    </li>
  );
}
