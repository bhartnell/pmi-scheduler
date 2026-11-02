'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronDown, ChevronRight, HelpCircle, Timer, UserPlus } from 'lucide-react';
import { courseHubHref } from '@/lib/aha-hub-nav';

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
  instructor_email?: string | null;
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
  cert_course?: string | null;
  cohort_id?: string | null;
  course_day?: number | null;
  course_days_total?: number | null;
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

const COLLAPSE_KEY = 'home-today-expanded-sections';

function readExpanded(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** A busy day (more than two lab sections) shows section headers only. */
const COLLAPSE_OVER = 2;

export default function TodayBand() {
  const { data: session } = useSession();
  const [days, setDays] = useState<LabDay[] | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [savingStation, setSavingStation] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => setExpanded(readExpanded()), []);

  const toggleSection = (id: string, current: boolean) => {
    setExpanded(prev => {
      const next = { ...prev, [id]: !current };
      try { window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

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
    const isClear = email === '__clear__';
    const inst = isClear ? null : instructors.find(i => i.email?.toLowerCase() === email);
    if (!isClear && !inst) return;
    setSavingStation(stationId);
    setAssignError(null);
    try {
      const res = await fetch(`/api/lab-management/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          inst
            ? { instructor_name: inst.name, instructor_email: inst.email }
            : { instructor_name: null, instructor_email: null },
        ),
      });
      if (!res.ok) throw new Error('save failed');
      await loadDays();
    } catch {
      setAssignError('Could not change that instructor. Try the lab day page.');
    } finally {
      setSavingStation(null);
    }
  };

  const myEmail = session?.user?.email?.toLowerCase() ?? null;
  const roster = [
    ...instructors.filter(i => i.email && i.email.toLowerCase() === myEmail),
    ...instructors.filter(i => i.email && i.email.toLowerCase() !== myEmail),
  ];

  // One card per AHA course day (same cohort, course and date); every other
  // lab day stays its own block, exactly as before.
  const groups: { key: string; course: string | null; days: LabDay[] }[] = [];
  for (const day of days ?? []) {
    if (day.cert_course && day.cohort_id) {
      const key = `${day.cohort_id}|${day.cert_course}|${day.date}`;
      const hit = groups.find(g => g.key === key);
      if (hit) { hit.days.push(day); continue; }
      groups.push({ key, course: day.cert_course, days: [day] });
    } else {
      groups.push({ key: day.id, course: null, days: [day] });
    }
  }
  // Busy plain days (more than two lab sections in total) collapse too.
  const plainCount = groups.filter(g => !g.course).length;

  const renderSection = (day: LabDay, collapsible: boolean, first: boolean, inCourseCard: boolean) => {
    const open = day.open_stations;
    const coming = day.attendees.map(
      a => `${a.name} (${[...a.labels, a.employment].filter(Boolean).join(', ')})`,
    );
    const heading =
      day.program && day.cohort_number != null ? `${day.program} Group ${day.cohort_number}` : 'Lab day';
    const mins = day.rotation_duration;
    const isCollapsible = collapsible || (!inCourseCard && plainCount > COLLAPSE_OVER);
    const isFirst = inCourseCard ? first : groups.filter(g => !g.course)[0]?.days[0].id === day.id;
    const isExpanded = !isCollapsible || (expanded[day.id] ?? isFirst);
    const stationsId = `stations-${day.id}`;
    return (
      <div key={day.id} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
            {isCollapsible && day.stations.length > 0 && (
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={stationsId}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} stations for ${day.title || day.section_label || heading}`}
                onClick={() => toggleSection(day.id, isExpanded)}
                className="h-9 w-9 -ml-2 inline-flex items-center justify-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
              </button>
            )}
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
            {!inCourseCard && (
              <Link
                href={`/labs/schedule/${day.id}`}
                className="h-9 inline-flex items-center px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Open lab day
              </Link>
            )}
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

        {isExpanded && day.stations.length > 0 && (
          <ul id={stationsId} className="flex flex-col gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-1">
            {day.stations.map(st => {
              const isOpen = !st.instructor_name;
              const currentEmail = st.instructor_email?.toLowerCase() ?? '';
              const currentInRoster = roster.some(i => i.email?.toLowerCase() === currentEmail);
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
                  {roster.length > 0 ? (
                    <select
                      aria-label={`${isOpen ? 'Assign' : 'Change'} the instructor for station ${st.station_number}`}
                      value={isOpen ? '' : currentInRoster ? currentEmail : '__current__'}
                      disabled={savingStation === st.id}
                      onChange={e => e.target.value && e.target.value !== '__current__' && assign(st.id, e.target.value)}
                      className={`h-8 max-w-[40%] rounded-md border bg-white dark:bg-gray-800 px-2 text-[12px] ${
                        isOpen
                          ? 'border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <option value="">{savingStation === st.id ? 'Saving...' : 'Assign instructor'}</option>
                      {!isOpen && !currentInRoster && (
                        <option value="__current__">{st.instructor_name}</option>
                      )}
                      {!isOpen && <option value="__clear__">Clear</option>}
                      {roster.map((i, idx) => (
                        <option key={i.id} value={(i.email as string).toLowerCase()}>
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
  };

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
          {groups.map(g =>
            g.course ? (
              <div
                key={g.key}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2"
              >
                <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
                  <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">
                    {g.course.toUpperCase()} Certification
                    {g.days[0].course_day && g.days[0].course_days_total
                      ? ` - Day ${g.days[0].course_day} of ${g.days[0].course_days_total}`
                      : ''}
                  </h3>
                  <Link
                    href={courseHubHref(g.course, g.days[0].cohort_id, g.days[0].date)}
                    className="h-9 inline-flex items-center px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
                  >
                    Open hub
                  </Link>
                </div>
                {g.days.map((day, i) => renderSection(day, g.days.length > COLLAPSE_OVER, i === 0, true))}
              </div>
            ) : (
              <div key={g.key}>{renderSection(g.days[0], false, true, false)}</div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
