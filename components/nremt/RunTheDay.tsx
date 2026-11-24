'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Undo2, Unlock } from 'lucide-react';
import IndividualTestingGrid, { type HubCellMenu } from '@/components/lab-day/IndividualTestingGrid';
import { shortSkillLabel } from '@/lib/nremt-skill-labels';
import { withAssistant } from '@/lib/nremt-hub-stations';
import { cardLine, estimateDay, formatAbout, formatClock, lineForStation, sourceLabel } from '@/lib/nremt-day-estimate';
import {
  dayUnits,
  enRouteList,
  freeUnitsNow,
  gapKey,
  minutesSince,
  skillForStation,
  spreadUnitSuggestions,
  studentName,
  testingNow,
  unitCounts,
  unitStations,
  unitTitle,
  type RtdInput,
  type RtdStation,
  type RtdUnit,
  type UnitCandidate,
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
// Refresh polls every 10s (the coordinator waits on it to see a station free up) and keeps the last good data on a failure.

const POLL_MS = 10000;
const TRACKER_POLL_MS = 15000;
const SLOW_MIN = 10;

function skillChip(st: RtdStation, input: RtdInput): string | null {
  if (!st.skill_name) return null;
  const col = skillForStation(st.id, input.skillColumns);
  return shortSkillLabel(st.skill_name, col?.nremtCode);
}

function stationName(s: RtdStation): string {
  return s.custom_title || s.skill_name || `Station ${s.station_number}`;
}

export default function RunTheDay({ labDayId, canManage, onChanged, onFreeCount, onData, startMs }: { labDayId: string; canManage: boolean; onChanged?: () => void; onFreeCount?: (free: number, total: number) => void; onData?: (input: RtdInput) => void; startMs?: number | null }) {
  const [input, setInput] = useState<RtdInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openPick, setOpenPick] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // "Station is free" on the BVM + O2 gap card: clears the gap for THIS screen only.
  const [dismissedGaps, setDismissedGaps] = useState<Set<string>>(() => new Set());
  // Estimate box: kept on this screen only (component state), so it can be turned off after lunch.
  const [includeBreak, setIncludeBreak] = useState(true);
  const lastGood = useRef<RtdInput | null>(null);
  // Bumped after every write made from this screen so the completion table refetches at once.
  const [refreshSignal, setRefreshSignal] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/lab-management/student-queue?lab_day_id=${labDayId}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'refresh failed');
      const next: RtdInput = {
        students: d.students || [],
        // The hub shows the proctor with the station's own text as fallback (API proctorName).
        stations: (d.stations || []).filter((st: RtdStation) => !st.notMade).map((st: RtdStation) => ({ ...st, instructorName: st.proctorName ?? st.instructorName })),
        cells: d.cells || {},
        skillColumns: d.skillColumns || [],
        skillCells: d.skillCells || {},
      };
      // An empty answer for a day that had students is a bad refresh, not a real change.
      if (next.students.length === 0 && (lastGood.current?.students.length || 0) > 0) throw new Error('empty refresh');
      lastGood.current = next;
      setInput(next);
      onData?.(next);
      setError(null);
    } catch {
      // keep the last good data on screen
      setError(lastGood.current ? 'Could not refresh. Showing the last good data.' : 'Could not load this day.');
    }
  }, [labDayId, onData]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
      setNow(Date.now());
    }, POLL_MS);
    // A hidden tab skips its polls; it refreshes once when it becomes visible again.
    const onVisible = () => {
      if (!document.hidden) {
        load();
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const afterWrite = async () => {
    await load();
    setRefreshSignal((n) => n + 1);
  };

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
    await afterWrite();
    setNow(Date.now());
  };

  const undo = async (stationId: string, queueId: string | null) => {
    if (!queueId) return;
    setBusyKey(stationId);
    try {
      const r = await fetch('/api/lab-management/student-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueId, only_if_status: 'queued' }),
      });
      const d = await r.json();
      if (!d.success) {
        if (d.alreadyStarted || r.status === 409) alert('That student has already started at this station, so Undo was not applied.');
        else alert('Could not undo: ' + (d.error || 'unknown error'));
      }
    } catch {
      alert('Could not undo');
    }
    setBusyKey(null);
    await afterWrite();
  };

  // Table cell menu: "Already there - mark In progress". Same student-queue POST the proctor's Start uses
  // (it promotes the en-route row, or creates one). No evaluation is written.
  const markInProgress = async (stationId: string, studentId: string) => {
    try {
      const r = await fetch('/api/lab-management/student-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: labDayId, student_id: studentId, station_id: stationId, status: 'in_progress' }),
      });
      const d = await r.json();
      if (!d.success) alert('Could not mark In progress: ' + (d.error || 'unknown error'));
    } catch {
      alert('Could not mark In progress');
    }
    await afterWrite();
    setNow(Date.now());
  };

  // Table cell menu: In progress -> Not started. Offered only when no evaluation is saved; removes the
  // queue row only, never an evaluation.
  const backToNotStarted = async (_stationId: string, queueId: string | null) => {
    if (!queueId) return;
    try {
      const r = await fetch('/api/lab-management/student-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueId, only_if_status: 'in_progress' }),
      });
      const d = await r.json();
      if (!d.success) {
        if (d.alreadyStarted || r.status === 409) alert('This one has been graded since - refreshing');
        else alert('Could not move back to Not started: ' + (d.error || 'unknown error'));
      }
    } catch {
      alert('Could not move back to Not started');
    }
    await afterWrite();
  };

  const reopen = async (key: string, stationIds: string[]) => {
    setBusyKey(key);
    try {
      for (const stationId of stationIds) {
        const r = await fetch(`/api/lab-management/stations/${stationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinator_status: 'open' }),
        });
        const d = await r.json();
        if (!d.success) {
          alert('Could not reopen the station: ' + (d.error || 'unknown error'));
          break;
        }
      }
    } catch {
      alert('Could not reopen the station');
    }
    setBusyKey(null);
    await afterWrite();
    onChanged?.();
  };

  const view = useMemo(() => {
    if (!input) return null;
    const enRoute = enRouteList(input);
    const { units: free, gaps } = freeUnitsNow(input, now, dismissedGaps);
    const units = dayUnits(input);
    const unitOf = new Map<string, RtdUnit>();
    for (const u of units) for (const st of unitStations(u)) unitOf.set(st.id, u);
    return {
      enRoute,
      free,
      gaps,
      unitOf,
      testing: testingNow(input),
      suggestions: spreadUnitSuggestions(free, input),
      // A BVM + O2 pair is one station: one entry, reopened as a pair.
      closed: units
        .filter((u) => unitStations(u).some((st) => (st.coordinatorStatus || 'open') !== 'open'))
        .map((u) => ({
          key: u.key,
          ids: unitStations(u).map((st) => st.id),
          title: unitTitle(u, stationName),
          onBreak: unitStations(u).every((st) => (st.coordinatorStatus || 'open') === 'break'),
        })),
    };
  }, [input, now, dismissedGaps]);

  // Estimated finish: pure calculation from the data already held here. No fetch, no writes.
  const estimate = useMemo(
    () => (input ? estimateDay(input, { now, startMs: startMs ?? null, includeBreak }) : null),
    [input, now, startMs, includeBreak]
  );
  const lineText = (stationId: string): string | null => {
    const l = estimate ? lineForStation(estimate, stationId) : null;
    return l ? cardLine(l) : null;
  };

  // A BVM + O2 pair counts as one station in "Stations free".
  const counts = input ? unitCounts(input, now, dismissedGaps) : null;
  const freeNow = counts ? counts.free : null;
  const totalNow = counts ? counts.total : null;
  useEffect(() => {
    if (freeNow !== null && totalNow !== null) onFreeCount?.(freeNow, totalNow);
  }, [freeNow, totalNow, onFreeCount]);

  if (!input || !view) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">{error || 'Loading...'}</p>;
  }

  const btn = 'min-h-[44px] px-4 rounded-lg font-semibold disabled:opacity-60';

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}

      {estimate && (
        <section aria-label="Estimated finish" className="rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 px-4 py-2 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 min-h-[44px]">
            <div className="text-sm text-gray-900 dark:text-white">
              {estimate.allDone ? (
                <span className="font-semibold">All stations done</span>
              ) : estimate.finishMs === null || estimate.testingLeftMin === null ? (
                <span className="font-semibold">Estimated finish: no open station for the skills still owed</span>
              ) : (
                <>
                  <span className="font-semibold">
                    Estimated finish {formatClock(estimate.finishMs)}
                    {estimate.fromStart ? ' (if started at ' + (startMs ? formatClock(startMs) : '') + ')' : ''}
                  </span>
                  {' - '}
                  {formatAbout(estimate.testingLeftMin)} of testing left
                  {estimate.settingBy ? ` - ${estimate.settingBy}` : ''}
                  {estimate.secondStationHint ? ` - ${estimate.secondStationHint}` : ''}
                  {sourceLabel(estimate.source) && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{sourceLabel(estimate.source)}</span>}
                </>
              )}
            </div>
            <label className="inline-flex items-center gap-2 min-h-[44px] text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="h-4 w-4" checked={includeBreak} onChange={(e) => setIncludeBreak(e.target.checked)} />
              Include a 30 minute break per station
            </label>
          </div>
          {estimate.noOpenLines.length > 0 && !estimate.allDone && (
            <div className="text-sm text-amber-700 dark:text-amber-300">No open station for: {estimate.noOpenLines.join(', ')}</div>
          )}
          {estimate.doneHints.map((h) => (
            <div key={h} className="text-sm text-blue-800 dark:text-blue-200">{h}</div>
          ))}
        </section>
      )}


      <section aria-label="Free stations" className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Free stations</h2>
        {view.free.length === 0 && view.enRoute.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">Every open station has someone in it.</p>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-4">
          {view.enRoute.map((e) => {
            const mins = minutesSince(e.sentAt, now);
            const slow = mins !== null && mins >= SLOW_MIN;
            const eu = view.unitOf.get(e.station.id);
            return (
              <div key={`er-${e.station.id}-${e.student.id}`} className="rounded-xl bg-white dark:bg-gray-800 shadow border border-amber-400 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{eu ? unitTitle(eu, stationName) : stationName(e.station)}</div>
                  <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">En route</span>
                </div>
                {eu?.kind === 'pair' && (
                  <div className="text-sm text-gray-700 dark:text-gray-300">Going to {e.station.id === eu.o2.id ? 'O2 by NRB' : 'BVM'} first</div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {withAssistant(e.station.instructorName, e.station.assistantName) || 'Proctor not set'} - {e.station.room || 'Location not set'}
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{studentName(e.student)}</div>
                {lineText(e.station.id) && <div className="text-xs text-gray-500 dark:text-gray-400">{lineText(e.station.id)}</div>}
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

          {Array.from(view.gaps.entries()).map(([key, g]) => {
            const u = view.unitOf.get(g.stationId);
            return (
              <div key={`gap-${key}`} className="rounded-xl bg-white dark:bg-gray-800 shadow border border-amber-400 p-4 space-y-2">
                <div className="text-xl font-bold text-gray-900 dark:text-white">{u ? unitTitle(u, stationName) : 'BVM + O2 by NRB'}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {studentName(g.student)} - finished {g.finished === 'o2' ? 'O2 by NRB' : 'BVM'}, {g.finished === 'o2' ? 'BVM' : 'O2 by NRB'} next
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">The proctor is reading the next instructions.</div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setDismissedGaps((p) => new Set(p).add(gapKey(g, key)))}
                    className="min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100"
                  >
                    Station is free
                  </button>
                )}
              </div>
            );
          })}

          {view.suggestions.map(({ unit, list, top }) => {
            const st = unit.kind === 'single' ? unit.station : unit.o2;
            const cardKey = unit.key;
            const others: UnitCandidate[] = list.filter((c) => c.student.id !== top?.student.id);
            return (
              <div key={cardKey} className="rounded-xl bg-white dark:bg-gray-800 shadow border border-green-500 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{unitTitle(unit, stationName)}</div>
                  <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-semibold text-green-800 dark:text-green-200">Free</span>
                </div>
                {unit.kind === 'single' && skillChip(st, input) && (
                  <span className="inline-block rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200" title={st.skill_name || undefined}>
                    {skillChip(st, input)}
                  </span>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {withAssistant(st.instructorName, st.assistantName) || 'Proctor not set'} - {st.room || 'Location not set'}
                </div>
                {unit.kind === 'pair' && <div className="text-xs text-gray-500 dark:text-gray-400">O2 by NRB first, then BVM</div>}
                {lineText(st.id) && <div className="text-xs text-gray-500 dark:text-gray-400">{lineText(st.id)}</div>}
                {top ? (
                  <>
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Suggested next</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">{studentName(top.student)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{top.why}</div>
                    {top.warn && (
                      <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {top.warn}. Pick someone else if you can.
                      </div>
                    )}
                    {canManage && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={(busyKey === cardKey || unitStations(unit).some((x) => x.id === busyKey))}
                          onClick={() => send(top.stationId, top.student.id)}
                          className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}
                        >
                          {(busyKey === cardKey || unitStations(unit).some((x) => x.id === busyKey)) ? 'Sending...' : `Send ${top.student.first_name}`}
                        </button>
                        {others.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenPick(openPick === cardKey ? null : cardKey)}
                            className={`${btn} border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100`}
                          >
                            Someone else
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Nobody waiting for this skill</div>
                    {canManage && others.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setOpenPick(openPick === cardKey ? null : cardKey)}
                          className={`${btn} border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100`}
                        >
                          Someone else
                        </button>
                      </div>
                    )}
                  </>
                )}
                {openPick === cardKey && (
                  <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
                    {others.map((c) => (
                      <li key={c.student.id}>
                        <button
                          type="button"
                          disabled={(busyKey === cardKey || unitStations(unit).some((x) => x.id === busyKey))}
                          onClick={() => send(c.stationId, c.student.id)}
                          className="w-full text-left min-h-[44px] px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{studentName(c.student)}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{c.why}</div>
                          {c.warn && (
                            <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                              Warning: {c.warn?.toLowerCase()}
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Testing now" className="rounded-xl bg-white dark:bg-gray-800 shadow p-4 space-y-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Testing now</h2>
        {view.testing.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Nobody is being graded right now.</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-1">
            {view.testing.map((t) => {
              const tu = view.unitOf.get(t.station.id);
              const part = tu?.kind === 'pair' ? (t.station.id === tu.o2.id ? ' (O2 by NRB)' : ' (BVM)') : '';
              return (
                <li key={t.station.id} className="flex items-center justify-between gap-3 text-sm min-h-[44px] border-b border-gray-100 dark:border-gray-700/60">
                  <span className="font-medium text-gray-900 dark:text-white">{(tu ? unitTitle(tu, stationName) : stationName(t.station)) + part}</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {studentName(t.student)}
                    {minutesSince(t.startedAt, now) !== null && ` - ${minutesSince(t.startedAt, now)} min`}
                    {lineText(t.station.id) && <span className="block text-xs text-gray-500 dark:text-gray-400">{lineText(t.station.id)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {view.closed.length > 0 && (
          <details className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <summary className="cursor-pointer min-h-[44px] flex items-center text-sm text-gray-600 dark:text-gray-400">
              {view.closed.length} closed station{view.closed.length === 1 ? '' : 's'}
            </summary>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-1">
              {view.closed.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400 min-h-[44px]">
                  <span>
                    {s.title} - {s.onBreak ? 'on break' : 'closed'}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busyKey === s.key}
                      onClick={() => reopen(s.key, s.ids)}
                      className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 disabled:opacity-60"
                    >
                      <Unlock className="w-4 h-4" /> Reopen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-label="Completion table" className="rounded-xl bg-white dark:bg-gray-800 shadow overflow-hidden min-w-0">
        <h2 className="px-4 pt-4 text-lg font-semibold text-gray-900 dark:text-white">Completion</h2>
        <IndividualTestingGrid
          labDayId={labDayId}
          isNremtTesting
          refreshMs={TRACKER_POLL_MS}
          refreshSignal={refreshSignal}
          hubMenu={{ canManage, send, markInProgress, undo, backToNotStarted } satisfies HubCellMenu}
        />
      </section>
    </div>
  );
}
