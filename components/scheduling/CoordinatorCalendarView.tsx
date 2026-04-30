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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, AlertOctagon, AlertTriangle, Filter, X, Flame } from 'lucide-react';
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

type LvfrPlatoonRow = {
  date: string;
  platoon: 'A' | 'B' | 'C' | 'off';
  is_bid_day?: boolean;
  notes?: string | null;
};

type ApiResponse = {
  success: true;
  start_date: string;
  end_date: string;
  people: Person[];
  lab_days: LabDayLite[];
  blocks: Block[];
  lvfr_platoons?: LvfrPlatoonRow[];
  caller?: { id?: string; lvfr_platoon?: 'A' | 'B' | 'C' | null };
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

type Semester = { id: string; name: string; start_date: string; end_date: string | null };

interface CoordinatorCalendarViewProps {
  /**
   * Personal mode: API returns only the caller's own assignments.
   * Used by the My Calendar tab so a non-admin part-timer can plan
   * around their own commitments without seeing other people's
   * shifts / availability. Hides the scope toggle (no point — only
   * one person is in scope) and the legend (also redundant). Lab
   * days still appear regardless of staffing so NREMT / ACLS
   * priority badges are visible to everyone.
   */
  personal?: boolean;
}

export default function CoordinatorCalendarView({ personal = false }: CoordinatorCalendarViewProps = {}) {
  // Anchor is the focal date; meaning depends on viewMode.
  // - week: Sunday of the visible week
  // - month: any date inside the visible month (we recompute the
  //   42-day grid from the first-of-month each render)
  const [anchor, setAnchor] = useState<Date>(() => weekStart(new Date()));
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  // Selected day in month view — clicks expand into a per-day detail
  // strip below the grid (rendered as the same week-style block stack
  // so the per-block tooltip / link behaviour stays identical).
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
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

  const days = useMemo(() => {
    if (viewMode === 'week') {
      return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
    }
    // Month grid: 6 rows × 7 cols anchored to the Sunday on or before
    // the 1st of the visible month so weekday columns line up
    // regardless of where the month starts.
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = weekStart(firstOfMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [anchor, viewMode]);

  const startDate = ymd(days[0]);
  const endDate = ymd(days[days.length - 1]);
  // Visible month label (used for the nav header). For week view we
  // derive a separate "Apr 27 – May 3, 2026" label below.
  const visibleMonth = useMemo(
    () => anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [anchor]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const personalQ = personal ? '&personal=true' : '';
    fetch(`/api/scheduling/coordinator-calendar?start_date=${startDate}&end_date=${endDate}${personalQ}`)
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
  }, [startDate, endDate, personal]);

  // ── Semester heat-map state ────────────────────────────────────────
  // Heat map is 15 weeks of the current semester regardless of which
  // week/month the user is viewing — it's a long-range planning tool,
  // independent of the grid date range. Two extra fetches: the active
  // semester window, then the semester-wide activity payload. Both
  // are best-effort; failures silently hide the heat map without
  // breaking the calendar grid.
  const [semester, setSemester] = useState<Semester | null>(null);
  const [heatmapData, setHeatmapData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scheduling/planner/semesters?active_only=true')
      .then(r => r.json())
      .then((j: { semesters?: Semester[] }) => {
        if (cancelled) return;
        const sems = j.semesters ?? [];
        const today = ymd(new Date());
        // Pick the semester whose window contains today; if none does
        // (between semesters) fall back to the next upcoming one.
        const containing = sems.find(s =>
          s.start_date <= today && (!s.end_date || s.end_date >= today)
        );
        const upcoming = sems
          .filter(s => s.start_date > today)
          .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
        setSemester(containing ?? upcoming ?? sems[0] ?? null);
      })
      .catch(() => {
        /* heat map is best-effort; calendar still works without it */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!semester) return;
    let cancelled = false;
    // 15 weeks from the semester's start date — matches the spec's
    // "15 weeks of the current semester" framing. If the semester's
    // own end_date is shorter (e.g. an 8-week summer session) we
    // still grab the full 15-week window so the heat map shows
    // adjacent breaks instead of cutting off abruptly.
    const start = semester.start_date;
    const startDt = new Date(start + 'T00:00:00');
    const end = ymd(addDays(startDt, 15 * 7 - 1));
    const personalQ = personal ? '&personal=true' : '';
    fetch(`/api/scheduling/coordinator-calendar?start_date=${start}&end_date=${end}${personalQ}`)
      .then(r => r.json())
      .then((j: ApiResponse | { error: string }) => {
        if (cancelled) return;
        if (!('error' in j)) setHeatmapData(j);
      })
      .catch(() => {
        /* best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [semester, personal]);

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

  // LVFR platoon lookup. Coordinator view renders an A/B/C badge on
  // every day; personal view also tints the day cell when the
  // platoon matches the caller's affiliation (Jimi=A → his A-shift
  // days get a "On duty @ LVFR" gray overlay so PMI shifts show
  // alongside fire commitments at a glance).
  const lvfrByDate = useMemo(() => {
    const map = new Map<string, LvfrPlatoonRow>();
    for (const row of data?.lvfr_platoons ?? []) {
      map.set(row.date, row);
    }
    return map;
  }, [data?.lvfr_platoons]);
  const callerPlatoon = data?.caller?.lvfr_platoon ?? null;

  const todayIso = ymd(new Date());

  const weekLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // ── Heat-map weekly counts ─────────────────────────────────────────
  // Per the spec: count = lab_days + published pmi_schedule_blocks per
  // week. The API doesn't currently distinguish published vs draft for
  // class_teaching blocks (filters cancelled only), so we treat all
  // class_teaching as countable — consistent with the coordinator
  // workflow where a planned class still counts toward weekly load
  // even if it hasn't been formally published. Availability and
  // recurring blocks are excluded because they're projected, not
  // worked.
  //
  // Buckets:
  //   empty  — 0 events (review/break weeks)
  //   light  — 1-2 events (slow weeks, 1 lab day or thin schedule)
  //   medium — 3-5 events (normal lab + class week)
  //   heavy  — 6+ events (NREMT day + ACLS + LVFR concurrent)
  const heatmapWeeks = useMemo(() => {
    if (!semester || !heatmapData) return [];
    const semStart = new Date(semester.start_date + 'T00:00:00');
    // Count distinct events per week. Lab days are 1 each; class_teaching
    // blocks are deduped by their underlying schedule_block id (parsed
    // from the synthetic block.id "psb-<blockId>-<personId>") so a
    // co-taught lecture doesn't double-count.
    const buckets: Array<{ start: Date; labs: number; classes: number; total: number }> = [];
    for (let w = 0; w < 15; w++) {
      const start = addDays(semStart, w * 7);
      buckets.push({ start, labs: 0, classes: 0, total: 0 });
    }
    const weekIndexFor = (iso: string): number => {
      const d = new Date(iso + 'T00:00:00');
      const diff = Math.floor((d.getTime() - semStart.getTime()) / 86400000);
      const idx = Math.floor(diff / 7);
      return idx >= 0 && idx < 15 ? idx : -1;
    };
    for (const ld of heatmapData.lab_days) {
      const idx = weekIndexFor(ld.date);
      if (idx >= 0) buckets[idx].labs += 1;
    }
    const classBlockIds = new Set<string>();
    for (const b of heatmapData.blocks) {
      if (b.type !== 'class_teaching') continue;
      const idx = weekIndexFor(b.date);
      if (idx < 0) continue;
      // Synthetic id is "psb-<blockId>-<personId>"; the schedule block
      // id sits between the first dash and the last.
      const m = b.id.match(/^psb-(.+)-[^-]+$/);
      const dedupeKey = m ? `${idx}|${m[1]}` : b.id;
      if (classBlockIds.has(dedupeKey)) continue;
      classBlockIds.add(dedupeKey);
      buckets[idx].classes += 1;
    }
    for (const b of buckets) b.total = b.labs + b.classes;
    return buckets;
  }, [heatmapData, semester]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Controls row: date nav + person filter. Shift-type filter and
          Week/Month toggle are deferred to a follow-up commit per spec. */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {personal ? 'My Calendar' : 'Coordinator Calendar'}
          </h2>
        </div>

        {/* View mode toggle — week vs month. Month is for long-range
            planning (Jimi coordinating fire-dept rotations); week is
            the daily coordinator workflow. Today resets back to the
            anchor that makes sense for the current mode. */}
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden ml-auto">
          <button
            type="button"
            onClick={() => {
              setViewMode('week');
              setExpandedDay(null);
              // Snap anchor back to the Sunday of whatever week is in scope.
              setAnchor(weekStart(anchor));
            }}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="7-day grid"
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('month');
              setExpandedDay(null);
            }}
            className={`px-2.5 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
              viewMode === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            title="Full month — long-range planning"
          >
            Month
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setExpandedDay(null);
              if (viewMode === 'week') {
                setAnchor(prev => addDays(prev, -7));
              } else {
                setAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              }
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title={viewMode === 'week' ? 'Previous week' : 'Previous month'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setExpandedDay(null);
              setAnchor(viewMode === 'week' ? weekStart(new Date()) : new Date());
            }}
            className="px-3 py-1 text-sm font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setExpandedDay(null);
              if (viewMode === 'week') {
                setAnchor(prev => addDays(prev, 7));
              } else {
                setAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              }
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title={viewMode === 'week' ? 'Next week' : 'Next month'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {viewMode === 'week' ? weekLabel : visibleMonth}
          </span>
        </div>

        {/* Scope + person filters are coordinator-only; in personal
            mode the API has already filtered down to the caller. */}
        {!personal && (
          <>
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
          </>
        )}
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
          Loading {viewMode}…
        </div>
      ) : viewMode === 'week' ? (
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
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {topPriority !== 'normal' && (
                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded ${
                          topPriority === 'critical'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {topPriority === 'critical' ? <AlertOctagon className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                          {topPriority}
                        </div>
                      )}
                      {(() => {
                        // LVFR platoon badge — small A/B/C chip showing
                        // which platoon is on duty that day. Visible in
                        // both coordinator and personal modes; matches
                        // the shift colors so a quick glance shows
                        // which platoons cover what days of the week.
                        // BID days get a "$" sibling so the financial
                        // significance is visible without hover.
                        const lvfr = lvfrByDate.get(iso);
                        if (!lvfr || lvfr.platoon === 'off') return null;
                        const tone =
                          lvfr.platoon === 'A' ? 'bg-slate-700 text-white dark:bg-slate-600'
                          : lvfr.platoon === 'B' ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white';
                        return (
                          <>
                            <span
                              className={`inline-flex items-center px-1 py-0.5 text-[10px] font-bold rounded ${tone}`}
                              title={`LVFR ${lvfr.platoon}-shift on duty${lvfr.is_bid_day ? ' · BID day' : ''}${lvfr.notes ? ` · ${lvfr.notes}` : ''}`}
                            >
                              {lvfr.platoon}
                            </span>
                            {lvfr.is_bid_day && (
                              <span
                                className="inline-flex items-center px-1 text-[10px] font-bold rounded bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100"
                                title="BID day"
                              >
                                $
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="p-1.5 space-y-1 min-h-[140px]">
                    {/* Personal-mode LVFR overlay — gray "on duty"
                        block on dates matching the caller's platoon
                        affiliation. Informational only — does NOT
                        mark the user unavailable for PMI; coordinator
                        and Jimi himself still see PMI shifts on the
                        same day for cross-checking. */}
                    {personal && callerPlatoon && lvfrByDate.get(iso)?.platoon === callerPlatoon && (
                      <div
                        className="px-1.5 py-1 text-[11px] rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium border border-gray-400 dark:border-gray-600"
                        title={`On duty @ LVFR (${callerPlatoon}-shift)`}
                      >
                        On duty @ LVFR
                      </div>
                    )}

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
      ) : (
        // ── Month view ────────────────────────────────────────────────
        // 6 rows × 7 cols. Each cell shows up to 3 dots (one per
        // person active that day, color-coded), an overflow chip, and
        // the priority badge if any lab on that day is high/critical.
        // Clicking a cell expands it into the per-day detail strip
        // below (same block render as week view, scoped to one day).
        <div>
          <div className="grid grid-cols-7 border-t border-gray-200 dark:border-gray-700">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div
                key={d}
                className="px-2 py-1.5 text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 text-center border-b border-r last:border-r-0 border-gray-200 dark:border-gray-700"
              >
                {d}
              </div>
            ))}
            {days.map((d, idx) => {
              const iso = ymd(d);
              const isToday = iso === todayIso;
              const inMonth = d.getMonth() === anchor.getMonth();
              const dayBlocks = blocksByDate.get(iso) ?? [];
              const dayLabs = labDaysByDate.get(iso) ?? [];
              const topPriority = dayLabs.reduce<'normal' | 'high' | 'critical'>(
                (best, ld) => {
                  if (ld.priority_flag === 'critical') return 'critical';
                  if (ld.priority_flag === 'high' && best !== 'critical') return 'high';
                  return best;
                },
                'normal'
              );
              // Distinct people active that day, capped at 3 dots.
              const peopleSeen = new Set<string>();
              const personOrder: string[] = [];
              for (const b of dayBlocks) {
                if (peopleSeen.has(b.person_id)) continue;
                peopleSeen.add(b.person_id);
                personOrder.push(b.person_id);
              }
              const dotPeople = personOrder.slice(0, 3);
              const moreCount = Math.max(0, personOrder.length - 3);

              const lvfr = lvfrByDate.get(iso);
              const onLvfrDuty = personal && callerPlatoon && lvfr?.platoon === callerPlatoon;
              const cellAccent =
                topPriority === 'critical'
                  ? 'bg-red-50 dark:bg-red-900/20'
                  : topPriority === 'high'
                  ? 'bg-amber-50 dark:bg-amber-900/20'
                  : onLvfrDuty
                  ? 'bg-gray-100 dark:bg-gray-800/60'
                  : isToday
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : '';

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setExpandedDay(prev => (prev === iso ? null : iso))}
                  className={`min-h-[80px] px-1.5 py-1 border-b border-r last:border-r-0 border-gray-200 dark:border-gray-700 text-left flex flex-col gap-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${cellAccent} ${
                    expandedDay === iso ? 'ring-2 ring-blue-500 ring-inset' : ''
                  } ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}`}
                  title={onLvfrDuty ? `On duty @ LVFR (${callerPlatoon}-shift)` : undefined}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-semibold ${
                        !inMonth
                          ? 'text-gray-400 dark:text-gray-600'
                          : isToday
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {lvfr && lvfr.platoon !== 'off' && (
                        <>
                          <span
                            className={`inline-flex items-center text-[9px] font-bold rounded px-1 ${
                              lvfr.platoon === 'A' ? 'bg-slate-700 text-white dark:bg-slate-600'
                              : lvfr.platoon === 'B' ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                            }`}
                            title={`LVFR ${lvfr.platoon}-shift on duty${lvfr.is_bid_day ? ' · BID' : ''}${lvfr.notes ? ` · ${lvfr.notes}` : ''}`}
                          >
                            {lvfr.platoon}
                          </span>
                          {lvfr.is_bid_day && (
                            <span
                              className="inline-flex items-center text-[9px] font-bold rounded px-0.5 bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100"
                              title="BID day"
                            >
                              $
                            </span>
                          )}
                        </>
                      )}
                      {topPriority !== 'normal' && (
                        <span
                          className={`inline-flex items-center text-[9px] uppercase tracking-wide font-bold rounded px-1 ${
                            topPriority === 'critical'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                          title={dayLabs.find(l => l.priority_flag === topPriority)?.priority_reason ?? topPriority}
                        >
                          {topPriority === 'critical' ? <AlertOctagon className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-0.5 mt-auto">
                    {dotPeople.map(pid => {
                      const c = colorMap.get(pid);
                      if (!c) return null;
                      return (
                        <span
                          key={pid}
                          className={`w-2 h-2 rounded-full ${c.chip}`}
                          aria-hidden
                        />
                      );
                    })}
                    {moreCount > 0 && (
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 ml-0.5">
                        +{moreCount}
                      </span>
                    )}
                    {dayLabs.length > 0 && (
                      <span
                        className="ml-auto text-[9px] text-indigo-700 dark:text-indigo-300 font-medium"
                        title={dayLabs.map(l => l.title || `Lab G${l.cohort?.cohort_number}`).join(' / ')}
                      >
                        {dayLabs.length}× lab
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Expanded day detail — re-uses the same block-render logic
              as week view, scoped to one ISO date. Inline below the
              grid so the cell click feels like a drill-down rather
              than a modal interruption. */}
          {expandedDay && (() => {
            const dayBlocks = blocksByDate.get(expandedDay) ?? [];
            const dayLabs = labDaysByDate.get(expandedDay) ?? [];
            const dt = new Date(expandedDay + 'T00:00:00');
            return (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedDay(null)}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                    aria-label="Close day detail"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {dayLabs.map(ld => (
                    <Link
                      key={`exp-lab-${ld.id}`}
                      href={`/labs/schedule/${ld.id}`}
                      className="block px-2 py-1 text-xs rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/60"
                    >
                      <span className="font-semibold">
                        {ld.cohort?.program?.abbreviation || 'LAB'} G{ld.cohort?.cohort_number ?? '—'}
                      </span>
                      {ld.title && <span className="ml-2 opacity-80">{ld.title}</span>}
                    </Link>
                  ))}
                  {dayBlocks.map(b => {
                    const c = colorMap.get(b.person_id);
                    if (!c) return null;
                    const style =
                      b.type === 'lab_assignment' || b.type === 'shift' || b.type === 'class_teaching'
                        ? c.block
                        : b.type === 'manual_hours'
                        ? c.stripe
                        : c.outline;
                    const tooltipParts = [
                      b.person_name,
                      TYPE_LABELS[b.type],
                      b.start_time && b.end_time ? `${fmtTime(b.start_time)}–${fmtTime(b.end_time)}` : null,
                      b.hours != null ? `${b.hours.toFixed(2)}h` : null,
                      b.label,
                      b.notes,
                    ].filter(Boolean).join(' · ');
                    const inner = (
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{shortName(b.person_name)}</span>
                        <span className="text-[10px] opacity-80">
                          {b.start_time ? `${fmtTime(b.start_time)}${b.end_time ? `–${fmtTime(b.end_time)}` : ''}` : TYPE_LABELS[b.type]}
                        </span>
                        {b.label && (
                          <span className="text-[10px] opacity-80 truncate flex-1 text-right">{b.label}</span>
                        )}
                      </div>
                    );
                    const cls = `block px-2 py-1 text-xs rounded ${style}`;
                    if (b.type === 'lab_assignment' && b.lab_day_id) {
                      return (
                        <Link key={`exp-${b.id}`} href={`/labs/schedule/${b.lab_day_id}`} className={cls} title={tooltipParts}>
                          {inner}
                        </Link>
                      );
                    }
                    return (
                      <div key={`exp-${b.id}`} className={cls} title={tooltipParts}>
                        {inner}
                      </div>
                    );
                  })}
                  {dayBlocks.length === 0 && dayLabs.length === 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                      No coverage on this day.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Semester heat map ─────────────────────────────────────────
          15 weeks of the current semester rendered as a single row of
          intensity-coded squares. Independent of the calendar grid's
          date range — it's there to answer "which weeks are heavy /
          slow this semester" in one glance. Cell tooltip shows the
          week range + lab/class counts; cell click jumps the calendar
          to that week. */}
      {semester && heatmapWeeks.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {semester.name} — semester heat map
            </h3>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              15-week snapshot · click a week to jump
            </span>
          </div>
          <div className="grid grid-cols-15 gap-1" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
            {heatmapWeeks.map((wk, idx) => {
              const total = wk.total;
              // Buckets per spec: 0 = empty, 1-2 = light, 3-5 = medium, 6+ = heavy.
              const tone =
                total === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                  : total <= 2
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                  : total <= 5
                  ? 'bg-orange-300 dark:bg-orange-700 text-white'
                  : 'bg-red-500 dark:bg-red-700 text-white';
              const wkEnd = addDays(wk.start, 6);
              const tooltip =
                `Week ${idx + 1}: ` +
                `${wk.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${wkEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n` +
                (total === 0
                  ? 'No PMI activity'
                  : `${wk.labs} lab day(s) · ${wk.classes} class block(s)`);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setViewMode('week');
                    setAnchor(weekStart(wk.start));
                    setExpandedDay(null);
                  }}
                  className={`h-10 rounded text-[11px] font-bold flex items-center justify-center transition-transform hover:scale-105 ${tone}`}
                  title={tooltip}
                >
                  {total > 0 ? total : ''}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Intensity:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800" /> empty
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30" /> light (1–2)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-300 dark:bg-orange-700" /> medium (3–5)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500 dark:bg-red-700" /> heavy (6+)
            </span>
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
