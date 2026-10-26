'use client';

/**
 * RoomsPanel (PALS P2c/4) — coordinator "Rooms" view for an ACLS/PALS course.
 *
 * Not a second store: it reads the same lab_stations rows the hub renders
 * (scenario stations only, via /api/adv-cert/room-stations) grouped by room for
 * the selected day, and its instructor picker writes through the existing
 * PATCH /api/lab-management/stations/[id] (so notification, station_instructors
 * and calendar sync behave exactly as they do from the hub). Stations that
 * already have a graded attempt are skipped and keep their grader.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { groupByRoom } from '@/lib/rooms';
import type { Instructor } from '@/components/lab-day/types';

export interface RoomsDay { id: string; date: string; label?: string | null }

interface RoomStation {
  id: string;
  lab_day_id: string;
  station_number: number;
  room: string | null;
  custom_title: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  rotation_minutes: number | null;
  debrief_minutes: number | null;
  scenario?: { id: string; title: string; case_code: string | null } | null;
  graded: boolean;
  graded_by: string | null;
}

const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4';

function dayLabel(date: string, n: number) {
  const d = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Day ${n} · ${d}`;
}


export default function RoomsPanel({ days, refreshTick, onChanged }: { days: RoomsDay[]; refreshTick: number; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [stations, setStations] = useState<RoomStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Distinct dates = Day 1 / Day 2 (a date can hold several sections/lab_days).
  const dates = useMemo(() => [...new Set(days.map((d) => d.date))].sort(), [days]);
  const [date, setDate] = useState<string>('');
  useEffect(() => { if (!date || !dates.includes(date)) setDate(dates[0] || ''); }, [dates, date]);
  const dayIds = useMemo(() => days.filter((d) => d.date === date).map((d) => d.id), [days, date]);
  const dayKey = dayIds.join(',');

  const load = useCallback(async () => {
    if (!dayKey) { setStations([]); return; }
    setLoading(true);
    try {
      const results = await Promise.all(dayKey.split(',').map((id) =>
        fetch(`/api/adv-cert/room-stations?labDayId=${id}`).then((r) => r.json())));
      setStations(results.flatMap((r) => (r.success ? (r.stations as RoomStation[]) : [])));
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [dayKey]);

  useEffect(() => { if (open) load(); }, [open, load, refreshTick]);
  useEffect(() => {
    if (!open || instructors.length) return;
    fetch('/api/lab-management/instructors').then((r) => r.json())
      .then((d) => { if (d.success) setInstructors(d.instructors || []); }).catch(() => {});
  }, [open, instructors.length]);

  const rooms = useMemo(() => groupByRoom(stations), [stations]);

  const assign = async (room: string, list: RoomStation[], email: string) => {
    const inst = instructors.find((i) => i.email === email);
    if (!inst) return;
    const targets = list.filter((s) => !s.graded && s.instructor_email !== inst.email);
    if (!targets.length) return;
    setBusyRoom(room);
    setError(null);
    try {
      // One station at a time: each PATCH fires its own notification + calendar sync.
      let failed = 0;
      for (const s of targets) {
        const res = await fetch(`/api/lab-management/stations/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instructor_name: inst.name, instructor_email: inst.email }),
        });
        const data = await res.json().catch(() => ({ success: false }));
        if (!res.ok || !data.success) failed++;
      }
      if (failed) setError(`${failed} of ${targets.length} stations in ${room} did not save. Refresh and try again.`);
      await load();
      onChanged?.();
    } finally { setBusyRoom(null); }
  };

  return (
    <section className={`${card} print:hidden`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-300 w-full text-left min-h-[44px]">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} Rooms
        <span className="ml-2 text-[11px] font-normal text-gray-500">scenario stations by room; one instructor per room per day</span>
      </button>
      {open && (
        <div className="mt-2">
          {dates.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Day">
              {dates.map((d, i) => (
                <button key={d} type="button" role="tab" aria-selected={d === date} onClick={() => setDate(d)}
                  className={`min-h-[44px] px-3 text-sm rounded-md border ${d === date ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600'}`}>
                  {dayLabel(d, i + 1)}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">{error}</p>}
          {loading && !stations.length ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : !rooms.length ? (
            <p className="text-sm text-gray-500">No scenario stations on this day.</p>
          ) : (
            <div className="grid grid-cols-2 max-lg:grid-cols-1 2xl:grid-cols-3 gap-3">
              {rooms.map(([room, list]) => {
                const gradedN = list.filter((s) => s.graded).length;
                const openN = list.length - gradedN;
                const names = [...new Set(list.map((s) => s.instructor_email).filter(Boolean))];
                const current = names.length === 1 ? (names[0] as string) : '';
                return (
                  <div key={room} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{room}</h3>
                      <select
                        aria-label={`Instructor for ${room}`}
                        value={current}
                        disabled={busyRoom === room || openN === 0}
                        onChange={(e) => assign(room, list, e.target.value)}
                        className="min-h-[44px] px-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 max-w-[16rem]"
                      >
                        <option value="" disabled>{names.length > 1 ? 'Mixed instructors' : 'Pick an instructor'}</option>
                        {instructors.map((i) => <option key={i.id} value={i.email}>{i.name}</option>)}
                      </select>
                    </div>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                      {list.map((s) => (
                        <li key={s.id} className="py-1.5 text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="font-mono text-gray-500">#{s.station_number}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-100 min-w-0">
                            {s.scenario?.case_code ? `${s.scenario.case_code} · ` : ''}{s.scenario?.title || s.custom_title || 'Case TBD'}
                          </span>
                          <span className="text-gray-500">{s.rotation_minutes ?? '-'} min{s.debrief_minutes ? ` + ${s.debrief_minutes} debrief` : ''}</span>
                          <span className={s.graded ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}>
                            {s.graded ? `Graded${s.graded_by ? ` by ${s.graded_by}` : ''}` : 'Not yet graded'}
                          </span>
                          {!s.graded && <span className="text-gray-500">{s.instructor_name || 'No instructor'}</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-gray-500 mt-2">
                      {openN} not yet graded will follow an instructor change, {gradedN} graded and locked.
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
