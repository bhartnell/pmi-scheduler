'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

function localDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function TodayBand() {
  const [days, setDays] = useState<LabDay[] | null>(null);

  useEffect(() => {
    const today = localDateString(new Date());
    fetch(`/api/lab-management/my-labs?today=${today}&scope=all`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const all: LabDay[] = data?.labDays || [];
        setDays(all.filter(d => d.date === today));
      })
      .catch(() => setDays([]));
  }, []);

  return (
    <section
      aria-label="Today"
      className="min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5"
    >
      <div className="flex items-center gap-2 mb-3">
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
        <div className="flex flex-col gap-[18px]">
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
              <div key={day.id} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3 flex-wrap max-md:flex-col max-md:items-stretch">
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {heading}
                      {day.priority_flag && day.priority_flag !== 'normal' && (
                        <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {day.priority_flag === 'critical' ? 'Critical' : 'High priority'}
                        </span>
                      )}
                    </h3>
                    <p className="text-[12px] text-gray-600 dark:text-gray-400">
                      {day.title || day.section_label || 'Lab day'}
                      {day.num_rotations && mins ? ` - ${day.num_rotations} rotations x ${mins} min` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/labs/schedule/${day.id}`}
                      className="min-h-[44px] inline-flex items-center px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Open lab day
                    </Link>
                    <Link
                      href={`/labs/schedule/${day.id}`}
                      className="min-h-[44px] inline-flex items-center gap-2 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[13px] font-medium"
                    >
                      <Timer className="w-4 h-4" aria-hidden="true" />
                      Start Timer
                    </Link>
                  </div>
                </div>

                {day.stations.length > 0 && (
                  <ul className="flex flex-col gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-1.5">
                    {day.stations.map(st => {
                      const isOpen = !st.instructor_name;
                      return (
                        <li
                          key={st.id}
                          className={`flex items-center gap-3 min-h-[44px] rounded-lg border bg-white dark:bg-gray-800 pl-3 ${
                            isOpen
                              ? 'border-dashed border-amber-400 dark:border-amber-600'
                              : st.is_mine
                                ? 'border-green-400 dark:border-green-600'
                                : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span className="w-6 text-[13px] font-semibold tabular-nums text-gray-900 dark:text-white">
                            {st.station_number}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-[13px] text-gray-900 dark:text-white">
                            {st.title || 'Station'}
                          </span>
                          <span
                            className={`max-w-[40%] truncate text-[12px] ${isOpen ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
                          >
                            {isOpen ? 'Needs an instructor' : st.instructor_name}
                          </span>
                          <Link
                            href={`/labs/grade/station/${st.id}`}
                            className="min-h-[44px] flex items-center px-4 rounded-r-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] flex-shrink-0"
                          >
                            Grade
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap text-[13px] text-gray-600 dark:text-gray-400">
                  <p className="min-w-0 max-w-[70ch]">
                    <span className="font-medium text-gray-800 dark:text-gray-200">Who&apos;s coming:</span>{' '}
                    {coming.length > 0 ? coming.join(', ') : 'nobody assigned yet'}
                    <span className="mx-2 text-gray-400">|</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">Still open:</span> {open}
                  </p>
                  <Link
                    href={`/labs/schedule/${day.id}`}
                    className="inline-flex items-center gap-1 min-h-[44px] text-blue-600 dark:text-blue-400 hover:underline"
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
