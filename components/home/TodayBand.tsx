'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { HelpCircle, Timer, UserPlus } from 'lucide-react';

/**
 * Home "Today" tile (TRIM 6/7a-3, tile form in 6/7a-5): compact version of the lab schedule page's
 * "Today's Labs" block. Read-only; reuses /api/lab-management/my-labs (the
 * source of the My Labs widget). Start Timer / Open lab day just link to the
 * lab day page, where the existing timer controller runs unchanged.
 */

interface Station {
  id: string;
  station_number: number;
  title: string | null;
  instructor_name: string | null;
  is_mine: boolean;
}

interface LabDay {
  id: string;
  date: string;
  title: string | null;
  section_label: string | null;
  cohort_number: number | null;
  program: string | null;
  num_rotations: number | null;
  rotation_duration: number | null;
  priority_flag: string | null;
  attendees: { name: string; labels: string[]; employment: 'full-time' | 'part-time' | null }[];
  open_stations: number;
  stations: Station[];
}

interface Instructor {
  id: string;
  name: string | null;
  email: string | null;
}

function localDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function TodayBand() {
  const { data: session } = useSession();
  const [days, setDays] = useState<LabDay[] | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [savingStation, setSavingStation] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const loadDays = useCallback(() => {
    const today = localDateString(new Date());
    return fetch(`/api/lab-management/my-labs?today=${today}&scope=all`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const all: LabDay[] = data?.labDays || [];
        setDays(all.filter(d => d.date === today));
      })
      .catch(() => setDays(prev => prev ?? []));
  }, []);

  useEffect(() => {
    loadDays();
    // Same roster the lab day page's station picker uses. A failure just
    // leaves the dropdown out and the open row falls back to plain text.
    fetch('/api/lab-management/instructors')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setInstructors(data?.success ? data.instructors || [] : []))
      .catch(() => setInstructors([]));
  }, [loadDays]);

  // Assign through the existing station write (PATCH stations/[id]); it also
  // sends the assignment notification, same as the lab day page.
  const assign = async (stationId: string, email: string) => {
    const inst = instructors.find(i => i.email === email);
    if (!inst) return;
    setSavingStation(stationId);
    setAssignError(null);
    try {
      const res = await fetch(`/api/lab-management/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructor_name: inst.name, instructor_email: inst.email }),
      });
      if (!res.ok) throw new Error('save failed');
      await loadDays();
    } catch {
      setAssignError('Could not assign that instructor. Try the lab day page.');
    } finally {
      setSavingStation(null);
    }
  };

  const myEmail = session?.user?.email?.toLowerCase() ?? null;
  const roster = [
    ...instructors.filter(i => i.email && i.email.toLowerCase() === myEmail),
    ...instructors.filter(i => i.email && i.email.toLowerCase() !== myEmail),
  ];

  return (
    <section
      aria-label="Today"
      className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-[14px] py-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <Timer className="w-4 h-4 text-green-600 dark:text-green-400" aria-hidden="true" />
        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Today</h2>
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {days === null ? (
        <div className="h-24 rounded-lg bg-gray-100 dark:bg-gray-900/40 animate-pulse" />
      ) : days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-[13px] text-gray-500 dark:text-gray-400">
          No labs scheduled for today.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map(day => {
            const open = day.open_stations;
            const coming = day.attendees.map(
              a => `${a.name} (${[...a.labels, a.employment].filter(Boolean).join(', ')})`,
            );
            const heading =
              day.program && day.cohort_number != null
                ? `${day.program} Group ${day.cohort_number}`
                : 'Lab day';
            const mins = day.rotation_duration;
            return (
              <div key={day.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
                  <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {heading}
                      {day.priority_flag && day.priority_flag !== 'normal' && (
                        <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {day.priority_flag === 'critical' ? 'Critical' : 'High priority'}
                        </span>
                      )}
                    </h3>
                    <p className="text-[12px] text-gray-600 dark:text-gray-400 truncate">
                      {day.title || day.section_label || 'Lab day'}
                      {day.num_rotations && mins ? ` - ${day.num_rotations} rotations x ${mins} min` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/labs/schedule/${day.id}`}
                      className="h-9 inline-flex items-center px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Open lab day
                    </Link>
                    <Link
                      href={`/labs/schedule/${day.id}`}
                      className="h-9 inline-flex items-center gap-2 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[13px] font-medium"
                    >
                      <Timer className="w-4 h-4" aria-hidden="true" />
                      Start Timer
                    </Link>
                  </div>
                </div>

                {assignError && (
                  <p role="alert" className="text-[12px] text-red-600 dark:text-red-400">{assignError}</p>
                )}

                {day.stations.length > 0 && (
                  <ul className="flex flex-col gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-1">
                    {day.stations.map(st => {
                      const isOpen = !st.instructor_name;
                      return (
                        <li
                          key={st.id}
                          className={`flex items-center gap-3 h-10 rounded-lg border bg-white dark:bg-gray-800 pl-2 pr-0.5 ${
                            isOpen
                              ? 'border-dashed border-amber-400 dark:border-amber-600'
                              : st.is_mine
                                ? 'border-green-400 dark:border-green-600'
                                : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold tabular-nums text-gray-900 dark:bg-gray-700 dark:text-white">
                            {st.station_number}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-white">
                            {st.title || 'Station'}
                          </span>
                          {isOpen && roster.length > 0 ? (
                            <select
                              aria-label={`Assign an instructor to station ${st.station_number}`}
                              value=""
                              disabled={savingStation === st.id}
                              onChange={e => e.target.value && assign(st.id, e.target.value)}
                              className="h-8 max-w-[40%] rounded-md border border-amber-400 dark:border-amber-600 bg-white dark:bg-gray-800 px-2 text-[12px] text-amber-700 dark:text-amber-400"
                            >
                              <option value="">{savingStation === st.id ? 'Saving...' : 'Assign instructor'}</option>
                              {roster.map((i, idx) => (
                                <option key={i.id} value={i.email as string}>
                                  {idx === 0 && i.email?.toLowerCase() === myEmail ? 'Me' : i.name || i.email}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`max-w-[40%] truncate text-[12px] ${isOpen ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                              {isOpen ? 'Needs an instructor' : st.instructor_name}
                            </span>
                          )}
                          <Link
                            href={`/labs/grade/station/${st.id}`}
                            className="relative h-9 flex items-center px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[13px] flex-shrink-0 before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']"
                          >
                            Grade
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap text-[12px] text-gray-600 dark:text-gray-400">
                  <p className="min-w-0 max-w-[70ch]">
                    <span className="font-medium text-gray-800 dark:text-gray-200">Who&apos;s coming:</span>{' '}
                    {coming.length > 0 ? coming.join(', ') : 'nobody assigned yet'}
                    <span className="mx-2 text-gray-400">|</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">Still open:</span> {open}
                  </p>
                  <Link
                    href={`/labs/schedule/${day.id}`}
                    className="relative inline-flex items-center gap-1 h-6 text-blue-600 dark:text-blue-400 hover:underline before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-['']"
                  >
                    {open > 0 ? <UserPlus className="w-4 h-4" aria-hidden="true" /> : <HelpCircle className="w-4 h-4" aria-hidden="true" />}
                    Ask for help
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
