'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { platoonBadge, type Platoon } from '@/lib/lvfr-platoon-style';

/**
 * Home calendar band (TRIM 6/7a-4b): Mon-Fri week and month shown together.
 * Read-only against the master calendar's sources (/api/calendar/unified and
 * /api/scheduling/lvfr-platoons). View, layout and filter are saved as the
 * additive `calendar_band` key in the user's dashboard layout (a legacy
 * `view` key saved by the earlier toggle is ignored).
 */

interface BandEvent {
  id: string;
  source: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  color: string;
  cohort_number?: number;
  instructor_names?: string[];
  room?: string;
  linked_url?: string;
  event_type: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

type Layout = 'stacked' | 'side';
type Filter = 'all' | 'mine';

interface Prefs {
  layout: Layout;
  filter?: Filter;
}

interface Props {
  userName: string | null;
  /** Volunteer instructors and part-timers open on the filtered view. */
  defaultMine: boolean;
  /** Directors and admins get the View-as switch. */
  canViewAs: boolean;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = r.getDay(); // 0 = Sun
  r.setDate(r.getDate() + (dow === 0 ? -6 : 1 - dow));
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const ap = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`;
}

function openStations(e: BandEvent): number {
  const n = e.metadata?.open_station_count;
  return e.event_type === 'lab' && typeof n === 'number' ? n : 0;
}

function isMine(e: BandEvent, name: string | null): boolean {
  if (e.event_type === 'volunteer') return true;
  if (openStations(e) > 0) return true;
  if (!name) return false;
  const n = name.toLowerCase();
  return (e.instructor_names ?? []).some(i => i.toLowerCase() === n);
}

function EventChip({ e, compact }: { e: BandEvent; compact?: boolean }) {
  const open = openStations(e);
  const draft = e.status === 'draft';
  const time = [fmtTime(e.start_time), fmtTime(e.end_time)].filter(Boolean).join('-');
  const signUp = open > 0 || e.event_type === 'volunteer';
  const body = (
    <div
      className={`rounded-md px-2 py-1 text-xs min-h-[44px] max-md:min-h-[44px] ${
        open > 0 ? 'border-2 border-dashed' : 'border'
      } ${draft ? 'opacity-70' : ''}`}
      style={{
        backgroundColor: `${e.color}20`,
        borderColor: open > 0 ? e.color : `${e.color}55`,
        borderLeft: open > 0 ? undefined : `3px solid ${e.color}`,
      }}
      title={[e.title, time, e.room, (e.instructor_names ?? []).join(', ')].filter(Boolean).join(' · ')}
    >
      <div className="font-semibold truncate" style={{ color: e.color }}>
        {e.title}
      </div>
      {!compact && (
        <div className="text-gray-600 dark:text-gray-300 truncate">
          {time}
          {e.room ? ` · ${e.room}` : ''}
        </div>
      )}
      {!compact && (e.instructor_names ?? []).length > 0 && (
        <div className="text-gray-500 dark:text-gray-400 truncate">{(e.instructor_names ?? []).join(', ')}</div>
      )}
      {open > 0 && (
        <div className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          Needs {open} instructor{open === 1 ? '' : 's'}
        </div>
      )}
      {signUp && !compact && (
        <span className="mt-0.5 inline-block rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
          Sign up
        </span>
      )}
    </div>
  );
  return e.linked_url ? <Link href={e.linked_url}>{body}</Link> : body;
}

export default function HomeCalendarBand({ userName, defaultMine, canViewAs }: Props) {
  const [layout, setLayout] = useState<Layout>('stacked');
  const [filter, setFilter] = useState<Filter>(defaultMine ? 'mine' : 'all');
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<BandEvent[]>([]);
  const [platoons, setPlatoons] = useState<Map<string, Platoon>>(new Map());
  const [loadedKey, setLoadedKey] = useState('');
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>([]);
  const [viewAs, setViewAs] = useState('');

  // Saved prefs
  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/layout')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const p = j?.layout?.calendar_band as Partial<Prefs> | undefined;
        if (cancelled || !p) return;
        if (p.layout === 'stacked' || p.layout === 'side') setLayout(p.layout);
        if (p.filter === 'all' || p.filter === 'mine') setFilter(p.filter);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const savePrefs = useCallback((next: Prefs) => {
    fetch('/api/dashboard/layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: { calendar_band: next } }),
    }).catch(() => {});
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next: Prefs = { layout, filter, ...patch };
    if (patch.layout) setLayout(patch.layout);
    if (patch.filter) setFilter(patch.filter);
    savePrefs(next);
  };

  useEffect(() => {
    if (!canViewAs) return;
    fetch('/api/lab-management/instructors')
      .then(r => (r.ok ? r.json() : null))
      .then(j => setInstructors((j?.instructors ?? []).map((i: { id: string; name: string }) => ({ id: i.id, name: i.name }))))
      .catch(() => {});
  }, [canViewAs]);

  // Week range (Mon-Fri) and month range (whole Mon-Fri weeks); one fetch covers both.
  const weekRange = useMemo(() => {
    const start = mondayOf(weekAnchor);
    return { start, end: addDays(start, 4) };
  }, [weekAnchor]);
  const monthRange = useMemo(() => {
    const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const last = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
    return { start: mondayOf(first), end: addDays(mondayOf(last), 4) };
  }, [monthAnchor]);

  const startKey = ymd(weekRange.start < monthRange.start ? weekRange.start : monthRange.start);
  const endKey = ymd(weekRange.end > monthRange.end ? weekRange.end : monthRange.end);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      start_date: startKey,
      end_date: endKey,
      include: 'classes,labs,clinical,lvfr,exams,volunteers',
    });
    Promise.all([
      fetch(`/api/calendar/unified?${params}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/scheduling/lvfr-platoons?start_date=${startKey}&end_date=${endKey}`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([ev, pl]) => {
      if (cancelled) return;
      setEvents(((ev?.events ?? []) as BandEvent[]).filter(e => e.status !== 'cancelled'));
      const m = new Map<string, Platoon>();
      for (const row of (pl?.platoons ?? []) as { date: string; platoon: Platoon }[]) m.set(row.date, row.platoon);
      setPlatoons(m);
      setLoadedKey(`${startKey}|${endKey}`);
    });
    return () => {
      cancelled = true;
    };
  }, [startKey, endKey]);

  const loading = loadedKey !== `${startKey}|${endKey}`;
  const personName = viewAs || userName;
  const visible = useMemo(
    () => (filter === 'mine' || viewAs ? events.filter(e => isMine(e, personName)) : events),
    [events, filter, viewAs, personName],
  );

  const byDate = useMemo(() => {
    const m = new Map<string, BandEvent[]>();
    for (const e of visible) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [visible]);

  const rangeDays = (r: { start: Date; end: Date }) => {
    const out: Date[] = [];
    for (let d = new Date(r.start); d <= r.end; d = addDays(d, 1)) {
      if (d.getDay() >= 1 && d.getDay() <= 5) out.push(new Date(d));
    }
    return out;
  };
  const weekDays = useMemo(() => rangeDays(weekRange), [weekRange]);
  const monthDays = useMemo(() => rangeDays(monthRange), [monthRange]);

  const todayKey = ymd(new Date());
  const weekTitle = `${weekRange.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekRange.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const monthTitle = monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const seg = (active: boolean) =>
    `px-3 min-h-[44px] text-sm font-medium transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`;

  const dayHeader = (d: Date, onPick?: () => void) => {
    const key = ymd(d);
    const p = platoons.get(key);
    const label = `${DAY_NAMES[d.getDay() - 1]} ${d.getDate()}`;
    return (
      <div className="flex items-center justify-between gap-1 text-sm font-semibold text-gray-900 dark:text-white">
        {onPick ? (
          <button
            type="button"
            onClick={onPick}
            title="Show this week"
            className={`hover:underline ${key === todayKey ? 'text-blue-600 dark:text-blue-400' : ''}`}
          >
            {label}
          </button>
        ) : (
          <span className={key === todayKey ? 'text-blue-600 dark:text-blue-400' : ''}>{label}</span>
        )}
        {p && p !== 'off' && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded ${platoonBadge(p)}`}
            title={`LVFR ${p}-shift on duty`}
          >
            {p}
          </span>
        )}
      </div>
    );
  };

  // Today is outlined; there is no per-day platoon tint (the A/B/C badge is the only marking).
  const cellRing = (key: string) => (key === todayKey ? 'ring-2 ring-inset ring-blue-500' : '');

  const navBtn = 'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700';
  const panelNav = (
    label: string,
    title: string,
    prev: () => void,
    next: () => void,
    today: () => void,
  ) => (
    <div className="flex items-center gap-1 mb-2">
      <span className="text-sm font-semibold text-gray-900 dark:text-white mr-2">{label}</span>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" aria-label={`Previous ${label.toLowerCase()}`} onClick={prev} className={navBtn}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button type="button" onClick={today} className="min-h-[44px] px-3 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          Today
        </button>
        <span className="px-2 text-sm font-medium text-gray-900 dark:text-white">{title}</span>
        <button type="button" aria-label={`Next ${label.toLowerCase()}`} onClick={next} className={navBtn}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // Events inside a day are always a column.
  const weekGrid = (
    <div className="grid grid-cols-5 gap-2 max-md:hidden">
      {weekDays.map(d => {
        const key = ymd(d);
        const list = byDate.get(key) ?? [];
        return (
          <div
            key={key}
            className={`rounded-lg border border-gray-200 dark:border-gray-700 p-2 min-h-[140px] min-w-0 ${cellRing(key)}`}
          >
            {dayHeader(d)}
            <div className="mt-2 flex flex-col gap-1.5">
              {list.map(e => (
                <EventChip key={e.id} e={e} />
              ))}
              {list.length === 0 && !loading && (
                <div className="text-xs text-gray-400 dark:text-gray-500">Nothing scheduled</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Phone: the week as one agenda list, grouped by day.
  const weekList = (
    <div className="md:hidden space-y-3">
      {weekDays
        .filter(d => (byDate.get(ymd(d)) ?? []).length > 0)
        .map(d => {
          const key = ymd(d);
          return (
            <div key={key} className={`rounded-lg border border-gray-200 dark:border-gray-700 p-2 ${cellRing(key)}`}>
              {dayHeader(d)}
              <div className="mt-2 space-y-1.5">
                {(byDate.get(key) ?? []).map(e => (
                  <EventChip key={e.id} e={e} />
                ))}
              </div>
            </div>
          );
        })}
      {!loading && weekDays.every(d => (byDate.get(ymd(d)) ?? []).length === 0) && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Nothing scheduled this week.</div>
      )}
    </div>
  );

  const monthGrid = (
    <div>
      <div className="grid grid-cols-5 gap-px mb-px text-xs font-semibold text-gray-500 dark:text-gray-400">
        {DAY_NAMES.map(n => (
          <div key={n} className="px-2 py-1 max-md:px-0.5">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {monthDays.map(d => {
          const key = ymd(d);
          const list = byDate.get(key) ?? [];
          const inMonth = d.getMonth() === monthAnchor.getMonth();
          return (
            <div
              key={key}
              className={`bg-white dark:bg-gray-800 p-1.5 max-md:p-0.5 min-h-[110px] max-md:min-h-[64px] min-w-0 ${cellRing(key)} ${inMonth ? '' : 'opacity-50'}`}
            >
              {dayHeader(d, () => setWeekAnchor(d))}
              <div className="mt-1 space-y-1">
                {list.slice(0, 3).map(e => (
                  <EventChip key={e.id} e={e} compact />
                ))}
                {list.length > 3 && (
                  <Link
                    href={`/calendar`}
                    className="block text-xs text-blue-600 dark:text-blue-400 hover:underline min-h-[24px]"
                  >
                    +{list.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const side = layout === 'side';

  return (
    <section className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mr-2">Calendar</h3>
        {/* Side by side only has room above 1300 CSS px; below that the band is always stacked. */}
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 max-[1300px]:hidden">
          <button type="button" className={seg(layout === 'stacked')} onClick={() => update({ layout: 'stacked' })}>
            Stacked
          </button>
          <button type="button" className={seg(layout === 'side')} onClick={() => update({ layout: 'side' })}>
            Side by side
          </button>
        </div>
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
          <button type="button" className={seg(filter === 'all' && !viewAs)} onClick={() => { setViewAs(''); update({ filter: 'all' }); }}>
            Everyone
          </button>
          <button type="button" className={seg(filter === 'mine' || !!viewAs)} onClick={() => update({ filter: 'mine' })}>
            Mine + open spots
          </button>
        </div>
        {canViewAs && (
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <Eye className="w-4 h-4" />
            View as
            <select
              value={viewAs}
              onChange={e => setViewAs(e.target.value)}
              className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-sm"
            >
              <option value="">Me</option>
              {instructors.map(i => (
                <option key={i.id} value={i.name}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Link href="/calendar" className="ml-auto text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Full calendar
        </Link>
      </div>
      <div className={`grid gap-6 ${side ? 'min-[1300px]:grid-cols-5' : ''}`}>
        <div className={`min-w-0 ${side ? 'min-[1300px]:col-span-3' : ''}`}>
          {panelNav(
            'Week',
            weekTitle,
            () => setWeekAnchor(a => addDays(a, -7)),
            () => setWeekAnchor(a => addDays(a, 7)),
            () => setWeekAnchor(new Date()),
          )}
          {weekGrid}
          {weekList}
        </div>
        <div className={`min-w-0 ${side ? 'min-[1300px]:col-span-2' : ''}`}>
          {panelNav(
            'Month',
            monthTitle,
            () => setMonthAnchor(a => new Date(a.getFullYear(), a.getMonth() - 1, 1)),
            () => setMonthAnchor(a => new Date(a.getFullYear(), a.getMonth() + 1, 1)),
            () => setMonthAnchor(new Date()),
          )}
          {monthGrid}
        </div>
      </div>
    </section>
  );
}
