'use client';

/**
 * CoordinatorCalendarView — week grid for /scheduling Calendar tab
 * (Scheduling Overhaul #2). Read-only aggregate of every part-timer's
 * activity in a 7-day window. Click a block → navigates to the source
 * (lab day / shift / availability page).
 *
 * Scope of this commit (per user spec): week view only. Month view,
 * hours sidebar, and gap detection ship as follow-up commits.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, AlertOctagon, AlertTriangle, Filter } from 'lucide-react';
import { buildColorMap } from '@/lib/coordinator-calendar-colors';

type Block = {
  id: string;
  date: string;
  person_id: string;
  person_name: string;
  type: 'lab_assignment' | 'shift' | 'manual_hours' | 'availability' | 'recurring' | 'class_teaching';
  start_time: string | null;
  end_time: string | null;
  hours: number | null;
  lab_day_id?: string | null;
  shift_id?: string | null;
  role?: string | null;
  notes?: string | null;
  label?: string | null;
};

type LabDayLite = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  priority_flag: 'normal' | 'high' | 'critical';
  priority_reason: string | null;
  is_nremt_testing: boolean;
  cohort?: { cohort_number?: number | string; program?: { abbreviation?: string } } | null;
};

type Person = {
  id: string;
  name: string;
  email: string;
  role?: string;
  is_part_time?: boolean;
};

type ApiResponse = {
  success: true;
  start_date: string;
  end_date: string;
  people: Person[];
  lab_days: LabDayLite[];
  blocks: Block[];
};

const TYPE_LABELS: Record<Block['type'], string> = {
  lab_assignment: 'Lab',
  shift: 'Shift',
  manual_hours: 'Logged hours',
  availability: 'Available',
  recurring: 'Recurring',
  class_teaching: 'Class',
};

// Compute the Sunday-anchored start of the week containing `d`.
function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtTime(t: string | null): string {
  if (!t) return '';
  // Strip seconds; the API returns "HH:MM:SS" from Postgres time columns.
  const [h, m] = t.split(':');
  const hour = Number(h);
  const ampm = hour >= 12 ? 'p' : 'a';
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${m}${ampm}`;
}

/**
 * Pick the display token for a person on a tiny day-cell chip. Last
 * name reads better than first ("Gannon" vs "Michael") since most
 * coordinator conversations key on surnames. Falls back to whatever
 * the source has — synthetic email-only people don't have spaces, so
 * we hand back the email handle instead.
 *
 *   "Michael Gannon"           → "Gannon"
 *   "Trevor Paul"              → "Paul"
 *   "Aly Kent Jr."             → "Kent" (drops the suffix)
 *   "Brittany"                 → "Brittany"
 *   "brittanycorn01@gmail.com" → "brittanycorn01"
 */
function shortName(name: string): string {
  if (!name) return '?';
  // Email handle if no space (common for synthetic people).
  if (!/\s/.test(name)) return name.split('@')[0];
  const parts = name.trim().split(/\s+/);
  // Drop common suffixes that would otherwise become the display token.
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);
  while (parts.length > 1 && suffixes.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  return parts[parts.length - 1];
}

