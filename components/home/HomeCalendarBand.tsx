'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { platoonBadge, type Platoon } from '@/lib/lvfr-platoon-style';
import { useToast } from '@/components/Toast';
import ViewAsStudentPicker from '@/components/ViewAsStudentPicker';

/** Sentinel option value that opens the student picker instead of being a plain "view as" target. */
const VIEW_AS_STUDENT_OPTION = '__view_as_student__';

/**
 * Home calendar band (TRIM 6/7a-4b, reshaped in 6/7a-5 and 6/7a-7 to mock
 * round 10): row 1 = Today tile (slot, left) + This week tile (right, day
 * columns are 1fr so they scale with the tile); row 2 = Month (3fr, left) beside
 * the sections slot (2fr, right). The month shows one chip per lab day or
 * cert-course day. Tiles size to their content (docs/LAYOUT.md). Read-only against the master calendar's sources
 * (/api/calendar/unified and /api/scheduling/lvfr-platoons). Each tile has its
 * own Mine / Everyone / Labs only filter, saved as `week_filter` and
 * `month_filter` in the additive `calendar_band` key of the user's dashboard
 * layout. The old `layout` (Stacked / Side by side) and `view` keys are left in
 * place by older saves and ignored; a legacy `filter` seeds both tiles.
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
  linked_id?: string;
  linked_lab_day_id?: string;
  event_type: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

type Filter = 'all' | 'mine' | 'labs';

interface Prefs {
  week_filter?: Filter;
  month_filter?: Filter;
}

const isFilter = (v: unknown): v is Filter => v === 'all' || v === 'mine' || v === 'labs';

interface Props {
  userName: string | null;
  /** Volunteer instructors and part-timers open on the filtered view. */
  defaultMine: boolean;
  /** Directors and admins get the View-as switch. */
  canViewAs: boolean;
  /** The Today tile (left of This week on the top row). Omitted: This week takes the row. */
  todaySlot?: ReactNode;
  /** Right of the Month tile on row 2 (the compact section tiles). Omitted: Month is centered alone. */
  sectionsSlot?: ReactNode;
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
  // Every lab is open to every instructor until its day is over.
  if (e.event_type === 'lab' && !hasEnded(e, new Date())) return true;
  if (!name) return false;
  const n = name.toLowerCase();
  return (e.instructor_names ?? []).some(i => i.toLowerCase() === n);
}

/** The lab day an event stands for: a lab_days event, or a planner block linked to one. */
function labDayIdOf(e: BandEvent): string | null {
  if (e.event_type !== 'lab') return null;
  if (e.source === 'lab_day') return e.linked_id ?? e.id.replace(/^lab-/, '');
  return e.linked_lab_day_id ?? null;
}

/**
 * Where a click goes: a lab opens its lab day page; classes and anything whose
 * link would be the semester planner go nowhere from home (the planner is
 * reached from Schedule / settings).
 */
function hrefFor(e: BandEvent): string | null {
  const labDayId = labDayIdOf(e);
  if (labDayId) return `/labs/schedule/${labDayId}`;
  if (e.source === 'planner' || e.source === 'lvfr') return null;
  if (!e.linked_url || e.linked_url.includes('/planner')) return null;
  return e.linked_url;
}

/** "ACLS (Day 1 of 2)" -> "ACLS Day 1 of 2". */
function courseDayTitle(title: string): string {
  return title.replace(/\s*\(\s*(Day \d+ of \d+)\s*\)/i, ' $1');
}

const COURSE_DAY_RE = /^(ACLS|PALS|NREMT)\s*\(\s*Day \d+ of \d+\s*\)/i;

/**
 * Month roll-up: a certification course day (ACLS, PALS, NREMT) is planned as a
 * parent block "ACLS (Day 1 of 2)" plus a pile of sub-blocks ("ACLS · Break",
 * "ACLS LAB · Megacode Practice ..."). The month keeps the parent as the one
 * chip for that course and day and drops the sub-blocks. Lab days and classes
 * pass through. The week keeps the full detail.
 */
