'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Coordinator Setup View — student → org-station pre-assignments.
 *
 * Part 2 of the Checkoff Day feature: Ryan (or another coordinator)
 * uses this page BEFORE the lab starts to decide which student stands
 * at which org station. During the lab the pre-assignments surface in
 * the checkoff view (/labs/schedule/[id]/checkoff) so Ryan can find
 * students when pulling them for intubation.
 *
 * MVP interaction: tap a student → pick a station from a list.
 * Drag-and-drop is deferred. Auto-assign button distributes evenly.
 */

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Users,
  MapPin,
  Shuffle,
  X,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Circle,
  RotateCcw,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────
interface StudentEntry {
  student_id: string;
  first_name: string;
  last_name: string;
  lab_group: { id: string; name: string } | null;
  assignment_id?: string;
}

interface StationEntry {
  id: string;
  station_number: number | null;
  title: string | null;
  room: string | null;
  instructor_name: string | null;
  is_checkoff: boolean;
  students: StudentEntry[];
}

interface Payload {
  success: true;
  stations: StationEntry[];
  unassigned: StudentEntry[];
}

// Supplementary payload from /checkoff-status — used for the print
// header (lab day title/date/cohort) and the printable intubation
// roster at the bottom. Fetched in parallel; print view degrades
// gracefully if this call fails.
type CheckoffStatus = 'not_started' | 'complete' | 'retake_needed';
interface CheckoffPayload {
  success: true;
  lab_day: {
    id: string;
    date: string;
    title: string | null;
    cohort: {
      cohort_number: string | number;
      program: { abbreviation: string } | null;
    } | null;
  };
  checkoff: {
    skill_sheet_id: string;
    skill_name: string | null;
  } | null;
  roster: Array<{
    student_id: string;
    first_name: string;
    last_name: string;
    lab_group: { id: string; name: string } | null;
    status: CheckoffStatus;
  }>;
  progress: { complete: number; total: number };
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
export default function StationAssignmentsPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params?.id as string;

