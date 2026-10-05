'use client';

/**
 * ACLS Hub — Board view. Built from Ben's sandbox layout (Task Handoff Queue,
 * "BUILD THE SANDBOX PAGE", 2026-10-02): a 12-column board of four regions
 * (Overview, Schedule, Stations, Student progress), a time engine for the
 * schedule, station tiles and a roster-based student progress panel.
 *
 * Presentation over the SAME plumbing the current hub (/labs/acls-hub) uses:
 * /api/adv-cert/acls-hub, /api/calendar/unified, planner block PUT, attendance
 * PUT, learning marks, EditStationModal. The current hub stays in place as the
 * rollback until this one has been reviewed.
 */

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { withReturnTo } from '@/lib/return-to';
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw, Printer, GripVertical, ParkingSquare, ChevronUp, ChevronDown, ChevronRight, Timer } from 'lucide-react';
import LabTimer from '@/components/LabTimer';
import EditStationModal from '@/components/lab-day/EditStationModal';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';
import type { LabDay as FullLabDay, Station as FullStation, Instructor, InstructorAvailabilityEntry } from '@/components/lab-day/types';

interface Member { id: string; first_name: string; last_name: string }
interface Group { id: string; name: string; members: Member[] }
interface Station {
  id: string; lab_day_id: string; station_number: number; custom_title: string | null;
  room: string | null; instructor_name: string | null; station_notes: string | null;
  rotation_minutes?: number | null;
  scenario?: { id: string; title: string; case_code: string | null; cert_tier?: string | null; category?: string | null } | null;
}
interface LabDay {
  id: string; date: string; section_number: number | null; section_label: string | null;
  title: string | null; start_time: string | null; end_time: string | null;
  num_rotations?: number | null; rotation_duration?: number | null;
  lab_mode: string | null; is_adv_cert_testing: boolean; stations: Station[];
}
interface Attempt {
  id: string; lab_day_id: string; lab_group_id: string; overall_result: string; started_at: string;
  team_lead?: { id: string; first_name: string; last_name: string } | null;
  students?: { student_id: string }[];
  scenario?: { id: string; name: string; case_code: string | null } | null;
}
interface CalEvent {
  id: string; title: string; date: string; start_time: string | null; end_time: string | null;
  event_type: string; instructor_names?: string[]; room?: string; status?: string;
  source?: string; linked_id?: string; linked_lab_day_id?: string; content_notes?: string;
  metadata?: { is_parked?: boolean; actual_start_time?: string | null; instructor_id?: string | null; additional_instructor_id?: string | null; linked_section_number?: number | null };
}
interface InstructorOpt { id: string; name: string }

type RegionId = 'overview' | 'schedule' | 'stations' | 'progress';
interface RegionCfg { id: RegionId; t: string; span: number; on: boolean }
// Ben's arrangement (2026-10-05): overview on top, student progress LEFT of the schedule, stations across the bottom.
const DEFAULT_REGIONS: RegionCfg[] = [
  { id: 'overview', t: 'Overview', span: 12, on: true },
  { id: 'progress', t: 'Student progress', span: 6, on: true },
  { id: 'schedule', t: 'Schedule', span: 6, on: true },
  { id: 'stations', t: 'Stations', span: 12, on: true },
];
const SPAN_CLASS: Record<number, string> = {
  3: 'col-span-3', 4: 'col-span-4', 5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8', 12: 'col-span-12',
};

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const toMin = (t?: string | null) => (t ? parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10) : 0);
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const prettyDate = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); } catch { return d; } };
const fullName = (m: Member) => `${m.first_name} ${m.last_name}`;
const lsGet = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* per-viewer convenience only */ } };

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{pct}%</div>
    </div>
  );
}

function Tile({ label, value, tone, bar }: { label: string; value: React.ReactNode; tone?: string; bar?: { done: number; total: number } }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 min-h-[88px]">
      <div className={`text-2xl font-bold leading-tight ${tone || 'text-gray-900 dark:text-white'}`}>{value}</div>
      <div className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</div>
      {bar && <Bar {...bar} />}
    </div>
  );
}

