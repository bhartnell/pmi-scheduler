'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Undo2, Unlock } from 'lucide-react';
import IndividualTestingGrid from '@/components/lab-day/IndividualTestingGrid';
import {
  candidatesForStation,
  enRouteList,
  freeStations,
  minutesSince,
  studentName,
  testingNow,
  whyLine,
  type Candidate,
  type RtdInput,
  type RtdStation,
} from '@/lib/nremt-run-the-day';

// NREMT hub "Run the day" tab (card 4225cd1c). The simple coordinator view: only FREE stations,
// each with the suggested next student and one Send button; a quiet Testing now list; the
// existing Individual Testing Tracker as the completion table. The rules live in
// lib/nremt-run-the-day (migrated from the Coordinator View, eligibility by skill).
//
// What each button writes (nothing else is written by this tab):
// - Send / pick from "Someone else": POST /api/lab-management/student-queue, one row,
//   status 'queued' (= en route), so every screen sees it. The proctor starting the grade
//   turns it into in-progress on its own.
// - Undo: DELETE /api/lab-management/student-queue for that one row (queue row only; no
//   evaluation is touched).
// - Reopen: PATCH /api/lab-management/stations/[id] { coordinator_status: 'open' }, the same
//   mark the Coordinator View and the Stations tab use.
// Refresh polls every 30s like the Coordinator View and keeps the last good data on a failure.

const POLL_MS = 30000;
const SLOW_MIN = 10;

function stationName(s: RtdStation): string {
  return s.custom_title || s.skill_name || `Station ${s.station_number}`;
}