export default function CoordinatorCalendarView() {
  const [anchor, setAnchor] = useState<Date>(() => weekStart(new Date()));
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState<string>('all');
  // Scope toggle: default to part-timers since that's the primary
  // coordinator workflow (who needs hours / who's available). Switch
  // to 'all' for the full workload picture including Schafer / Young
  // and other full-time instructors. Only affects which people the
  // dropdown + grid list — not which raw rows the API returns.
  const [scope, setScope] = useState<'part_time' | 'all'>('part_time');

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)),
    [anchor]
  );
  const startDate = ymd(days[0]);
  const endDate = ymd(days[6]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/scheduling/coordinator-calendar?start_date=${startDate}&end_date=${endDate}`)
      .then(r => r.json())
      .then((j: ApiResponse | { error: string }) => {
        if (cancelled) return;
        if ('error' in j) {
          setError(j.error);
          setData(null);
        } else {
          setData(j);
        }
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load calendar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  // People in the active scope. Part-time is the default coordinator
  // workflow; 'all' folds in full-time instructors (Schafer, Young,
  // etc.) for the complete workload picture.
  const peopleInScope = useMemo(() => {
    if (!data) return [] as Person[];
    return scope === 'part_time'
      ? data.people.filter(p => p.is_part_time)
      : data.people;
  }, [data, scope]);

  const peopleInScopeIds = useMemo(
    () => new Set(peopleInScope.map(p => p.id)),
    [peopleInScope]
  );

  // Color map is stable for the lifetime of the response — recompute
  // only when the in-scope people change so chip and block colors stay
  // consistent across re-renders within the same week. We build off
  // peopleInScope (not data.people) so toggling scope re-pools color
  // assignments and the legend doesn't show ghost full-timers when
  // we're filtered to part-timers only.
  const colorMap = useMemo(
    () => buildColorMap(peopleInScope),
    [peopleInScope]
  );

  // Reset the per-person filter if the previously-selected person
  // falls outside the new scope (e.g. you had Schafer selected, then
  // toggled to part-time only). Avoids a stale empty grid.
  useEffect(() => {
    if (personFilter !== 'all' && !peopleInScopeIds.has(personFilter)) {
      setPersonFilter('all');
    }
  }, [personFilter, peopleInScopeIds]);

  // Filter blocks by scope first (drops full-time activity when scope
  // is 'part_time'), then by selected person. The lab_days array is
  // unaffected because the priority badge belongs to the day, not a
  // person.
  const filteredBlocks = useMemo(() => {
    if (!data) return [];
    let blocks = data.blocks.filter(b => peopleInScopeIds.has(b.person_id));
    if (personFilter !== 'all') {
      blocks = blocks.filter(b => b.person_id === personFilter);
    }
    return blocks;
  }, [data, peopleInScopeIds, personFilter]);

  // Index blocks by date for fast per-column lookup. Sorted so each
  // day's blocks render in a consistent order: lab/shift first, then
  // availability/recurring, then manual hours.
  const blocksByDate = useMemo(() => {
    const map = new Map<string, Block[]>();
    const typeOrder: Record<Block['type'], number> = {
      lab_assignment: 0,
      class_teaching: 1,
      shift: 2,
      manual_hours: 3,
      availability: 4,
      recurring: 5,
    };
    for (const b of filteredBlocks) {
      const arr = map.get(b.date) ?? [];
      arr.push(b);
      map.set(b.date, arr);
    }
    for (const arr of map.values()) {
      arr.sort((x, y) => {
        const t = typeOrder[x.type] - typeOrder[y.type];
        if (t !== 0) return t;
        return (x.start_time ?? '').localeCompare(y.start_time ?? '');
      });
    }
    return map;
  }, [filteredBlocks]);

  const labDaysByDate = useMemo(() => {
    const map = new Map<string, LabDayLite[]>();
    for (const ld of data?.lab_days ?? []) {
      const arr = map.get(ld.date) ?? [];
      arr.push(ld);
      map.set(ld.date, arr);
    }
    return map;
  }, [data?.lab_days]);

  const todayIso = ymd(new Date());

  const weekLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Controls row: date nav + person filter. Shift-type filter and
          Week/Month toggle are deferred to a follow-up commit per spec. */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Coordinator Calendar
          </h2>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setAnchor(prev => addDays(prev, -7))}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(weekStart(new Date()))}
            className="px-3 py-1 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setAnchor(prev => addDays(prev, 7))}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {weekLabel}
          </span>
        </div>

        {/* Scope toggle — Part-timers (default) or All instructors.
            Per the data-completeness clarification: full-time
            instructors (Schafer, Young, etc.) need to be queryable
            for full workload pictures, but the default workflow
            stays focused on part-timers. */}
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setScope('part_time')}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              scope === 'part_time'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="Show only part-time instructors"
          >
            Part-timers
          </button>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`px-2.5 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
              scope === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="Show all instructors including full-time staff"
          >
            All instructors
          </button>
        </div>

        {/* Person filter — uses peopleInScope so toggling between
            part-timers and all instructors resizes the dropdown. */}
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-medium">Person:</span>
          <select
            value={personFilter}
            onChange={e => setPersonFilter(e.target.value)}
            className="text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All ({peopleInScope.length})</option>
            {peopleInScope.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Legend: who's who. Skipped when filtered to one person since
          the chip is redundant in that case. Uses peopleInScope so
          full-timers don't appear in the legend when scope='part_time'. */}
      {peopleInScope.length > 0 && personFilter === 'all' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-6 py-2 text-xs text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
          <span className="font-medium">Legend:</span>
          {peopleInScope.map(p => {
            const c = colorMap.get(p.id);
            if (!c) return null;
            return (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${c.chip}`} aria-hidden />
                <span>{p.name}</span>
              </span>
            );
          })}
          {scope === 'part_time' && data && data.people.length > peopleInScope.length && (
            <span className="text-gray-400 dark:text-gray-500 italic">
              ({data.people.length - peopleInScope.length} full-time hidden — toggle &ldquo;All instructors&rdquo;)
            </span>
          )}
        </div>
      )}

      {/* Body — error / loading / empty / grid. */}
      {error && (
        <div className="px-6 py-4 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading week…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[840px]">
            {days.map((d, idx) => {
              const iso = ymd(d);
              const isToday = iso === todayIso;
              const dayBlocks = blocksByDate.get(iso) ?? [];
              const dayLabs = labDaysByDate.get(iso) ?? [];
              // Highest-priority lab on this day drives the column's
              // border accent so an unstaffed critical day is still
              // obvious from the header alone.
              const topPriority = dayLabs.reduce<'normal' | 'high' | 'critical'>(
                (best, ld) => {
                  if (ld.priority_flag === 'critical') return 'critical';
                  if (ld.priority_flag === 'high' && best !== 'critical') return 'high';
                  return best;
                },
                'normal'
              );
              const headerAccent =
                topPriority === 'critical'
                  ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                  : topPriority === 'high'
                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20'
                  : isToday
                  ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30';

              return (
                <div
                  key={iso}
                  className={`border-r border-b border-gray-200 dark:border-gray-700 ${idx === 6 ? 'border-r-0' : ''}`}
                >
                  <div className={`px-2 py-2 border-b-2 ${headerAccent}`}>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-xs uppercase tracking-wide font-semibold ${
                        isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className={`text-base font-bold ${
                        isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                      }`}>
                        {d.getDate()}
                      </span>
                    </div>
                    {/* Priority badge — uses lab_day priority_flag,
                        not person color. Critical wins over high if
                        there are multiple labs on the day. */}
                    {topPriority !== 'normal' && (
                      <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded ${
                        topPriority === 'critical'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        {topPriority === 'critical' ? <AlertOctagon className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {topPriority}
                      </div>
                    )}
                  </div>

                  <div className="p-1.5 space-y-1 min-h-[140px]">
                    {/* Lab day chip(s) — show even when no instructor
                        assigned so coordinator can spot uncovered labs. */}
                    {dayLabs.map(ld => (
                      <Link
                        key={`lab-${ld.id}`}
                        href={`/labs/schedule/${ld.id}`}
                        className="block px-1.5 py-1 text-[11px] rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 truncate"
                        title={`${ld.cohort?.program?.abbreviation ?? ''} G${ld.cohort?.cohort_number ?? ''}${ld.title ? ` — ${ld.title}` : ''}`}
                      >
                        {ld.cohort?.program?.abbreviation || 'LAB'} G{ld.cohort?.cohort_number ?? '—'}
                      </Link>
                    ))}

                    {/* Person blocks — color from buildColorMap, style
                        per type (solid / striped / outlined). */}
                    {dayBlocks.map(b => {
                      const c = colorMap.get(b.person_id);
                      if (!c) return null;
                      // class_teaching uses the solid block style too
                      // — it's confirmed work, same render weight as a
                      // lab assignment or shift.
                      const style =
                        b.type === 'lab_assignment' || b.type === 'shift' || b.type === 'class_teaching' ? c.block
                        : b.type === 'manual_hours' ? c.stripe
                        : c.outline;
                      const tooltipParts = [
                        b.person_name,
                        TYPE_LABELS[b.type],
                        b.start_time && b.end_time ? `${fmtTime(b.start_time)}–${fmtTime(b.end_time)}` : null,
                        b.hours != null ? `${b.hours.toFixed(2)}h` : null,
                        b.label,
                        b.notes,
                      ].filter(Boolean);
                      const tooltip = tooltipParts.join(' · ');

                      // Click target: lab assignments → lab day page;
                      // shifts → /scheduling (no per-shift detail page
                      // exists yet); availability/recurring/manual_hours
                      // → no link, render as plain div.
                      const inner = (
                        <>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium truncate">
                              {shortName(b.person_name)}
                            </span>
                            {b.start_time && (
                              <span className="text-[10px] opacity-80 flex-shrink-0">
                                {fmtTime(b.start_time)}
                              </span>
                            )}
                          </div>
                          {b.label && (
                            <div className="text-[10px] opacity-80 truncate">{b.label}</div>
                          )}
                        </>
                      );
                      const cls = `block px-1.5 py-1 text-[11px] rounded ${style} truncate`;
                      if (b.type === 'lab_assignment' && b.lab_day_id) {
                        return (
                          <Link key={b.id} href={`/labs/schedule/${b.lab_day_id}`} className={cls} title={tooltip}>
                            {inner}
                          </Link>
                        );
                      }
                      return (
                        <div key={b.id} className={cls} title={tooltip}>
                          {inner}
                        </div>
                      );
                    })}

                    {dayBlocks.length === 0 && dayLabs.length === 0 && (
                      <div className="text-[10px] text-gray-400 dark:text-gray-600 italic px-1">
                        no coverage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-6 py-3 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
        <span className="font-semibold">Block styles:</span>{' '}
        Solid = confirmed lab/shift · Outlined = availability/recurring · Striped = logged hours.
        Read-only — click any lab block to open its day; full month view, hours sidebar, and gap detection ship next.
      </div>
    </div>
  );
}