// Same chip for both sources; the state set differs by source (learning = pass/watch,
// megacode = pass/watch/fail). Never collapse one into the other.
function Chip({ state }: { state: 'pass' | 'watch' | 'fail' | 'none' }) {
  const cls = {
    pass: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    watch: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    fail: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    none: 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
  }[state];
  const label = { pass: 'Pass', watch: 'Watch', fail: 'Fail', none: '—' }[state];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function BoardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortIdParam = searchParams.get('cohortId');

  interface Cohort { id: string; cohort_number?: number | null; program?: { abbreviation?: string | null } | null }
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [courseOptions, setCourseOptions] = useState<{ id: string; label: string }[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [watchMarks, setWatchMarks] = useState<{ lab_day_id: string; student_id: string; mark: string }[]>([]);
  const [absentByLabDay, setAbsentByLabDay] = useState<Record<string, string[]>>({});
  const [instructorOpts, setInstructorOpts] = useState<InstructorOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string>('all');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingBlock, setSavingBlock] = useState<string | null>(null);
  const [absentError, setAbsentError] = useState<string | null>(null);

  // One view: actual times, park and reorder are always available (no Plan/Run modes).
  const runMode = true;
  const [regions, setRegions] = useState<RegionCfg[]>(DEFAULT_REGIONS);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  // Transient drag order (cleared once the move is saved to the schedule).
  const [orderByDay, setOrderByDay] = useState<Record<string, string[]>>({});
  const dragId = useRef<string | null>(null);
  const [attemptPicker, setAttemptPicker] = useState<{ studentId: string; list: Attempt[] } | null>(null);

  // EditStationModal wiring (same data the coordinator page feeds it).
  const [timerFor, setTimerFor] = useState<LabDay | null>(null);
  const [editing, setEditing] = useState<{ station: FullStation; labDay: FullLabDay } | null>(null);
  const [fullInstructors, setFullInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [instructorAvailability, setInstructorAvailability] = useState<InstructorAvailabilityEntry[]>([]);

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const saved = lsGet('aclsBoard.regions.v2');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as RegionCfg[];
      if (Array.isArray(parsed) && parsed.length === 4 && parsed.every(r => DEFAULT_REGIONS.some(d => d.id === r.id))) {
        setRegions(parsed.map(r => ({ ...DEFAULT_REGIONS.find(d => d.id === r.id)!, on: r.on !== false })));
      }
    } catch { /* ignore */ }
  }, []);
  const updateRegions = (next: RegionCfg[]) => { setRegions(next); lsSet('aclsBoard.regions.v2', JSON.stringify(next)); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hub = await (await fetch(cohortIdParam ? `/api/adv-cert/acls-hub?cohortId=${encodeURIComponent(cohortIdParam)}` : '/api/adv-cert/acls-hub')).json();
      if (!hub.success) return;
      setCohort(hub.cohort); setDates(hub.dates || []); setLabDays(hub.labDays || []);
      setGroups(hub.groups || []); setAttempts(hub.attempts || []);
      Promise.all((hub.labDays || []).map((ld: { id: string }) => fetch(`/api/adv-cert/learning-marks?labDayId=${ld.id}`).then(r => r.json()).catch(() => null)))
        .then(rs => setWatchMarks(rs.flatMap((r: { success?: boolean; marks?: { lab_day_id: string; student_id: string; mark: string }[] } | null) => (r?.success ? r.marks || [] : []))))
        .catch(() => setWatchMarks([]));
      Promise.all((hub.labDays || []).map((ld: { id: string }) => fetch(`/api/lab-management/lab-days/${ld.id}/attendance`).then(r => r.json())
        .then((r: { students?: { student_id: string; status: string | null }[] }) => [ld.id, (r.students || []).filter(x => x.status === 'absent').map(x => x.student_id)] as [string, string[]])
        .catch(() => [ld.id, []] as [string, string[]])))
        .then(entries => setAbsentByLabDay(Object.fromEntries(entries)))
        .catch(() => setAbsentByLabDay({}));
      if (hub.cohort?.id && (hub.dates || []).length) {
        const u = await (await fetch(`/api/calendar/unified?cohort_id=${hub.cohort.id}&start=${hub.dates[0]}&end=${hub.dates[hub.dates.length - 1]}&include=classes,labs,exams`)).json();
        setEvents((u.events || []).filter((e: CalEvent) => hub.dates.includes(e.date) && e.status !== 'cancelled'));
      } else setEvents([]);
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [cohortIdParam]);
  useEffect(() => { if (status === 'authenticated') load(); }, [load, status]);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && dates.includes(dateParam)) setActiveDate(dateParam);
  }, [searchParams, dates]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/adv-cert/aha-hub').then(r => r.json()).then(d => {
      if (!d.success) return;
      setCourseOptions((d.courses?.acls || []).filter((c: { cohort?: { id?: string } }) => c.cohort?.id)
        .map((c: { cohort: { id: string; cohort_number?: number; program?: { abbreviation?: string } } }) => ({ id: c.cohort.id, label: `${c.cohort.program?.abbreviation || ''} G${c.cohort.cohort_number ?? ''}`.trim() })));
    }).catch(() => {});
    fetch('/api/lab-management/instructors').then(r => r.json()).then(d => {
      if (d.success) { setInstructorOpts(d.instructors || []); setFullInstructors(d.instructors || []); }
    }).catch(() => {});
    fetch('/api/lab-management/locations?type=lab_rooms').then(r => r.json()).then(d => { if (d.success) setLocations(d.locations || []); }).catch(() => {});
  }, [status]);

  // Persist one schedule-block field via the existing planner block PUT ('this' = this dated block only).
  // Optimistic: apply locally first so the row moves immediately, then settle with the server.
  // On failure only the fields this patch touched are rolled back.
  const saveBlock = useCallback(async (e: CalEvent, patch: Record<string, string | null>) => {
    if (!e.linked_id) return;
    setSavingBlock(e.id); setSaveError(null);
    const applyFields = (src: Record<string, string | null>) => setEvents(prev => prev.map(x => {
      if (x.id !== e.id) return x;
      const next: CalEvent = { ...x, metadata: { ...x.metadata } };
      if ('instructor_id' in src) next.metadata!.instructor_id = src.instructor_id || null;
      if ('actual_start_time' in src) next.metadata!.actual_start_time = src.actual_start_time || null;
      return next;
    }));
    const previous: Record<string, string | null> = {};
    if ('instructor_id' in patch) previous.instructor_id = e.metadata?.instructor_id ?? null;
    if ('actual_start_time' in patch) previous.actual_start_time = e.metadata?.actual_start_time ?? null;
    applyFields(patch);
    try {
      const res = await fetch(`/api/scheduling/planner/blocks/${e.linked_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, update_mode: 'this' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    } catch (err) {
      applyFields(previous);
      setSaveError(`Could not save "${e.title}" (row put back): ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally { setSavingBlock(null); }
  }, []);

  // Same visibility rule as the current hub: hide the monolithic section-1 day once split into sections.
  const visibleLabDays = useMemo(() => {
    const sectioned = new Set(labDays.filter(d => (d.section_number ?? 1) > 1).map(d => d.date));
    return labDays.filter(d => !((d.section_number ?? 1) === 1 && sectioned.has(d.date)));
  }, [labDays]);
  const visibleDates = activeDate === 'all' ? dates : dates.filter(d => d === activeDate);
  const dayNo = (d: string) => dates.indexOf(d) + 1;

  // The all-day "ACLS (Day N of N)" block is the day header, not an event: it must not take a row,
  // a duration, or enter the clock. Detected as a block that fully encloses 2+ other blocks that day.
  const containerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of dates) {
      const day = events.filter(e => e.date === d && e.start_time && e.end_time);
      for (const e of day) {
        const inside = day.filter(o => o.id !== e.id && toMin(o.start_time) >= toMin(e.start_time) && toMin(o.end_time) <= toMin(e.end_time)
          && !(toMin(o.start_time) === toMin(e.start_time) && toMin(o.end_time) === toMin(e.end_time)));
        if (inside.length >= 2) ids.add(e.id);
      }
    }
    return ids;
  }, [events, dates]);
  // Join each lab row to its section (narrowest block claims first), per day.
  const sectionForEvent = useMemo(() => {
    const map = new Map<string, LabDay>();
    for (const date of dates) {
      const dayEvents = events.filter(e => e.date === date);
      const secs = visibleLabDays.filter(d => d.date === date);
      const claimed = new Set<string>();
      const span = (e: CalEvent) => toMin(e.end_time) - toMin(e.start_time);
      for (const e of [...dayEvents].sort((a, b) => span(a) - span(b))) {
        if (e.event_type !== 'lab' || containerIds.has(e.id)) continue;
        const d = secs.find(x => !claimed.has(x.id) && (e.linked_lab_day_id ? x.id === e.linked_lab_day_id : (x.section_number ?? 1) === (e.metadata?.linked_section_number ?? 1)));
        if (d) { claimed.add(d.id); map.set(e.id, d); }
      }
    }
    return map;
  }, [events, visibleLabDays, dates, containerIds]);
  const eventForSection = useMemo(() => {
    const m = new Map<string, string>();
    sectionForEvent.forEach((d, eid) => m.set(d.id, eid));
    return m;
  }, [sectionForEvent]);

  // ── Time engine: order + duration, not fixed start times ──
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  // Parked state lives on the block row (is_parked), so it survives refresh and is the same for everyone.
  const parked = useMemo(() => new Set(events.filter(e => e.metadata?.is_parked).map(e => e.id)), [events]);
  const baseOrder = useCallback((date: string) =>
    events.filter(e => e.date === date && !containerIds.has(e.id)).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '') || a.id.localeCompare(b.id)).map(e => e.id), [events, containerIds]);
  const orderFor = useCallback((date: string) => {
    const base = baseOrder(date);
    const saved = orderByDay[date];
    const ord = saved ? [...saved.filter(i => base.includes(i)), ...base.filter(i => !saved.includes(i))] : base;
    return [...ord.filter(i => !parked.has(i)), ...ord.filter(i => parked.has(i))]; // parked rows sit at the bottom
  }, [baseOrder, orderByDay, parked]);
  const DUR = useCallback((id: string) => Math.max(toMin(eventById.get(id)?.end_time) - toMin(eventById.get(id)?.start_time), 5), [eventById]);

  const layout = useMemo(() => {
    const out: Record<string, { at: number; delta: number; parked: boolean }> = {};
    const ends: Record<string, number> = {};
    for (const d of dates) {
      const ord = orderFor(d);
      const live = ord.filter(i => !parked.has(i)); const park = ord.filter(i => parked.has(i));
      const firstStart = events.filter(e => e.date === d && !containerIds.has(e.id)).map(e => toMin(e.start_time)).sort((a, b) => a - b)[0] ?? 0;
      // Forward-only cascade: a block's actual start sets a shift that carries to every LATER block; earlier
      // blocks keep their times, and each block keeps its own scheduled start so deliberate gaps survive.
      let shift = 0, clock = firstStart;
      for (const i of live) {
        const sched = toMin(eventById.get(i)?.start_time);
        const act = eventById.get(i)?.metadata?.actual_start_time;
        if (act) shift = toMin(act) - sched;
        out[i] = { at: sched + shift, delta: shift, parked: false };
        clock = Math.max(clock, sched + shift + DUR(i));
      }
      let pc = clock;
      for (const i of park) { out[i] = { at: pc, delta: 0, parked: true }; pc += DUR(i); }
      ends[d] = clock;
    }
    return { rows: out, ends };
  }, [dates, orderFor, parked, events, eventById, DUR, containerIds]);

  const moveRow = (date: string, id: string, beforeId: string | null) => {
    const ord = orderFor(date).filter(i => i !== id);
    const idx = beforeId ? ord.indexOf(beforeId) : ord.length;
    ord.splice(idx < 0 ? ord.length : idx, 0, id);
    setOrderByDay(p => ({ ...p, [date]: ord }));
    persistOrder(date, ord);
  };
  // Moving a block moves the real schedule: re-time the live (non-parked) sequence from the
  // day's first slot, carrying each positional gap over, and write start/end for every block whose slot changed ('this' = that dated block only).
  const persistOrder = (date: string, ord: string[]) => {
    const live = ord.filter(i => !parked.has(i));
    const firstSlot = Math.min(...live.map(i => toMin(eventById.get(i)?.start_time)).filter(n => n > 0), Infinity);
    if (!isFinite(firstSlot)) return;
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
    // Gaps stay where they were: the k-th gap between consecutive blocks is carried over positionally.
    const gaps = baseOrder(date).filter(i => !parked.has(i)).map((i, k, arr) => k + 1 < arr.length
      ? Math.max(toMin(eventById.get(arr[k + 1])?.start_time) - toMin(eventById.get(i)?.end_time), 0) : 0);
    let clock = firstSlot;
    const changes: { e: CalEvent; start: string; end: string }[] = [];
    live.forEach((i, k) => {
      const e = eventById.get(i);
      const start = fmt(clock), end = fmt(clock + DUR(i));
      if (e && e.linked_id && hhmm(e.start_time) !== hhmm(start)) changes.push({ e, start, end });
      clock += DUR(i) + (gaps[k] ?? 0);
    });
    if (!changes.length) return;
    const prev = new Map(changes.map(c => [c.e.id, { s: c.e.start_time, en: c.e.end_time }]));
    setEvents(p => p.map(x => { const c = changes.find(k => k.e.id === x.id); return c ? { ...x, start_time: c.start, end_time: c.end } : x; }));
    setOrderByDay(p => { const n = { ...p }; delete n[date]; return n; });
    setSaveError(null);
    Promise.all(changes.map(c => fetch(`/api/scheduling/planner/blocks/${c.e.linked_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: c.start, end_time: c.end, update_mode: 'this' }),
    }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); }))).catch(err => {
      setEvents(p => p.map(x => { const o = prev.get(x.id); return o ? { ...x, start_time: o.s, end_time: o.en } : x; }));
      setSaveError(`Could not save the new order (put back): ${err instanceof Error ? err.message : 'unknown error'}`);
    });
  };
  const parkRow = (date: string, id: string) => {
    const e = eventById.get(id); if (!e) return;
    const next = !parked.has(id);
    // Parking is persisted on the block (is_parked) only; it never re-times the real schedule.
    setEvents(p => p.map(x => x.id === id ? { ...x, metadata: { ...x.metadata, is_parked: next } } : x));
    setSaveError(null);
    if (!e.linked_id) return;
    fetch(`/api/scheduling/planner/blocks/${e.linked_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_parked: next, update_mode: 'this' }),
    }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); }).catch(err => {
      setEvents(p => p.map(x => x.id === id ? { ...x, metadata: { ...x.metadata, is_parked: !next } } : x));
      setSaveError(`Could not save parking for "${e.title}" (put back): ${err instanceof Error ? err.message : 'unknown error'}`);
    });
  };

  // ── Attendance (only editable field in Student progress) ──
  const absentIds = useMemo(() => {
    const days = visibleLabDays.filter(d => activeDate === 'all' || d.date === activeDate);
    if (!days.length) return new Set<string>();
    // Absent on ANY visible day counts as absent: an intersection hid a mark made on one day only
    // (e.g. via the Day 1 tab, or a half-failed Both-days save) so it looked like nothing was recorded.
    return new Set(days.flatMap(d => absentByLabDay[d.id] || []));
  }, [visibleLabDays, activeDate, absentByLabDay]);
  const toggleAbsent = useCallback(async (studentId: string) => {
    // "Both days" view marks/clears the student on every visible day; a single day only that day.
    const days = visibleLabDays.filter(d => activeDate === 'all' || d.date === activeDate);
    if (!days.length) return;
    const makeAbsent = !absentIds.has(studentId);
    setAbsentError(null);
    try {
      const results = await Promise.all(days.map(d => fetch(`/api/lab-management/lab-days/${d.id}/attendance`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, status: makeAbsent ? 'absent' : 'present' }),
      })));
      if (results.some(r => !r.ok)) throw new Error('save failed');
      setAbsentByLabDay(prev => {
        const next = { ...prev };
        for (const d of days) { const cur = new Set(next[d.id] || []); if (makeAbsent) cur.add(studentId); else cur.delete(studentId); next[d.id] = [...cur]; }
        return next;
      });
    } catch { setAbsentError('Could not save attendance. Refresh and try again.'); }
  }, [activeDate, visibleLabDays, absentIds]);

  // ── Overview fractions, scoped to the selected day(s) ──
  const todayStr = useMemo(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, [now]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isDone = useCallback((date: string, endMin: number) => date < todayStr || (date === todayStr && endMin <= nowMin), [todayStr, nowMin]);
  const overview = useMemo(() => {
    const scoped = events.filter(e => visibleDates.includes(e.date) && !containerIds.has(e.id) && !layout.rows[e.id]?.parked);
    const endOf = (e: CalEvent) => (layout.rows[e.id]?.at ?? toMin(e.start_time)) + DUR(e.id);
    const cls = scoped.filter(e => e.event_type !== 'lab');
    const lab = scoped.filter(e => e.event_type === 'lab');
    let rotTotal = 0, rotDone = 0;
    for (const e of lab) {
      const sec = sectionForEvent.get(e.id);
      const n = sec?.num_rotations ?? 0; if (!n) continue;
      rotTotal += n;
      const start = layout.rows[e.id]?.at ?? toMin(e.start_time);
      if (isDone(e.date, endOf(e))) rotDone += n;
      else if (e.date === todayStr && nowMin > start) rotDone += Math.min(n, Math.floor((nowMin - start) / Math.max(1, (endOf(e) - start) / n)));
    }
    const scopedAttempts = attempts.filter(a => { const d = visibleLabDays.find(x => x.id === a.lab_day_id); return d && visibleDates.includes(d.date); });
    const roster = groups.flatMap(g => g.members);
    const absent = roster.filter(s => absentIds.has(s.id)).length;
    return {
      cls: { done: cls.filter(e => isDone(e.date, endOf(e))).length, total: cls.length },
      lab: { done: lab.filter(e => isDone(e.date, endOf(e))).length, total: lab.length },
      rot: { done: rotDone, total: rotTotal },
      students: roster.length - absent, absent,
      passed: scopedAttempts.filter(a => a.overall_result === 'pass').length,
      failed: scopedAttempts.filter(a => a.overall_result === 'fail').length,
      scopedAttempts,
    };
  }, [events, visibleDates, containerIds, layout, DUR, sectionForEvent, isDone, todayStr, nowMin, attempts, visibleLabDays, groups, absentIds]);

  // In-place room / instructor change on a station tile (same PATCH the editor uses, only those fields).
  const saveStation = useCallback(async (st: Station, patch: { room?: string | null; instructor_name?: string | null; instructor_email?: string | null }) => {
    setSaveError(null);
    try {
      const res = await fetch(`/api/lab-management/stations/${st.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
      setLabDays(prev => prev.map(d => d.id !== st.lab_day_id ? d : { ...d, stations: d.stations.map(x => x.id !== st.id ? x : {
        ...x, ...('room' in patch ? { room: patch.room ?? null } : {}), ...('instructor_name' in patch ? { instructor_name: patch.instructor_name ?? null } : {}) }) }));
    } catch (err) { setSaveError(`Could not save station ${st.station_number}: ${err instanceof Error ? err.message : 'unknown error'}`); }
  }, []);

  // ── Station editing: open the existing EditStationModal for one station ──
  const openEditor = async (labDayId: string, stationId: string) => {
    try {
      const d = await (await fetch(`/api/lab-management/lab-days/${labDayId}`)).json();
      const st = d.success ? (d.labDay?.stations || []).find((s: FullStation) => s.id === stationId) : null;
      if (!st) { setSaveError('Could not open the station editor.'); return; }
      setEditing({ station: st, labDay: d.labDay });
    } catch { setSaveError('Could not open the station editor.'); }
  };
  const calEmails = useMemo(() => {
    const emails = new Set<string>();
    editing?.labDay.stations?.forEach(st => { if (st.instructor_email) emails.add(st.instructor_email.toLowerCase()); });
    fullInstructors.forEach(i => { if (i.email) emails.add(i.email.toLowerCase()); });
    return Array.from(emails);
  }, [editing, fullInstructors]);
  const { availability: calendarAvailability } = useCalendarAvailability(
    editing?.labDay.date || null, calEmails,
    editing?.labDay.start_time?.substring(0, 5) || '08:00', editing?.labDay.end_time?.substring(0, 5) || '17:00');
  useEffect(() => {
    const ld = editing?.labDay; if (!ld?.date || !ld?.id) return;
    fetch(`/api/lab-management/instructor-availability?date=${ld.date}&start_time=${ld.start_time || '08:00:00'}&end_time=${ld.end_time || '17:00:00'}&lab_day_id=${ld.id}`)
      .then(r => r.json()).then(d => { if (d.success) setInstructorAvailability(d.instructors || []); }).catch(() => {});
  }, [editing?.labDay]);

  const rowNames = (e: CalEvent) => {
    const direct = [e.metadata?.instructor_id, e.metadata?.additional_instructor_id].map(id => instructorOpts.find(i => i.id === id)?.name).filter(Boolean) as string[];
    return [...new Set([...direct, ...(e.instructor_names || [])])];
  };

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  if (!session) return null;
  const cohortLabel = cohort ? `${cohort.program?.abbreviation || ''} G${cohort.cohort_number ?? ''}`.trim() : '';

  // ───────────────────────── regions ─────────────────────────
  const renderOverview = () => (
    <div className="grid grid-cols-6 max-lg:grid-cols-3 max-sm:grid-cols-2 gap-3">
      <Tile label="Class + video blocks" value={`${overview.cls.done}/${overview.cls.total}`} bar={overview.cls} />
      <Tile label="Lab blocks" value={`${overview.lab.done}/${overview.lab.total}`} bar={overview.lab} />
      <Tile label="Lab rotations" value={`${overview.rot.done}/${overview.rot.total}`} bar={overview.rot} />
      <Tile label={overview.absent > 0 ? `Students (${overview.absent} absent)` : 'Students'} value={overview.students} />
      <Tile label="Passed" value={overview.passed} tone="text-green-600 dark:text-green-400" />
      <Tile label="Failed" value={overview.failed} tone="text-red-600 dark:text-red-400" />
    </div>
  );

  const renderScheduleRow = (date: string, id: string) => {
    const e = eventById.get(id); if (!e) return null;
    const L = layout.rows[id]; const dur = DUR(id);
    const editable = e.source === 'planner' && !!e.linked_id;
    const sec = sectionForEvent.get(id);
    const isLab = e.event_type === 'lab';
    const selected = !!sec && selectedSection === sec.id;
    const actual = e.metadata?.actual_start_time;
    const busy = savingBlock === e.id;
    const inputCls = 'text-xs min-h-[36px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1';
    return (
      <div key={id}
        draggable={runMode}
        onDragStart={() => { dragId.current = id; }}
        onDragOver={(ev) => { if (runMode) ev.preventDefault(); }}
        onDrop={() => { if (runMode && dragId.current && dragId.current !== id) moveRow(date, dragId.current, id); dragId.current = null; }}
        onClick={() => { if (sec) setSelectedSection(s => (s === sec.id ? null : sec.id)); }}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${L?.parked ? 'opacity-50' : ''} ${selected ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-400' : ''} ${isLab ? 'cursor-pointer' : ''}`}>
        {runMode && <GripVertical className="w-4 h-4 text-gray-400 cursor-grab shrink-0" aria-hidden />}
        <span className="font-mono text-xs text-gray-600 dark:text-gray-300 w-14 shrink-0">{fmt(L?.at ?? toMin(e.start_time))}</span>
        <span className="flex-1 min-w-[10rem] text-gray-800 dark:text-gray-100">{e.title}{L?.parked && <span className="ml-2 text-[10px] uppercase text-gray-400">parked</span>}</span>
        {runMode && (
          <span className="flex items-center gap-2" onClick={ev => ev.stopPropagation()}>
            <span className="text-[11px] text-gray-400">{dur} min</span>
            {editable && (
              <label className="text-[11px] text-gray-500 flex items-center gap-1">Actual
                <input type="time" aria-label={`Actual start for ${e.title}`} key={`a-${id}-${actual}`} defaultValue={hhmm(actual)}
                  onBlur={(ev) => { const v = ev.target.value; if (v !== hhmm(actual)) saveBlock(e, { actual_start_time: v ? `${v}:00` : null }); }}
                  className={`${inputCls} w-28 font-semibold`} />
              </label>
            )}
            {L && !L.parked && L.delta !== 0 && (
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${L.delta > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                {L.delta > 0 ? `+${L.delta}` : L.delta}
              </span>
            )}
            <button type="button" onClick={() => parkRow(date, id)} className="inline-flex items-center gap-1 text-xs px-2 min-h-[32px] rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
              <ParkingSquare className="w-3.5 h-3.5" />{L?.parked ? 'Unpark' : 'Park'}
            </button>
          </span>
        )}
        <span onClick={ev => ev.stopPropagation()} className="shrink-0">
          {editable ? (
            <select aria-label={`Instructor for ${e.title}`} value={e.metadata?.instructor_id || ''} disabled={busy}
              onChange={(ev) => saveBlock(e, { instructor_id: ev.target.value || null })} className={`${inputCls} w-44`}>
              <option value="">Instructor: —</option>
              {instructorOpts.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          ) : (rowNames(e).length > 0 && <span className="text-xs text-gray-500">{rowNames(e).join(', ')}</span>)}
          {busy && <Loader2 className="inline w-3.5 h-3.5 animate-spin text-gray-400 ml-1" />}
        </span>
      </div>
    );
  };

  // Station tiles for one lab section. nested = true when shown under its schedule row (Stations region removed).
  const renderStationTiles = (d: LabDay) => (
    <>
    <div className="flex items-center justify-end mt-3">
      <button type="button" onClick={() => setTimerFor(d)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 min-h-[36px] rounded border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
        <Timer className="w-4 h-4" /> Rotation timer — {d.section_label || d.title || 'section'}
      </button>
    </div>
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-2.5 my-3">
      {d.stations.map(st => {
        const learning = st.scenario?.cert_tier === 'learning_station';
        const caseName = st.scenario?.title ? `${st.scenario.case_code ? `${st.scenario.case_code.replace(/^CASE_/i, 'Case ').replace(/_/g, ' ')} - ` : ''}${st.scenario.title}` : st.scenario?.case_code || st.custom_title || '—';
        const category = st.scenario?.category;
        const tag = learning ? 'learning' : d.is_adv_cert_testing ? 'megacode' : 'station';
        // Day-level value is what the rotation timer reads; station-level is a uniform generator default (30x4) that disagrees.
        const mins = d.rotation_duration ?? st.rotation_minutes;
        const qs = searchParams.toString();
        const href = withReturnTo(learning ? `/labs/adv-cert/learning-station?labDayId=${d.id}&stationId=${st.id}` : `/labs/adv-cert/grade?labDayId=${d.id}&stationId=${st.id}`, `/labs/acls-hub/board${qs ? `?${qs}` : ''}`);
        return (
          <div key={st.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Station {st.station_number}</span>
              <span className="text-[10px] lowercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">{tag}</span>
            </div>
            {category && <span className="self-start text-[10px] lowercase px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">{category}</span>}
            <div className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{caseName}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">{[mins ? `${mins} min` : null, st.station_notes].filter(Boolean).join(' · ') || ' '}</div>
            <select aria-label={`Room for station ${st.station_number}`} value={st.room || ''}
              onChange={ev => saveStation(st, { room: ev.target.value || null })}
              className="text-xs min-h-[36px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1">
              <option value="">Room: —</option>
              {st.room && !locations.some(l => l.name === st.room) && <option value={st.room}>{st.room}</option>}
              {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
            <select aria-label={`Instructor for station ${st.station_number}`} value={st.instructor_name || ''}
              onChange={ev => { const i = fullInstructors.find(x => x.name === ev.target.value); saveStation(st, { instructor_name: i?.name || null, instructor_email: i?.email || null }); }}
              className="text-xs min-h-[36px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1">
              <option value="">Instructor: —</option>
              {st.instructor_name && !fullInstructors.some(i => i.name === st.instructor_name) && <option value={st.instructor_name}>{st.instructor_name}</option>}
              {fullInstructors.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
            <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => openEditor(d.id, st.id)} className="text-[11px] px-2 min-h-[28px] rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Edit station</button>
            <Link href={href} className="self-end text-[11px] px-2 min-h-[28px] inline-flex items-center rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20">
              Grade
            </Link>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );

  const stationsOn = regions.find(r => r.id === 'stations')?.on !== false;
  const skillsRow = (d: LabDay) => /\b(airway|bls)\b/i.test(`${d.section_label || ''} ${d.title || ''}`);

  const renderSchedule = () => (
    <div className="space-y-4">
      {visibleDates.map(date => {
        const ord = orderFor(date);
        const sections = visibleLabDays.filter(d => d.date === date);
        const unmatched = sections.filter(d => !eventForSection.has(d.id));
        return (
          <section key={date}>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Day {dayNo(date)} — {prettyDate(date)}</h3>
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">ends {fmt(layout.ends[date] ?? 0)}</span>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {ord.length === 0 && <div className="p-3 text-xs text-gray-400">No schedule blocks found for this day.</div>}
              {ord.map(id => {
                const sec = sectionForEvent.get(id);
                return (
                  <div key={id}>
                    {renderScheduleRow(date, id)}
                    {!stationsOn && sec && !skillsRow(sec) && sec.stations.length > 0 && <div className="px-3 pb-2 pl-6 pt-1">{renderStationTiles(sec)}</div>}
                  </div>
                );
              })}
            </div>
            {!stationsOn && unmatched.filter(d => !skillsRow(d) && d.stations.length).map(d => (
              <div key={d.id} className="mt-2"><div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{d.section_label || d.title || 'Lab'}</div>{renderStationTiles(d)}</div>
            ))}
          </section>
        );
      })}
    </div>
  );

  const renderStations = () => (
    <div className="space-y-5">
      {visibleDates.map(date => {
        const secs = visibleLabDays.filter(d => d.date === date && !skillsRow(d) && d.stations.length > 0)
          .sort((a, b) => (layout.rows[eventForSection.get(a.id) || '']?.at ?? toMin(a.start_time)) - (layout.rows[eventForSection.get(b.id) || '']?.at ?? toMin(b.start_time)));
        return (
          <section key={date} className="space-y-3">
            {visibleDates.length > 1 && <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Day {dayNo(date)}</h3>}
            {secs.length === 0 && <div className="text-xs text-gray-400">No station sections for this day.</div>}
            {secs.map(d => (
              <div key={d.id} onClick={() => setSelectedSection(s => (s === d.id ? null : d.id))}
                className={`rounded-xl p-2 -m-2 ${selectedSection === d.id ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-400' : ''}`}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{d.section_label || d.title || 'Lab'}</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{d.num_rotations ?? d.stations.length} rotations</span>
                </div>
                <div onClick={ev => ev.stopPropagation()}>{renderStationTiles(d)}</div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );

  // Megacode result per student: scored attempts they led or took part in. Three states by design.
  const resultFor = (studentId: string) => {
    const list = overview.scopedAttempts.filter(a => a.team_lead?.id === studentId || (a.students || []).some(s => s.student_id === studentId));
    const best = list.find(a => a.overall_result === 'pass') || list[0];
    const state: 'pass' | 'watch' | 'fail' | 'none' = !best ? 'none' : best.overall_result === 'pass' ? 'pass' : best.overall_result === 'fail' ? 'fail' : 'watch';
    return { list, state };
  };
  const watchN = (id: string) => watchMarks.filter(k => k.student_id === id && k.mark === 'watch' && visibleLabDays.some(d => d.id === k.lab_day_id && visibleDates.includes(d.date))).length;
  const openRecord = (a: Attempt) => router.push(`/labs/schedule/${a.lab_day_id}/acls-coordinator`);

  const renderProgress = () => {
    const rows = groups.flatMap(g => g.members.map(m => ({ m, g })));
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 items-start">
          {groups.map(g => (
            <div key={g.id} className="w-fit max-w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">{g.name}</div>
              <div className="flex flex-nowrap gap-1 whitespace-nowrap">
                {g.members.map(m => (
                  <span key={m.id} className={`text-[11px] px-1.5 py-0.5 rounded-full ${absentIds.has(m.id) ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 line-through decoration-2 opacity-60' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{m.last_name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="min-w-0 overflow-x-auto">
          {absentError && <div role="alert" className="mb-2 text-xs text-red-700 dark:text-red-300">{absentError}</div>}
          <table className="w-full text-sm whitespace-nowrap">
            <thead><tr className="text-left text-[11px] uppercase text-gray-500 dark:text-gray-400">
              <th className="py-1 pr-2">Student</th><th className="py-1 pr-2">Grp</th><th className="py-1 pr-2">Attend</th><th className="py-1">Megacode result</th>
            </tr></thead>
            <tbody>
              {rows.map(({ m, g }) => {
                const absent = absentIds.has(m.id);
                const r = resultFor(m.id);
                return (
                  <tr key={m.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className={`py-1 pr-2 ${absent ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}`}>{fullName(m)}
                      {!absent && watchN(m.id) > 0 && <span title="Learning-station watch marks (Pass/Watch tracker)" className="ml-2 no-underline"><Chip state="watch" /> <span className="text-[11px] text-amber-700 dark:text-amber-300">{watchN(m.id)}</span></span>}
                    </td>
                    <td className="py-1 pr-2 text-xs text-gray-500">{g.name.replace(/^group\s*/i, '')}</td>
                    <td className="py-1 pr-2">
                      <button type="button" onClick={() => toggleAbsent(m.id)}
                        title={`${absent ? 'Mark here' : 'Mark absent'}${activeDate === 'all' ? ' (both days)' : ''}`}
                        className={`text-xs px-2 min-h-[32px] rounded border ${absent ? 'border-gray-400 text-gray-500' : 'border-emerald-500 text-emerald-700 dark:text-emerald-300'}`}>
                        {absent ? 'Absent' : 'Here'}
                      </button>
                    </td>
                    <td className="py-1">
                      {r.list.length === 0 ? <Chip state="none" /> : (
                        <button type="button" onClick={() => (r.list.length === 1 ? openRecord(r.list[0]) : setAttemptPicker({ studentId: m.id, list: r.list }))} aria-label={`Open grading record for ${fullName(m)}`}>
                          <Chip state={r.state} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-gray-400">Attendance is the only editable field. Results open the grading record.</p>
        </div>
      </div>
    );
  };

  const body: Record<RegionId, () => React.ReactNode> = { overview: renderOverview, schedule: renderSchedule, stations: renderStations, progress: renderProgress };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full px-4 py-3">
        <div className="print:hidden">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/labs/aha-hub" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"><ArrowLeft className="w-4 h-4" /> AHA Hub (ACLS + PALS)</Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ACLS Board</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{cohortLabel}{dates.length ? ` · ${dates.map(prettyDate).join(' + ')}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><Printer className="w-3.5 h-3.5" /> Print</button>
            </div>
          </div>
          {courseOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">Course:</span>
              {courseOptions.map(c => (
                <Link key={c.id} href={`/labs/acls-hub/board?cohortId=${c.id}`}
                  className={`px-3 min-h-[36px] inline-flex items-center rounded-md text-sm border ${cohort?.id === c.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}>{c.label}</Link>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {dates.length > 1 && (
              <div className="flex gap-1">
                <button onClick={() => setActiveDate('all')} className={`px-3 py-1 text-xs rounded-md border ${activeDate === 'all' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 dark:border-gray-600'}`}>Both days</button>
                {dates.map((d, i) => (
                  <button key={d} onClick={() => setActiveDate(d)} className={`px-3 py-1 text-xs rounded-md border ${activeDate === d ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 dark:border-gray-600'}`}>Day {i + 1}</button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400" aria-label="Arrange regions">
              {regions.map((r, i) => (
                <span key={r.id} className="inline-flex items-center gap-0.5 rounded border border-gray-300 dark:border-gray-600 px-1">
                  <input type="checkbox" aria-label={`Show ${r.t}`} checked={r.on} onChange={() => updateRegions(regions.map(x => x.id === r.id ? { ...x, on: !x.on } : x))} />
                  <span className="px-0.5">{r.t}</span>
                  <button aria-label={`Move ${r.t} earlier`} disabled={i === 0} onClick={() => { const n = [...regions]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; updateRegions(n); }} className="disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                  <button aria-label={`Move ${r.t} later`} disabled={i === regions.length - 1} onClick={() => { const n = [...regions]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; updateRegions(n); }} className="disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>
          {saveError && <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">{saveError}</div>}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !cohort ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">No ACLS event found.</div>
        ) : (
          <div className="grid grid-cols-12 max-lg:grid-cols-1 gap-3 print:hidden">
            {regions.filter(r => r.on).map(r => (
              <section key={r.id} aria-label={r.t} className={`${SPAN_CLASS[r.span] || 'col-span-12'} max-lg:col-span-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 min-w-0`}>
                <h2 className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">{r.t}</h2>
                <div className="p-3">{body[r.id]()}</div>
              </section>
            ))}
          </div>
        )}
        {/* PRINT-ONLY HANDOUT: the selected day's schedule only (Both days = one page per day). Renders the
            already-computed board times, so paper matches the screen. Presentation only; no data touched. */}
        <div className="hidden print:block text-black acls-board-print">
          <style>{`@media print {
            @page { margin: 0.5in; size: letter portrait; }
            html, body { background: #fff !important; }
            .acls-board-print table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .acls-board-print th, .acls-board-print td { border: 1px solid #000; padding: 4px 8px; text-align: left; vertical-align: top; font-size: 12pt; line-height: 1.3; }
            .acls-board-print th { background: #e5e5e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; }
          }`}</style>
          {cohort && visibleDates.map((date, di) => {
            const rows = orderFor(date).filter(id => !layout.rows[id]?.parked);
            const first = rows.length ? layout.rows[rows[0]]?.at : null;
            const secs = visibleLabDays.filter(d => d.date === date && !skillsRow(d) && d.stations.length > 0)
              .sort((a, b) => toMin(a.start_time) - toMin(b.start_time) || (a.section_number ?? 1) - (b.section_number ?? 1));
            return (
              <div key={date} style={{ breakBefore: di > 0 ? 'page' : 'auto' }}>
                <h1 className="text-2xl font-bold">ACLS Course Schedule — {cohortLabel}</h1>
                <h2 className="text-lg font-bold mb-1">Day {dayNo(date)} — {prettyDate(date)}{first != null ? ` · ${fmt(first)}–${fmt(layout.ends[date])}` : ''}</h2>
                <table>
                  <thead><tr><th style={{ width: '120px' }}>Time</th><th>Block</th><th style={{ width: '170px' }}>Instructor</th></tr></thead>
                  <tbody>
                    {rows.length === 0
                      ? <tr><td colSpan={3}>No schedule blocks.</td></tr>
                      : rows.map(id => {
                        const e = eventById.get(id); const at = layout.rows[id]?.at;
                        if (!e || at == null) return null;
                        return (
                          <tr key={id} style={{ breakInside: 'avoid' }}>
                            <td>{fmt(at)}–{fmt(at + DUR(id))}</td>
                            <td>{e.title}</td>
                            <td>{rowNames(e).join(', ')}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {secs.length > 0 && (
                  <div>
                    <h3 className="text-base font-bold mt-3 mb-1">Station plan</h3>
                    {secs.map(s => (
                      <div key={s.id} style={{ breakInside: 'avoid' }}>
                        <div className="font-semibold">{s.section_label || s.title || 'Lab'}{s.start_time ? ` · ${hhmm(s.start_time)}–${hhmm(s.end_time)}` : ''}</div>
                        <table>
                          <thead><tr><th style={{ width: '40px' }}>#</th><th style={{ width: '130px' }}>Room</th><th>Case</th><th style={{ width: '170px' }}>Instructor</th></tr></thead>
                          <tbody>
                            {s.stations.map(st => (
                              <tr key={st.id}>
                                <td>{st.station_number}</td>
                                <td>{st.room || ''}</td>
                                <td>{st.scenario?.title ? `${st.scenario.case_code ? `${st.scenario.case_code.replace(/^CASE_/i, 'Case ').replace(/_/g, ' ')} - ` : ''}${st.scenario.title}` : st.scenario?.case_code || st.custom_title || ''}</td>
                                <td>{st.instructor_name || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {attemptPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAttemptPicker(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Which attempt?</div>
            {attemptPicker.list.map(a => (
              <button key={a.id} onClick={() => { setAttemptPicker(null); openRecord(a); }}
                className="w-full text-left text-sm min-h-[44px] px-3 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between">
                <span>{a.scenario?.case_code || a.scenario?.name || 'Megacode'} · {new Date(a.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="flex items-center gap-1"><Chip state={a.overall_result === 'pass' ? 'pass' : a.overall_result === 'fail' ? 'fail' : 'watch'} /><ChevronRight className="w-3 h-3" /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {timerFor && (
        <LabTimer labDayId={timerFor.id} numRotations={timerFor.num_rotations || timerFor.stations.length || 1} rotationMinutes={timerFor.rotation_duration || 10} onClose={() => setTimerFor(null)} isController={true} />
      )}
      {editing && (
        <EditStationModal
          station={editing.station}
          labDay={editing.labDay}
          instructors={fullInstructors}
          locations={locations}
          calendarAvailability={calendarAvailability}
          instructorAvailability={instructorAvailability}
          session={session}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

export default function AclsBoardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gray-400" /></div>}>
      <BoardContent />
    </Suspense>
  );
}
