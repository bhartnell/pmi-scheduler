'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { platoonBadge, platoonTint, type Platoon } from '@/lib/lvfr-platoon-style';

/**
 * Home calendar band (TRIM 6/7a-4): Mon-Fri week and month views.
 * Read-only against the master calendar's sources (/api/calendar/unified and
 * /api/scheduling/lvfr-platoons). View, layout and filter are saved as the
 * additive `calendar_band` key in the user's dashboard layout.
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

type View = 'week' | 'month';
type Layout = 'stacked' | 'side';
type Filter = 'all' | 'mine';

interface Prefs {
  view: View;
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
  const [view, setView] = useState<View>('week');
  const [layout, setLayout] = useState<Layout>('stacked');
  const [filter, setFilter] = useState<Filter>(defaultMine ? 'mine' : 'all');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
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
        if (p.view === 'week' || p.view === 'month') setView(p.view);
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
    const next: Prefs = { view, layout, filter, ...patch };
    if (patch.view) setView(patch.view);
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

  // Visible range (Mon-Fri grid; month spans whole weeks)
  const range = useMemo(() => {
    if (view === 'week') {
      const start = mondayOf(anchor);
      return { start, end: addDays(start, 4) };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start: mondayOf(first), end: addDays(mondayOf(last), 4) };
  }, [view, anchor]);

  const startKey = ymd(range.start);
  const endKey = ymd(range.end);

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

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = new Date(range.start); d <= range.end; d = addDays(d, 1)) {
      if (d.getDay() >= 1 && d.getDay() <= 5) out.push(new Date(d));
    }
    return out;
  }, [range]);

  const todayKey = ymd(new Date());
  const step = (dir: number) =>
    setAnchor(a => (view === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));

  const title =
    view === 'week'
      ? `${range.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${range.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const seg = (active: boolean) =>
    `px-3 min-h-[44px] text-sm font-medium transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`;

  const dayHeader = (d: Date) => {
    const key = ymd(d);
    const p = platoons.get(key);
    return (
      <div className="flex items-center justify-between gap-1 text-sm font-semibold text-gray-900 dark:text-white">
        <span className={key === todayKey ? 'text-blue-600 dark:text-blue-400' : ''}>
          {DAY_NAMES[d.getDay() - 1]} {d.getDate()}
        </span>
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

  const cellTint = (key: string) => {
    if (key === todayKey) return 'bg-blue-50 dark:bg-blue-900/20';
    const p = platoons.get(key);
    return p ? platoonTint(p) : '';
  };

  const weekGrid = (
    <div className="grid grid-cols-5 gap-2 max-md:hidden">
      {days.map(d => {
        const key = ymd(d);
        const list = byDate.get(key) ?? [];
        return (
          <div
            key={key}
            className={`rounded-lg border border-gray-200 dark:border-gray-700 p-2 min-h-[140px] ${cellTint(key)}`}
          >
            {dayHeader(d)}
            <div className={`mt-2 gap-1.5 ${layout === 'side' ? 'flex flex-row items-start' : 'flex flex-col'}`}>
              {list.map(e => (
                <div key={e.id} className={layout === 'side' ? 'flex-1 min-w-0' : ''}>
                  <EventChip e={e} compact={layout === 'side' && list.length > 2} />
                </div>
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

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 5) weeks.push(days.slice(i, i + 5));

  const monthGrid = (
    <div className="max-md:hidden">
      <div className="grid grid-cols-5 gap-px mb-px text-xs font-semibold text-gray-500 dark:text-gray-400">
        {DAY_NAMES.map(n => (
          <div key={n} className="px-2 py-1">
            {n}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {weeks.flat().map(d => {
          const key = ymd(d);
          const list = byDate.get(key) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <div
              key={key}
              className={`bg-white dark:bg-gray-800 p-1.5 min-h-[110px] ${cellTint(key)} ${inMonth ? '' : 'opacity-50'}`}
            >
              {dayHeader(d)}
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

  // Phone: one agenda list, grouped by day.
  const phoneList = (
    <div className="md:hidden space-y-3">
      {days
        .filter(d => (byDate.get(ymd(d)) ?? []).length > 0)
        .map(d => {
          const key = ymd(d);
          return (
            <div key={key} className={`rounded-lg border border-gray-200 dark:border-gray-700 p-2 ${cellTint(key)}`}>
              {dayHeader(d)}
              <div className="mt-2 space-y-1.5">
                {(byDate.get(key) ?? []).map(e => (
                  <EventChip key={e.id} e={e} />
                ))}
              </div>
            </div>
          );
        })}
      {!loading && visible.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Nothing scheduled in this range.</div>
      )}
    </div>
  );

  return (
    <section className="mb-8 max-w-screen-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mr-2">Calendar</h3>
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
          <button type="button" className={seg(view === 'week')} onClick={() => update({ view: 'week' })}>
            Week
          </button>
          <button type="button" className={seg(view === 'month')} onClick={() => update({ view: 'month' })}>
            Month
          </button>
        </div>
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 max-md:hidden">
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
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Previous" onClick={() => step(-1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className="min-h-[44px] px-3 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            Today
          </button>
          <span className="px-2 text-sm font-medium text-gray-900 dark:text-white">{title}</span>
          <button type="button" aria-label="Next" onClick={() => step(1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <ChevronRight className="w-5 h-5" />
          </button>
          <Link href="/calendar" className="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Full calendar
          </Link>
        </div>
      </div>
      {view === 'week' ? weekGrid : monthGrid}
      {phoneList}
    </section>
  );
}