  const [data, setData] = useState<Payload | null>(null);
  const [checkoff, setCheckoff] = useState<CheckoffPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<StudentEntry | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  const fetchData = useCallback(async () => {
    try {
      // Run the assignments + checkoff-status fetches in parallel. The
      // latter is what powers the print view's header (lab-day title,
      // date, cohort) and the bottom intubation roster block, so even
      // though the primary UI only needs the first call, we fire both.
      // If the checkoff fetch fails the assignment view still works;
      // print just shows a minimal header.
      const [r, cr] = await Promise.all([
        fetch(`/api/lab-management/lab-days/${labDayId}/station-assignments`),
        fetch(`/api/lab-management/lab-days/${labDayId}/checkoff-status`),
      ]);
      const j = await r.json();
      if (!j?.success) throw new Error(j?.error || 'Failed to load');
      setData(j);
      try {
        const cj = await cr.json();
        if (cj?.success) setCheckoff(cj as CheckoffPayload);
      } catch {
        /* non-fatal; print view will fall back */
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [labDayId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assign = useCallback(
    async (student: StudentEntry, stationId: string) => {
      setPending(student.student_id);
      try {
        const r = await fetch(
          `/api/lab-management/lab-days/${labDayId}/station-assignments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: student.student_id,
              station_id: stationId,
            }),
          }
        );
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.error || 'Failed');
        await fetchData();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Assign failed');
      } finally {
        setPending(null);
        setPickingFor(null);
      }
    },
    [labDayId, fetchData]
  );

  const unassign = useCallback(
    async (student: StudentEntry) => {
      setPending(student.student_id);
      try {
        const r = await fetch(
          `/api/lab-management/lab-days/${labDayId}/station-assignments?student_id=${student.student_id}`,
          { method: 'DELETE' }
        );
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.error || 'Failed');
        await fetchData();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unassign failed');
      } finally {
        setPending(null);
      }
    },
    [labDayId, fetchData]
  );

  const autoAssign = useCallback(async () => {
    const shouldReplace = confirm(
      'Replace existing assignments, or just fill in the unassigned students?\n\n' +
        'OK = only assign unassigned students\n' +
        'Cancel = wipe existing and redo from scratch'
    );
    setAutoBusy(true);
    try {
      const url = shouldReplace
        ? `/api/lab-management/lab-days/${labDayId}/station-assignments/auto`
        : `/api/lab-management/lab-days/${labDayId}/station-assignments/auto?replace=1`;
      const r = await fetch(url, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || 'Auto-assign failed');
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auto-assign failed');
    } finally {
      setAutoBusy(false);
    }
  }, [labDayId, fetchData]);

  // Only org stations are valid targets for assignment.
  const orgStations = useMemo(
    () => (data?.stations ?? []).filter((s) => !s.is_checkoff),
    [data]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300">{error || 'Could not load'}</p>
          <Link
            href={`/labs/schedule/${labDayId}`}
            className="inline-block mt-4 text-blue-600 hover:underline text-sm"
          >
            Back to lab day
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 pb-24 print:bg-white print:min-h-0 print:pb-0">
      {/* Print-only CSS — sets paper margins and encourages sensible
          page breaks between station cards. Scoped here rather than in
          globals.css because this is the only page with a custom
          print layout right now. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { margin: 0.5in; }
              html, body { background: #fff !important; }
              /* Avoid mid-card page breaks; already reinforced by
                 break-inside-avoid utility classes on each card. */
              .break-inside-avoid { page-break-inside: avoid; }
            }
          `,
        }}
      />
      {/* Header — hidden when printing so only the clean station cards go on paper. */}
      <div className="bg-white dark:bg-gray-800 shadow print:hidden">
        <div className="max-w-5xl mx-auto px-3 py-3 flex items-center gap-2">
          <Link
            href={`/labs/schedule/${labDayId}`}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              Assign students to stations
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pre-assignment for checkoff / equipment days. Checkoff stations excluded.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Print station assignments to post at each station"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={autoAssign}
            disabled={autoBusy}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
          >
            {autoBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Shuffle className="w-3.5 h-3.5" />
            )}
            Auto-assign
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-3 py-4 space-y-4 print:hidden">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Unassigned students */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-gray-900 dark:text-white">
              Unassigned
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({data.unassigned.length})
            </span>
          </div>
          {data.unassigned.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              All students assigned.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.unassigned.map((s) => (
                <RosterRow
                  key={s.student_id}
                  student={s}
                  pending={pending === s.student_id}
                  onPick={() => setPickingFor(s)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Org stations */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {orgStations.map((station) => (
            <div
              key={station.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow"
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  {station.station_number != null && (
                    <span className="inline-flex w-6 h-6 items-center justify-center bg-gray-100 dark:bg-gray-700 text-xs rounded font-semibold">
                      {station.station_number}
                    </span>
                  )}
                  <span className="truncate">{station.title || 'Station'}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {[station.room, station.instructor_name].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              {station.students.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-gray-400 italic">
                  No students assigned yet.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {station.students.map((s) => (
                    <li
                      key={s.student_id}
                      className="px-4 py-2 flex items-center gap-2 text-sm"
                    >
                      <span className="flex-1 text-gray-900 dark:text-white">
                        {s.last_name}, {s.first_name}
                      </span>
                      {s.lab_group && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${groupChipClasses(
                            s.lab_group.name
                          )}`}
                        >
                          {s.lab_group.name}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPickingFor(s)}
                        disabled={pending === s.student_id}
                        className="px-2 py-0.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                      >
                        Move
                      </button>
                      <button
                        type="button"
                        onClick={() => unassign(s)}
                        disabled={pending === s.student_id}
                        className="text-gray-400 hover:text-red-600 p-0.5 disabled:opacity-50"
                        title="Unassign"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {orgStations.length === 0 && (
            <div className="col-span-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No org stations on this lab day. (Every station is tagged as the
              checkoff skill.)
            </div>
          )}
        </section>

        <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 italic">
          Tap &ldquo;Move&rdquo; to change a student&rsquo;s station · the Auto-assign
          button spreads students evenly, one from each lab group per station.
        </p>
      </main>

      {/* Print-only layout — posted at each station on checkoff day. Uses
          a two-column CSS grid on wide paper, single column on narrow.
          Large font, generous spacing, minimal chrome. @media print CSS
          in globals scope collapses colors + page breaks; Tailwind
          `print:` utilities do the rest. */}
      <div className="hidden print:block">
        {/* Print header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-black">
            Station Assignments
            {checkoff?.lab_day && (
              <>
                {' '}
                &mdash;{' '}
                {new Date(checkoff.lab_day.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </>
            )}
          </h1>
          <div className="text-sm text-gray-700 mt-1">
            {checkoff?.lab_day?.title && <span>{checkoff.lab_day.title}</span>}
            {checkoff?.lab_day?.cohort && (
              <span>
                {checkoff.lab_day.title ? ' · ' : ''}
                {checkoff.lab_day.cohort.program?.abbreviation ?? ''} Cohort{' '}
                {checkoff.lab_day.cohort.cohort_number}
              </span>
            )}
          </div>
        </div>

        {/* Station cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgStations.map((station) => (
            <div
              key={station.id}
              className="border border-gray-400 rounded-md break-inside-avoid"
            >
              <div className="px-3 py-2 border-b border-gray-400 bg-gray-100">
                <div className="font-bold text-base text-black">
                  {station.station_number != null && (
                    <span className="mr-2">Station {station.station_number}</span>
                  )}
                  {station.title || 'Station'}
                </div>
                <div className="text-xs text-gray-700 mt-0.5">
                  {[station.room, station.instructor_name]
                    .filter(Boolean)
                    .join(' · ') ||
                    'Instructor: —'}
                </div>
              </div>
              {station.students.length === 0 ? (
                <div className="px-3 py-3 text-xs italic text-gray-600">
                  No students assigned.
                </div>
              ) : (
                <ul className="divide-y divide-gray-300">
                  {station.students.map((s) => (
                    <li
                      key={s.student_id}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 text-sm text-black"
                    >
                      <span>
                        {s.last_name}, {s.first_name}
                      </span>
                      {s.lab_group && (
                        <span className="text-xs font-semibold text-gray-800 border border-gray-400 rounded px-1.5 py-0.5">
                          {s.lab_group.name}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Intubation roster — only when checkoff data is available. */}
        {checkoff?.checkoff && checkoff.roster.length > 0 && (
          <div className="mt-6 border border-gray-400 rounded-md break-inside-avoid">
            <div className="px-3 py-2 border-b border-gray-400 bg-gray-100">
              <div className="font-bold text-base text-black">
                {checkoff.checkoff.skill_name || 'Checkoff'} — Roster
              </div>
              <div className="text-xs text-gray-700 mt-0.5">
                {checkoff.progress.complete}/{checkoff.progress.total} complete at print time
              </div>
            </div>
            <ul className="divide-y divide-gray-300 columns-1 sm:columns-2">
              {checkoff.roster.map((r) => {
                const icon =
                  r.status === 'complete'
                    ? '✓'
                    : r.status === 'retake_needed'
                    ? '↻'
                    : '○';
                const iconColor =
                  r.status === 'complete'
                    ? 'text-black'
                    : r.status === 'retake_needed'
                    ? 'text-black'
                    : 'text-gray-500';
                return (
                  <li
                    key={r.student_id}
                    className="px-3 py-1 flex items-center justify-between gap-2 text-sm text-black break-inside-avoid"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`font-bold ${iconColor}`}>{icon}</span>
                      <span>
                        {r.last_name}, {r.first_name}
                      </span>
                    </span>
                    {r.lab_group && (
                      <span className="text-[10px] text-gray-700 border border-gray-400 rounded px-1 py-0.5">
                        {r.lab_group.name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="mt-4 text-[10px] text-gray-500 italic text-right">
          Printed{' '}
          {new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Station picker sheet */}
      {pickingFor && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center print:hidden"
          onClick={() => setPickingFor(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="font-medium text-gray-900 dark:text-white">
                Assign {pickingFor.last_name}, {pickingFor.first_name}
              </div>
              <button
                type="button"
                onClick={() => setPickingFor(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
              {orgStations.length === 0 && (
                <li className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No org stations available.
                </li>
              )}
              {orgStations.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => assign(pickingFor, s.id)}
                    disabled={pending === pickingFor.student_id}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {s.station_number != null && (
                        <span className="inline-flex w-5 h-5 items-center justify-center bg-gray-100 dark:bg-gray-700 text-[10px] rounded font-semibold">
                          {s.station_number}
                        </span>
                      )}
                      {s.title || 'Station'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {s.students.length} student{s.students.length === 1 ? '' : 's'} · {s.room || '—'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RosterRow ─────────────────────────────────────────────────────────────
function RosterRow({
  student,
  pending,
  onPick,
}: {
  student: StudentEntry;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {student.last_name}, {student.first_name}
        </div>
        {student.lab_group && (
          <span
            className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${groupChipClasses(
              student.lab_group.name
            )}`}
          >
            {student.lab_group.name}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onPick}
        disabled={pending}
        className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
      </button>
    </li>
  );
}