function rollUpCourseDays(list: BandEvent[]): BandEvent[] {
  const parents = new Map<string, BandEvent>();
  for (const e of list) {
    if (e.source !== 'planner') continue;
    const m = COURSE_DAY_RE.exec(e.title);
    if (m) parents.set(`${e.date}|${m[1].toUpperCase()}`, e);
  }
  if (parents.size === 0) return list;
  return list
    .filter(e => {
      if (e.source !== 'planner') return true;
      if (COURSE_DAY_RE.test(e.title)) return true;
      const m = /^(ACLS|PALS|NREMT)\b/i.exec(e.title);
      return !(m && parents.has(`${e.date}|${m[1].toUpperCase()}`));
    })
    .map(e => (COURSE_DAY_RE.test(e.title) ? { ...e, title: courseDayTitle(e.title) } : e));
}

interface Membership {
  on: boolean;
  role_ids: string[];
  /** On the day through the per-program default roster (no role row). */
  default?: boolean;
  /** The user used Remove me on this day. */
  opted_out?: boolean;
}

function EventChip({
  e,
  compact,
  membership,
  canSignUp,
  busy,
  ended,
  listed,
  viewingAs,
  onSignUp,
  onRemove,
}: {
  e: BandEvent;
  compact?: boolean;
  membership?: Membership;
  canSignUp?: boolean;
  busy?: boolean;
  /** The event's date/end time is behind us: no Sign up. */
  ended?: boolean;
  /** The signed-in user is named in the event's instructor list. */
  listed?: boolean;
  /** View as someone else (read-only): buttons are disabled and say whose view this is. */
  viewingAs?: string;
  onSignUp?: (labDayId: string) => void;
  onRemove?: (labDayId: string) => void;
}) {
  const open = openStations(e);
  const draft = e.status === 'draft';
  const time = [fmtTime(e.start_time), fmtTime(e.end_time)].filter(Boolean).join('-');
  const labDayId = labDayIdOf(e);
  const href = hrefFor(e);
  const volunteer = e.event_type === 'volunteer';
  // Every lab gets a Sign up for anyone not already on the day; "needs
  // instructors" is only the dashed emphasis, never the condition.
  // Sign up is for lab-type events that have not ended; past days keep the
  // faded chip with no button. A person named in the event's instructor list
  // is also in (listed), same as the lab day page's Who's coming.
  const showLabButton = !!labDayId && !!canSignUp && !!membership && (!ended || membership.on || listed);
  const isIn = membership?.opted_out ? !!membership.on : !!membership?.on || !!listed;
  const body = (
    <div
      className={`rounded-md px-2 py-1 text-xs min-h-[44px] ${open > 0 ? 'border-2 border-dashed' : 'border'}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${e.color} 14%, var(--chip-surface))`,
        borderColor: open > 0 ? e.color : `color-mix(in srgb, ${e.color} 35%, var(--chip-surface))`,
        borderLeft: open > 0 ? undefined : `3px solid ${e.color}`,
      }}
      title={[e.title, time, e.room, (e.instructor_names ?? []).join(', ')].filter(Boolean).join(' · ')}
    >
      <div className="font-semibold truncate" style={{ color: e.color }}>
        {draft ? `${e.title} (draft)` : e.title}
      </div>
      <div className="text-gray-600 dark:text-gray-300 truncate">
        {time}
        {e.room ? ` · ${e.room}` : ''}
      </div>
      {(e.instructor_names ?? []).length > 0 && (
        <div className="text-gray-500 dark:text-gray-400 truncate">{(e.instructor_names ?? []).join(', ')}</div>
      )}
      {open > 0 && (
        <div className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          Needs {open} instructor{open === 1 ? '' : 's'}
        </div>
      )}
      {volunteer && (
        <span className="mt-0.5 inline-block rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
          Sign up
        </span>
      )}
    </div>
  );
  if (compact) {
    // Month: one line, the tag sits at the right end of the chip. Sign up is a
    // small filled control (44px hit area); You're in is the same shape, muted,
    // with Remove beside it for a self-signup.
    const tagShape = 'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold leading-tight';
    const viewNote = viewingAs ? `Viewing as ${viewingAs}` : undefined;
    const tag =
      showLabButton &&
      (isIn ? (
        <span className="shrink-0 flex items-center">
          <span className={`${tagShape} bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200`}>You&apos;re in</span>
          {(membership!.role_ids.length > 0 || membership!.default) && (
            <button
              type="button"
              disabled={busy || !!viewingAs}
              title={viewNote}
              onClick={() => onRemove?.(labDayId!)}
              className="inline-flex min-h-[44px] items-center px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300 underline disabled:opacity-50"
            >
              {busy ? '...' : 'Remove'}
            </button>
          )}
        </span>
      ) : (
        <button
          type="button"
          disabled={busy || !!viewingAs}
          title={viewNote}
          onClick={() => onSignUp?.(labDayId!)}
          className="shrink-0 inline-flex min-h-[44px] items-center px-0.5 disabled:opacity-50"
        >
          <span className={`${tagShape} bg-blue-600 text-white`}>{busy ? '...' : 'Sign up'}</span>
        </button>
      ));
    const label = (
      <div className="min-w-0 flex-1 font-semibold truncate" style={{ color: e.color }}>
        {e.start_time ? `${fmtTime(e.start_time)} ` : ''}
        {draft ? `${e.title} (draft)` : e.title}
      </div>
    );
    return (
      <div className="[--chip-surface:#ffffff] dark:[--chip-surface:#1f2937]">
        <div
          className={`flex items-center gap-1 rounded-md px-2 text-xs min-h-[44px] ${open > 0 ? 'border-2 border-dashed' : 'border'}`}
          style={{
            backgroundColor: `color-mix(in srgb, ${e.color} 14%, var(--chip-surface))`,
            borderColor: open > 0 ? e.color : `color-mix(in srgb, ${e.color} 35%, var(--chip-surface))`,
            borderLeft: open > 0 ? undefined : `3px solid ${e.color}`,
          }}
          title={[e.title, time, e.room, (e.instructor_names ?? []).join(', ')].filter(Boolean).join(' · ')}
        >
          {href ? (
            <Link href={href} className="flex min-w-0 flex-1 items-center self-stretch">
              {label}
            </Link>
          ) : (
            label
          )}
          {tag}
        </div>
      </div>
    );
  }
  const content = href ? <Link href={href}>{body}</Link> : body;
  return (
    <div className="[--chip-surface:#ffffff] dark:[--chip-surface:#1f2937]">
      {content}
      {showLabButton &&
        (isIn ? (
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">You&apos;re in</span>
            {(membership!.role_ids.length > 0 || membership!.default) && (
              <button
                type="button"
                disabled={busy || !!viewingAs}
                title={viewingAs ? `Viewing as ${viewingAs}` : undefined}
                onClick={() => onRemove?.(labDayId!)}
                className="min-h-[44px] px-2 text-gray-600 dark:text-gray-300 underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !!viewingAs}
            title={viewingAs ? `Viewing as ${viewingAs}` : undefined}
            onClick={() => onSignUp?.(labDayId!)}
            className="mt-0.5 min-h-[44px] rounded bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Signing up...' : 'Sign up'}
          </button>
        ))}
    </div>
  );
}

/** True once the event's day is over (today counts until its end time; no end time = through the day). */
function hasEnded(e: BandEvent, now: Date): boolean {
  const today = ymd(now);
  if (e.date < today) return true;
  if (e.date > today || !e.end_time) return false;
  const [h, m] = e.end_time.split(':').map(Number);
  if (Number.isNaN(h)) return false;
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + (m || 0);
}

export default function HomeCalendarBand({ userName, defaultMine, canViewAs, todaySlot, sectionsSlot }: Props) {
  const [weekFilter, setWeekFilter] = useState<Filter>(defaultMine ? 'mine' : 'all');
  const [monthFilter, setMonthFilter] = useState<Filter>(defaultMine ? 'mine' : 'all');
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<BandEvent[]>([]);
  const [platoons, setPlatoons] = useState<Map<string, Platoon>>(new Map());
  const [loadedKey, setLoadedKey] = useState('');
  const [instructors, setInstructors] = useState<{ id: string; name: string }[]>([]);
  const [viewAs, setViewAs] = useState('');
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const toast = useToast();
  const [membership, setMembership] = useState<Record<string, Membership>>({});
  const [canSignUp, setCanSignUp] = useState(false);
  const [busyDay, setBusyDay] = useState<string | null>(null);

  // Saved prefs
  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/layout')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const p = j?.layout?.calendar_band as (Prefs & { filter?: unknown }) | undefined;
        if (cancelled || !p) return;
        const legacy = p.filter === 'all' || p.filter === 'mine' ? p.filter : null;
        const w = isFilter(p.week_filter) ? p.week_filter : legacy;
        const m = isFilter(p.month_filter) ? p.month_filter : legacy;
        if (w) setWeekFilter(w);
        if (m) setMonthFilter(m);
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
    const next: Prefs = { week_filter: weekFilter, month_filter: monthFilter, ...patch };
    if (patch.week_filter) setWeekFilter(patch.week_filter);
    if (patch.month_filter) setMonthFilter(patch.month_filter);
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

  // Which lab days the signed-in user is already on (drives Sign up / You're in).
  const labDayIdsKey = useMemo(
    () =>
      [...new Set(events.map(labDayIdOf).filter((x): x is string => !!x))]
        .sort()
        .join(','),
    [events],
  );
  // View as: membership and can_sign_up are computed for THAT person (read-only).
  const viewAsId = viewAs ? instructors.find(i => i.name === viewAs)?.id ?? '' : '';
  useEffect(() => {
    if (!labDayIdsKey) return;
    if (viewAs && !viewAsId) return;
    let cancelled = false;
    fetch(`/api/lab-management/lab-days/my-membership?ids=${labDayIdsKey}${viewAsId ? `&as=${viewAsId}` : ''}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j?.success) return;
        setCanSignUp(!!j.can_sign_up);
        setMembership(j.days ?? {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [labDayIdsKey, viewAs, viewAsId]);

  const signUp = useCallback(
    async (labDayId: string) => {
      setBusyDay(labDayId);
      try {
        const me = await fetch('/api/lab-management/lab-days/my-membership?ids=' + labDayId).then(r => r.json());
        const res = await fetch('/api/lab-management/lab-day-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lab_day_id: labDayId, role: 'attending', instructor_id: me.user_id }),
        });
        const data = await res.json();
        if (data.success) {
          setMembership(m => ({ ...m, [labDayId]: { on: true, role_ids: [data.role.id] } }));
          const ev = events.find(x => labDayIdOf(x) === labDayId);
          const day = ev ? new Date(`${ev.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' }) : 'then';
          toast.success(`You're in, see you ${day}`);
        } else if (res.status === 409) {
          setMembership(m => ({ ...m, [labDayId]: { on: true, role_ids: [] } }));
        } else {
          toast.error(data.error || 'Could not sign up');
        }
      } catch {
        toast.error('Could not sign up');
      }
      setBusyDay(null);
    },
    [events, toast],
  );

  // Remove me: records an opt-out for this day (server removes the user's own
  // role rows and calendar events) so the default roster does not re-add them.
  const removeSignUp = useCallback(
    async (labDayId: string) => {
      setBusyDay(labDayId);
      try {
        const res = await fetch(`/api/lab-management/lab-days/${labDayId}/optout`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || 'Could not remove');
        } else {
          setMembership(m => ({ ...m, [labDayId]: { on: false, role_ids: [], opted_out: true } }));
          toast.success('Removed');
        }
      } catch {
        toast.error('Could not remove');
      }
      setBusyDay(null);
    },
    [toast],
  );

  const chipProps = (e: BandEvent) => {
    const id = labDayIdOf(e);
    return {
      membership: id ? membership[id] : undefined,
      canSignUp,
      busy: !!id && busyDay === id,
      ended: hasEnded(e, new Date()),
      listed:
        !!(viewAs || userName) &&
        (e.instructor_names ?? []).some(i => i.toLowerCase() === (viewAs || userName)!.toLowerCase()),
      viewingAs: viewAs || undefined,
      onSignUp: signUp,
      onRemove: removeSignUp,
    };
  };

  const loading = loadedKey !== `${startKey}|${endKey}`;
  const personName = viewAs || userName;
  const groupByDate = useCallback(
    (filter: Filter, rollUp = false) => {
      // View as only changes whose name 'mine' matches; Labs and Everyone are not narrowed by it.
      const visible0 =
        filter === 'labs'
          ? events.filter(e => e.event_type === 'lab')
          : filter === 'mine'
            ? events.filter(e => isMine(e, personName))
            : events;
      const visible = rollUp ? rollUpCourseDays(visible0) : visible0;
      const m = new Map<string, BandEvent[]>();
      for (const e of visible) {
        const list = m.get(e.date) ?? [];
        list.push(e);
        m.set(e.date, list);
      }
      return m;
    },
    [events, personName],
  );
  const weekByDate = useMemo(() => groupByDate(weekFilter), [groupByDate, weekFilter]);
  const monthByDate = useMemo(() => groupByDate(monthFilter, true), [groupByDate, monthFilter]);

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
    `px-3 min-h-[44px] text-[13px] font-medium transition-colors ${
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
  const filterControl = (value: Filter, onPick: (f: Filter) => void) => (
    <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600" role="group" aria-label="Filter">
      {(
        [
          ['mine', 'Mine'],
          ['all', 'Everyone'],
          ['labs', 'Labs only'],
        ] as [Filter, string][]
      ).map(([f, label]) => (
        <button
          key={f}
          type="button"
          className={seg(value === f)}
          onClick={() => onPick(f)}
        >
          {label}
        </button>
      ))}
    </div>
  );
  const panelNav = (
    label: string,
    title: string,
    filterNode: ReactNode,
    prev: () => void,
    next: () => void,
    today: () => void,
    todayLabel: string,
  ) => (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mb-3">
      <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mr-1">{label}</h3>
      {filterNode}
      <div className="ml-auto flex items-center gap-1">
        <button type="button" aria-label={`Previous ${label.toLowerCase()}`} onClick={prev} className={navBtn}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button type="button" onClick={today} className="min-h-[44px] px-3 text-[13px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          {todayLabel}
        </button>
        <span className="px-2 text-[13px] font-medium text-gray-900 dark:text-white tabular-nums">{title}</span>
        <button type="button" aria-label={`Next ${label.toLowerCase()}`} onClick={next} className={navBtn}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // Events inside a day are always a column.
  const weekGrid = (
    <div
      className="grid gap-[18px] max-md:hidden"
      style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
    >
      {weekDays.map(d => {
        const key = ymd(d);
        const list = weekByDate.get(key) ?? [];
        return (
          <div
            key={key}
            className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2 min-h-[140px] min-w-0 ${cellRing(key)}`}
          >
            {dayHeader(d)}
            <div className="mt-2 flex flex-col gap-1.5">
              {list.map(e => (
                <EventChip key={e.id} e={e} {...chipProps(e)} />
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
        .filter(d => (weekByDate.get(ymd(d)) ?? []).length > 0)
        .map(d => {
          const key = ymd(d);
          return (
            <div key={key} className={`rounded-lg border border-gray-200 dark:border-gray-700 p-2 ${cellRing(key)}`}>
              {dayHeader(d)}
              <div className="mt-2 space-y-1.5">
                {(weekByDate.get(key) ?? []).map(e => (
                  <EventChip key={e.id} e={e} {...chipProps(e)} />
                ))}
              </div>
            </div>
          );
        })}
      {!loading && weekDays.every(d => (weekByDate.get(ymd(d)) ?? []).length === 0) && (
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
          const list = monthByDate.get(key) ?? [];
          const inMonth = d.getMonth() === monthAnchor.getMonth();
          return (
            <div
              key={key}
              className={`bg-white dark:bg-gray-800 p-1.5 max-md:p-0.5 min-h-[110px] max-md:min-h-[64px] min-w-0 ${cellRing(key)} ${inMonth ? '' : 'opacity-50'}`}
            >
              {dayHeader(d, () => setWeekAnchor(d))}
              <div className="mt-1 space-y-1">
                {list.slice(0, 3).map(e => (
                  <EventChip key={e.id} e={e} compact {...chipProps(e)} />
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

  const tile = 'min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3.5';

  return (
    <section aria-label="Calendar" className="mb-8 flex flex-col gap-[18px] max-md:gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {canViewAs && (
          <label className="inline-flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-gray-300">
            <Eye className="w-4 h-4" />
            View as
            <select
              value={viewAs}
              onChange={e => {
                if (e.target.value === VIEW_AS_STUDENT_OPTION) {
                  setShowStudentPicker(true);
                  return;
                }
                setViewAs(e.target.value);
              }}
              className="min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-[13px]"
            >
              <option value="">Me</option>
              {instructors.map(i => (
                <option key={i.id} value={i.name}>
                  {i.name}
                </option>
              ))}
              <option value={VIEW_AS_STUDENT_OPTION}>View as a student…</option>
            </select>
          </label>
        )}
        {showStudentPicker && <ViewAsStudentPicker onClose={() => setShowStudentPicker(false)} />}
        <Link href="/calendar" className="ml-auto text-[13px] text-blue-600 dark:text-blue-400 hover:underline">
          Full calendar
        </Link>
      </div>

      {/* Row 1: Today (left) + This week (right). Stacks below 1200px. */}
      <div
        className={`grid items-start gap-[18px] max-md:gap-4 ${
          todaySlot ? 'grid-cols-[minmax(360px,2fr)_minmax(0,3fr)] max-[1199px]:grid-cols-1' : 'grid-cols-1'
        }`}
      >
        {todaySlot}
        <div className={tile}>
          {panelNav(
            'This week',
            weekTitle,
            filterControl(weekFilter, f => update({ week_filter: f })),
            () => setWeekAnchor(a => addDays(a, -7)),
            () => setWeekAnchor(a => addDays(a, 7)),
            () => setWeekAnchor(new Date()),
            'Today',
          )}
          {weekGrid}
          {weekList}
        </div>
      </div>

      {/* Row 2: Month (3fr) beside the sections (2fr). Stacks below 1200px. */}
      <div
        className={`grid items-start gap-[18px] max-md:gap-4 ${
          sectionsSlot ? 'grid-cols-[minmax(0,3fr)_minmax(300px,2fr)] max-[1199px]:grid-cols-1' : 'grid-cols-1'
        }`}
      >
        <div className={`${tile} ${sectionsSlot ? '' : 'w-full max-w-[1250px] mx-auto'}`}>
          {panelNav(
            'Month',
            monthTitle,
            filterControl(monthFilter, f => update({ month_filter: f })),
            () => setMonthAnchor(a => new Date(a.getFullYear(), a.getMonth() - 1, 1)),
            () => setMonthAnchor(a => new Date(a.getFullYear(), a.getMonth() + 1, 1)),
            () => setMonthAnchor(new Date()),
            'This month',
          )}
          {monthGrid}
        </div>
        {sectionsSlot}
      </div>
    </section>
  );
}
