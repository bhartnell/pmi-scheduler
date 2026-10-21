'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Timer, UserPlus } from 'lucide-react';

/**
 * Home "Today" band (TRIM 6/7a-3): compact version of the lab schedule page's
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
  roles: { role: string; name: string | null }[];
  signups: string[];
  stations: Station[];
}

function localDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const ROLE_LABEL: Record<string, string> = {
  lab_lead: 'Lead',
  roamer: 'Roamer',
  observer: 'Observer',
  coordinator: 'Coordinator',
};

export default function TodayBand() {
  const [days, setDays] = useState<LabDay[] | null>(null);

  useEffect(() => {
    const today = localDateString(new Date());
    fetch(`/api/lab-management/my-labs?today=${today}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const all: LabDay[] = data?.labDays || [];
        setDays(all.filter(d => d.date === today));
      })
      .catch(() => setDays([]));
  }, []);

  return (
    <section aria-label="Today" className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Timer className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Today</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {days === null ? (
        <div className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      ) : days.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400">
          No labs scheduled for today.
        </p>
      ) : (
        <div className="space-y-3">
          {days.map(day => {
            const open = day.stations.filter(s => !s.instructor_name).length;
            const coming = [
              ...day.roles.filter(r => r.name).map(r => `${r.name} (${ROLE_LABEL[r.role] || r.role})`),
              ...day.signups.map(n => `${n} (signed up)`),
            ];
            const heading =
              day.program && day.cohort_number != null
                ? `${day.program} Group ${day.cohort_number}`
                : 'Lab day';
            const mins = day.rotation_duration;
            return (
              <div
                key={day.id}
                className="rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 p-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap max-md:flex-col max-md:items-stretch">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {heading}
                      {day.priority_flag && day.priority_flag !== 'normal' && (
                        <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {day.priority_flag === 'critical' ? 'Critical' : 'High priority'}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {day.title || day.section_label || 'Lab day'}
                      {day.num_rotations && mins ? ` - ${day.num_rotations} rotations x ${mins} min` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/labs/schedule/${day.id}`}
                      className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Open lab day
                    </Link>
                    <Link
                      href={`/labs/schedule/${day.id}`}
                      className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                    >
                      <Timer className="w-4 h-4" aria-hidden="true" />
                      Start Timer
                    </Link>
                  </div>
                </div>

                {day.stations.length > 0 && (
                  <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-2 mt-3">
                    {day.stations.map(st => {
                      const isOpen = !st.instructor_name;
                      return (
                        <div
                          key={st.id}
                          className={`relative flex items-stretch rounded-lg border ${
                            isOpen
                              ? 'border-dashed border-amber-400 dark:border-amber-600'
                              : st.is_mine
                                ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <Link
                            href={`/labs/grade/station/${st.id}`}
                            className="flex-1 min-w-0 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-l-lg"
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {st.station_number}{st.title ? ` - ${st.title}` : ''}
                            </p>
                            <p className={`text-xs truncate ${isOpen ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {isOpen ? 'Needs an instructor' : st.instructor_name}
                            </p>
                          </Link>
                          <Link
                            href={`/labs/grade/station/${st.id}`}
                            className="min-h-[44px] flex items-center px-3 rounded-r-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex-shrink-0"
                          >
                            Grade
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap mt-3 text-sm text-gray-600 dark:text-gray-400">
                  <p>
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