export default function RunTheDay({ labDayId, canManage, onChanged }: { labDayId: string; canManage: boolean; onChanged?: () => void }) {
  const [input, setInput] = useState<RtdInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openPick, setOpenPick] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastGood = useRef<RtdInput | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/lab-management/student-queue?lab_day_id=${labDayId}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'refresh failed');
      const next: RtdInput = {
        students: d.students || [],
        stations: d.stations || [],
        cells: d.cells || {},
        skillColumns: d.skillColumns || [],
        skillCells: d.skillCells || {},
      };
      // An empty answer for a day that had students is a bad refresh, not a real change.
      if (next.students.length === 0 && (lastGood.current?.students.length || 0) > 0) throw new Error('empty refresh');
      lastGood.current = next;
      setInput(next);
      setError(null);
    } catch {
      // keep the last good data on screen
      setError(lastGood.current ? 'Could not refresh. Showing the last good data.' : 'Could not load this day.');
    }
  }, [labDayId]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
      setNow(Date.now());
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const send = async (stationId: string, studentId: string) => {
    setBusyKey(stationId);
    try {
      const r = await fetch('/api/lab-management/student-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: labDayId, student_id: studentId, station_id: stationId, status: 'queued' }),
      });
      const d = await r.json();
      if (!d.success) alert('Could not send the student: ' + (d.error || 'unknown error'));
    } catch {
      alert('Could not send the student');
    }
    setOpenPick(null);
    setBusyKey(null);
    await load();
    setNow(Date.now());
  };

  const undo = async (stationId: string, queueId: string | null) => {
    if (!queueId) return;
    setBusyKey(stationId);
    try {
      const r = await fetch('/api/lab-management/student-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueId }),
      });
      const d = await r.json();
      if (!d.success) alert('Could not undo: ' + (d.error || 'unknown error'));
    } catch {
      alert('Could not undo');
    }
    setBusyKey(null);
    await load();
  };

  const reopen = async (stationId: string) => {
    setBusyKey(stationId);
    try {
      const r = await fetch(`/api/lab-management/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinator_status: 'open' }),
      });
      const d = await r.json();
      if (!d.success) alert('Could not reopen the station: ' + (d.error || 'unknown error'));
    } catch {
      alert('Could not reopen the station');
    }
    setBusyKey(null);
    await load();
    onChanged?.();
  };

  const view = useMemo(() => {
    if (!input) return null;
    const enRoute = enRouteList(input);
    const free = freeStations(input);
    return {
      enRoute,
      free,
      testing: testingNow(input),
      closed: input.stations.filter((s) => (s.coordinatorStatus || 'open') !== 'open'),
    };
  }, [input]);

  if (!input || !view) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">{error || 'Loading...'}</p>;
  }

  const btn = 'min-h-[44px] px-4 rounded-lg font-semibold disabled:opacity-60';

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}

      <section aria-label="Free stations" className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Free stations</h2>
        {view.free.length === 0 && view.enRoute.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">Every open station has someone in it.</p>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4">
          {view.enRoute.map((e) => {
            const mins = minutesSince(e.sentAt, now);
            const slow = mins !== null && mins >= SLOW_MIN;
            return (
              <div key={`er-${e.station.id}-${e.student.id}`} className="rounded-xl bg-white dark:bg-gray-800 shadow border border-amber-400 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{stationName(e.station)}</div>
                  <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">En route</span>
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{studentName(e.student)}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {mins === null ? 'Sent' : `Sent ${mins} min ago`} - waiting for the proctor to start
                </div>
                {slow && <div className="text-sm font-medium text-amber-700 dark:text-amber-300">Not started after {SLOW_MIN} min</div>}
                {canManage && (
                  <button
                    type="button"
                    disabled={busyKey === e.station.id}
                    onClick={() => undo(e.station.id, e.queueId)}
                    className={`${btn} inline-flex items-center gap-1 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100`}
                  >
                    <Undo2 className="w-4 h-4" /> Undo
                  </button>
                )}
              </div>
            );
          })}

          {view.free.map((st) => {
            const list: Candidate[] = candidatesForStation(st, input);
            const top = list[0];
            const others = list.slice(1);
            return (
              <div key={st.id} className="rounded-xl bg-white dark:bg-gray-800 shadow border border-green-500 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{stationName(st)}</div>
                  <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-200">Free</span>
                </div>
                {st.skill_name && (
                  <span className="inline-block rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200">
                    {st.skill_name}
                  </span>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">Proctor: {st.instructorName || 'not set'}</div>
                {top ? (
                  <>
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Suggested next</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{studentName(top.student)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{whyLine(top)}</div>
                    {top.sameProctorAsFirstAttempt && (
                      <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        This proctor graded the first attempt. Pick someone else if you can.
                      </div>
                    )}
                    {canManage && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busyKey === st.id}
                          onClick={() => send(st.id, top.student.id)}
                          className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}
                        >
                          {busyKey === st.id ? 'Sending...' : `Send ${top.student.first_name}`}
                        </button>
                        {others.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenPick(openPick === st.id ? null : st.id)}
                            className={`${btn} border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100`}
                          >
                            Someone else
                          </button>
                        )}
                      </div>
                    )}
                    {openPick === st.id && (
                      <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
                        {others.map((c) => (
                          <li key={c.student.id}>
                            <button
                              type="button"
                              disabled={busyKey === st.id}
                              onClick={() => send(st.id, c.student.id)}
                              className="w-full text-left min-h-[44px] px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <div className="font-medium text-gray-900 dark:text-white">{studentName(c.student)}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">{whyLine(c)}</div>
                              {c.sameProctorAsFirstAttempt && (
                                <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                  Warning: this proctor graded the first attempt
                                </div>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400">Nobody is waiting for this station right now.</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6 items-start">
        <section aria-label="Testing now" className="rounded-xl bg-white dark:bg-gray-800 shadow p-4 space-y-2 lg:max-w-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Testing now</h2>
          {view.testing.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Nobody is being graded right now.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {view.testing.map((t) => (
                <li key={t.station.id} className="py-2 flex items-center justify-between gap-3 text-sm min-h-[44px]">
                  <span className="font-medium text-gray-900 dark:text-white">{stationName(t.station)}</span>
                  <span className="text-gray-700 dark:text-gray-300">{studentName(t.student)}</span>
                </li>
              ))}
            </ul>
          )}
          {view.closed.length > 0 && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
              {view.closed.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400 min-h-[44px]">
                  <span>
                    {stationName(s)} - {s.coordinatorStatus === 'break' ? 'on break' : 'closed'}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busyKey === s.id}
                      onClick={() => reopen(s.id)}
                      className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 disabled:opacity-60"
                    >
                      <Unlock className="w-4 h-4" /> Reopen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Completion table" className="rounded-xl bg-white dark:bg-gray-800 shadow overflow-hidden min-w-0">
          <h2 className="px-4 pt-4 text-lg font-semibold text-gray-900 dark:text-white">Completion</h2>
          <IndividualTestingGrid labDayId={labDayId} isNremtTesting />
        </section>
      </div>
    </div>
  );
}
