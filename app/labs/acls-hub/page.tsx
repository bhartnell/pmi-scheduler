'use client';

/**
 * ACLS Hub — additive, READ-ONLY aggregator for the full ACLS event.
 *
 * Consolidates the scattered surfaces (planner / calendar / lab-day / coordinator)
 * into one accessible section for the instructor group running ACLS:
 *   - Day 1 / Day 2 schedule (didactic + labs together), legible day view
 *   - Lab sections per day with links to the per-station / coordinator detail
 *   - Coordinator stats AGGREGATED across BOTH days + ALL sections (the fix for
 *     the single-lab-day-scoped coordinator view)
 *   - By-instructor view + a clean print option
 *
 * Reads existing sources only: /api/adv-cert/acls-hub (sections + groups +
 * attempts) and /api/calendar/unified (schedule). Writes nothing. The existing
 * surfaces remain the fallback.
 */

import StatTile from '@/components/StatTile';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { RegionShell, RegionGrid, Region } from '@/components/layout/RegionShell';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, RefreshCw, Printer, CheckCircle2, XCircle, Clock,
  Users, UserCheck, MapPin, CalendarDays, Layers, GraduationCap,
} from 'lucide-react';

// Sections are displayed in time order. section_number is an identifier
// (referenced by pmi_schedule_blocks.linked_section_number), NOT a sort key.
const bySectionTime = (
  a: { start_time: string | null; section_number: number | null },
  b: { start_time: string | null; section_number: number | null },
) => {
  if (a.start_time && b.start_time && a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
  if (a.start_time && !b.start_time) return -1;
  if (!a.start_time && b.start_time) return 1;
  return (a.section_number ?? 1) - (b.section_number ?? 1);
};

interface Member { id: string; first_name: string; last_name: string }
interface Group { id: string; name: string; members: Member[] }
interface Station {
  id: string; lab_day_id: string; station_number: number; custom_title: string | null;
  room: string | null; instructor_name: string | null; station_notes: string | null;
  scenario?: { id: string; title: string; case_code: string | null } | null;
}
interface LabDay {
  id: string; date: string; section_number: number | null; section_label: string | null;
  title: string | null; start_time: string | null; end_time: string | null;
  lab_mode: string | null; is_adv_cert_testing: boolean; stations: Station[];
}
interface Attempt {
  id: string; lab_day_id: string; lab_group_id: string; overall_result: string;
  started_at: string; team_lead?: { id: string; first_name: string; last_name: string } | null;
  scenario?: { id: string; name: string; case_code: string | null } | null;
}
interface CalEvent {
  id: string; title: string; date: string; start_time: string | null; end_time: string | null;
  event_type: string; instructor_names?: string[]; room?: string; linked_url?: string; status?: string;
  source?: string; linked_id?: string; linked_lab_day_id?: string; content_notes?: string;
  metadata?: { instructor_id?: string | null; additional_instructor_id?: string | null; linked_section_number?: number | null };
}
interface InstructorOpt { id: string; name: string }

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const sname = (s?: { first_name: string; last_name: string } | null) => (s ? `${s.first_name} ${s.last_name}` : '—');
const prettyDate = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); } catch { return d; } };

const TYPE_COLOR: Record<string, string> = {
  lab: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  class: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  exam: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
};

function AclsHubPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cohort, setCohort] = useState<any>(null);
  const [courseOptions, setCourseOptions] = useState<{ id: string; label: string; dates: string[] }[]>([]);
  const cohortIdParam = searchParams.get('cohortId');
  const [dates, setDates] = useState<string[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string>('all');
  const [instructorOpts, setInstructorOpts] = useState<InstructorOpt[]>([]);
  const [savingBlock, setSavingBlock] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

  // Deep-link: ?date=YYYY-MM-DD (from the calendar's "Open ACLS Hub"
  // button) pre-selects that day's tab once the real dates are known.
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && dates.includes(dateParam)) setActiveDate(dateParam);
  }, [searchParams, dates]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hubRes = await fetch(cohortIdParam ? `/api/adv-cert/acls-hub?cohortId=${encodeURIComponent(cohortIdParam)}` : '/api/adv-cert/acls-hub');
      const hub = await hubRes.json();
      if (hub.success) {
        setCohort(hub.cohort);
        setDates(hub.dates || []);
        setLabDays(hub.labDays || []);
        setGroups(hub.groups || []);
        setAttempts(hub.attempts || []);
        // Schedule (didactic + labs) from the unified aggregator.
        if (hub.cohort?.id && (hub.dates || []).length) {
          const start = hub.dates[0];
          const end = hub.dates[hub.dates.length - 1];
          const uRes = await fetch(`/api/calendar/unified?cohort_id=${hub.cohort.id}&start=${start}&end=${end}&include=classes,labs,exams`);
          const u = await uRes.json();
          setEvents((u.events || []).filter((e: CalEvent) => hub.dates.includes(e.date) && e.status !== 'cancelled'));
        } else {
          setEvents([]);
        }
      }
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [cohortIdParam]);

  useEffect(() => { if (status === 'authenticated') load(); }, [load, status]);

  // Course picker: every cohort running this course (same source as the AHA Hub).
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/adv-cert/aha-hub')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setCourseOptions((d.courses?.acls || [])
          .filter((c: any) => c.cohort?.id)
          .map((c: any) => ({
            id: c.cohort.id,
            label: `${c.cohort.program?.abbreviation || ''} G${c.cohort.cohort_number ?? ''}`.trim(),
            dates: c.dates || [],
          })));
      })
      .catch(() => {});
  }, [status]);

  // Standard instructor list — same source the lab-day station dropdown uses.
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/lab-management/instructors')
      .then((r) => r.json())
      .then((d) => { if (d.success) setInstructorOpts(d.instructors || []); })
      .catch(() => {});
  }, [status]);

  // Persist one schedule-block field (instructor / co-instructor / note) via the
  // existing planner block PUT, then mirror it into local state. 'this' mode:
  // edits this one dated block only, never a recurring series.
  const saveBlock = useCallback(async (e: CalEvent, patch: Record<string, string | null>) => {
    if (!e.linked_id) return;
    setSavingBlock(e.id);
    setSaveError(null);
    try {
      const res = await fetch(`/api/scheduling/planner/blocks/${e.linked_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, update_mode: 'this' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setEvents((prev) => prev.map((x) => {
        if (x.id !== e.id) return x;
        const next: CalEvent = { ...x, metadata: { ...x.metadata } };
        if ('instructor_id' in patch) next.metadata!.instructor_id = patch.instructor_id || null;
        if ('additional_instructor_id' in patch) next.metadata!.additional_instructor_id = patch.additional_instructor_id || null;
        if ('content_notes' in patch) next.content_notes = patch.content_notes || undefined;
        return next;
      }));
    } catch (err) {
      setSaveError(`Could not save "${e.title}": ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSavingBlock(null);
    }
  }, []);

  // Names for a schedule row: legacy many-to-many names + the direct-FK slots
  // this hub now edits (so the print sheet and read-only rows show them too).
  const rowInstructorNames = useCallback((e: CalEvent) => {
    const direct = [e.metadata?.instructor_id, e.metadata?.additional_instructor_id]
      .map((id) => instructorOpts.find((i) => i.id === id)?.name)
      .filter(Boolean) as string[];
    return [...new Set([...direct, ...(e.instructor_names || [])])];
  }, [instructorOpts]);

  const visibleDates = activeDate === 'all' ? dates : dates.filter(d => d === activeDate);

  // Hide the leftover MONOLITHIC section-1 day (the old one-lab-per-day fallback)
  // from the hub WHEN that date has been split into real sections — it's a
  // confusing duplicate. It stays in the DB as the grading fallback; we just
  // don't render/count it here. A date with only section 1 (an unsectioned ACLS
  // day) still shows.
  const visibleLabDays = useMemo(() => {
    const sectionedDates = new Set(
      labDays.filter(d => (d.section_number ?? 1) > 1).map(d => d.date)
    );
    return labDays.filter(d => !((d.section_number ?? 1) === 1 && sectionedDates.has(d.date)));
  }, [labDays]);

  // MEGACODE-ONLY scope for this view: ACLS passing is about megacode team-lead
  // experience, so the hub counts team-leads from the megacode sections only
  // (practice — now testing-graded — + final testing), NOT brady/tachy or
  // cardiac-arrest learning. (The semester/course overview tracks ALL TLs.)
  const megacodeLabDayIds = useMemo(() => new Set(
    visibleLabDays
      .filter(d => d.is_adv_cert_testing || (d.section_label || '').toLowerCase().includes('megacode'))
      .map(d => d.id)
  ), [visibleLabDays]);
  const megAttempts = useMemo(
    () => attempts.filter(a => megacodeLabDayIds.has(a.lab_day_id)),
    [attempts, megacodeLabDayIds]
  );

  const stats = useMemo(() => {
    const passed = megAttempts.filter(a => a.overall_result === 'pass').length;
    const failed = megAttempts.filter(a => a.overall_result === 'fail').length;
    const groupsTested = new Set(megAttempts.map(a => a.lab_group_id)).size;
    // "Passed as TL" = led a PASS megacode (practice OR testing — both count
    // toward the AHA team-lead distinction).
    const passedTLIds = new Set(
      megAttempts.filter(a => a.overall_result === 'pass').map(a => a.team_lead?.id).filter(Boolean) as string[]
    );
    // Attempted as TL but with no pass yet (explicit failure marker).
    const failedTLIds = new Set(
      megAttempts.filter(a => a.overall_result === 'fail').map(a => a.team_lead?.id).filter(Boolean) as string[]
    );
    const allStudents = groups.flatMap(g => g.members);
    const passedTLCount = allStudents.filter(s => passedTLIds.has(s.id)).length;
    // Failure/not-yet marker: who has NOT passed megacode as TL.
    const notPassed = allStudents
      .filter(s => !passedTLIds.has(s.id))
      .map(s => ({ ...s, failed: failedTLIds.has(s.id) }));
    const sections = visibleLabDays.filter(d => (d.section_number ?? 1) > 1).length;
    return {
      passed, failed, groupsTested, totalGroups: groups.length,
      passedTLIds, totalStudents: allStudents.length, passedTLCount, notPassed,
      sections, labDaysCount: visibleLabDays.length, totalAttempts: megAttempts.length,
    };
  }, [megAttempts, groups, visibleLabDays]);

  const attemptsByGroup = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of megAttempts) { (m.get(a.lab_group_id) || m.set(a.lab_group_id, []).get(a.lab_group_id)!).push(a); }
    return m;
  }, [megAttempts]);

  // By-instructor: every station assignment across all sections, grouped by name.
  const byInstructor = useMemo(() => {
    const m = new Map<string, { date: string; section: string; station: number; room: string | null; title: string }[]>();
    for (const d of visibleLabDays) {
      for (const st of d.stations) {
        const name = st.instructor_name?.trim();
        if (!name) continue;
        const arr = m.get(name) || [];
        arr.push({
          date: d.date,
          section: d.section_label || (d.section_number && d.section_number > 1 ? `Section ${d.section_number}` : 'Main'),
          station: st.station_number,
          room: st.room,
          title: st.scenario?.case_code || st.scenario?.title || st.custom_title || `Station ${st.station_number}`,
        });
        m.set(name, arr);
      }
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleLabDays]);

  // One lab section (its station cards + attempt tally). Nested under its
  // schedule row when linked; standalone when no schedule row matches.
  // BLS / Airway are schedule rows only (Ben 2026-10-02): time + instructors,
  // no station tiles, Open/Assign/Tracker, or capture. The AHA PDF print shows
  // completion. Display-only: the lab_days sections and stations stay in place.
  const isSkillsRow = (d: LabDay) => /\b(airway|bls)\b/i.test(`${d.section_label || ''} ${d.title || ''}`);
  const renderSection = (d: LabDay) => {
    if (isSkillsRow(d)) {
      const names = [...new Set(d.stations.map(st => st.instructor_name?.trim()).filter(Boolean))];
      return (
        <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{d.section_label || d.title}</span>
          <span className="text-xs text-gray-400">{hhmm(d.start_time)}–{hhmm(d.end_time)}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{names.length ? names.join(', ') : '— no instructor assigned —'}</span>
        </div>
      );
    }
    const isSection = (d.section_number ?? 1) > 1;
    const dAttempts = attempts.filter(a => a.lab_day_id === d.id);
    return (
      <div key={d.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
            {isSection ? <Layers className="w-4 h-4 text-indigo-500" /> : <Clock className="w-4 h-4 text-gray-400" />}
            {d.section_label || d.title || 'Lab'}
            <span className="text-xs text-gray-400">{hhmm(d.start_time)}–{hhmm(d.end_time)} · {d.stations.length} stations{d.is_adv_cert_testing ? ' · scored' : ''}</span>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <Link href={`/labs/schedule/${d.id}`} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Open</Link>
            <Link href={`/labs/schedule/${d.id}/edit`} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Assign</Link>
            <Link href={`/labs/schedule/${d.id}/acls-coordinator`} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Tracker</Link>
          </div>
        </div>
        {/* Stations */}
        {d.stations.length > 0 && (
          <div className="mt-2 grid grid-cols-2 max-sm:grid-cols-1 gap-1.5">
            {d.stations.map(st => (
              <Link
                key={st.id}
                href={`/labs/adv-cert/grade?labDayId=${d.id}&stationId=${st.id}`}
                className="block text-xs border border-gray-100 dark:border-gray-700 rounded p-1.5 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"
              >
                <div className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400" />#{st.station_number} {st.room || ''}
                </div>
                <div className="text-gray-500 dark:text-gray-400">{st.scenario?.case_code || st.scenario?.title || st.custom_title || '—'}</div>
                <div className="text-gray-400">{st.instructor_name || '— unassigned —'}</div>
              </Link>
            ))}
          </div>
        )}
        {dAttempts.length > 0 && (
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {dAttempts.filter(a => a.overall_result === 'pass').length} pass · {dAttempts.filter(a => a.overall_result === 'fail').length} fail recorded here
          </div>
        )}
      </div>
    );
  };

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  if (!session) return null;

  const cohortLabel = cohort ? `${cohort.program?.abbreviation || ''} G${cohort.cohort_number ?? ''}`.trim() : '';

  return (
    <RegionShell header={<>
        {/* Controls (hidden on print) */}
        <div className="print:hidden">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/calendar?preset=labs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
              <ArrowLeft className="w-4 h-4" /> Calendar
            </Link>
            <Link href="/labs/aha-hub" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
              AHA Hub (ACLS + PALS)
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-red-600" /> ACLS Hub
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {cohortLabel}{dates.length ? ` · ${dates.map(prettyDate).join(' + ')}` : ''} — full event, one place
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
          {/* Course selector — choose which cohort's ACLS course to view */}
          {courseOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">Course:</span>
              {courseOptions.map((c) => (
                <Link
                  key={c.id}
                  href={`/labs/acls-hub?cohortId=${c.id}`}
                  className={`px-3 py-1.5 min-h-[36px] inline-flex items-center rounded-md text-sm border ${
                    cohort?.id === c.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {c.label}{c.dates.length ? ` · ${c.dates[0]}` : ''}
                </Link>
              ))}
            </div>
          )}
          {/* Day selector */}
          {dates.length > 1 && (
            <div className="flex gap-1 mb-4">
              <button onClick={() => setActiveDate('all')} className={`px-3 py-1 text-xs rounded-md border ${activeDate === 'all' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 dark:border-gray-600'}`}>Both days</button>
              {dates.map((d, i) => (
                <button key={d} onClick={() => setActiveDate(d)} className={`px-3 py-1 text-xs rounded-md border ${activeDate === d ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 dark:border-gray-600'}`}>Day {i + 1}</button>
              ))}
            </div>
          )}
        </div>

        {saveError && (
          <div role="alert" className="print:hidden mb-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">{saveError}</div>
        )}
    </>}>

        {/* ── PRINT-ONLY SCHEDULE SHEET — clean instructor handout (the rest of
            the hub dashboard is hidden on print). Shows BOTH days regardless of
            the on-screen day toggle. ── */}
        <div className="hidden print:block text-black acls-print">
          <style>{`@media print {
            @page { margin: 0.5in; size: letter portrait; }
            html, body { background: #fff !important; }
            .acls-print table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            .acls-print th, .acls-print td { border: 1px solid #000; padding: 3px 6px; text-align: left; vertical-align: top; font-size: 10pt; line-height: 1.25; }
            .acls-print th { background: #e5e5e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; }
          }`}</style>
          {cohort && (
            <>
              <h1 className="text-xl font-bold">ACLS Course Schedule — {cohortLabel}</h1>
              <p className="text-sm mb-2">{dates.map(prettyDate).join('   ·   ')}</p>
              {dates.map((date, di) => {
                const dayEvents = events.filter(e => e.date === date).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                const daySections = visibleLabDays.filter(d => d.date === date).sort(bySectionTime);
                return (
                  <div key={date} style={{ breakBefore: di > 0 ? 'page' : 'auto' }}>
                    <h2 className="text-base font-bold mt-3 mb-1">Day {di + 1} — {prettyDate(date)}</h2>
                    <table>
                      <thead><tr><th style={{ width: '110px' }}>Time</th><th>Lesson / Activity</th><th style={{ width: '150px' }}>Room / Instructor</th></tr></thead>
                      <tbody>
                        {dayEvents.length === 0
                          ? <tr><td colSpan={3}>No schedule blocks.</td></tr>
                          : dayEvents.map(e => (
                            <tr key={e.id}>
                              <td>{hhmm(e.start_time)}–{hhmm(e.end_time)}</td>
                              <td>{e.title}</td>
                              <td>{[e.room, rowInstructorNames(e).join(', '), e.content_notes].filter(Boolean).join(' · ')}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {daySections.length > 0 && (
                      <div className="mt-1">
                        <div className="font-bold mt-2 mb-1">Lab sections — station plan</div>
                        {daySections.map(s => (
                          <div key={s.id} style={{ breakInside: 'avoid' }}>
                            <div className="font-semibold">{(s.section_label || s.title || 'Lab')} · {hhmm(s.start_time)}–{hhmm(s.end_time)}</div>
                            <table>
                              <thead><tr><th style={{ width: '32px' }}>#</th><th style={{ width: '120px' }}>Room</th><th>Case / Skill</th><th style={{ width: '150px' }}>Instructor</th></tr></thead>
                              <tbody>
                                {s.stations.map(st => (
                                  <tr key={st.id}>
                                    <td>{st.station_number}</td>
                                    <td>{st.room || ''}</td>
                                    <td>{st.scenario?.case_code || st.scenario?.title || st.custom_title || ''}</td>
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
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !cohort ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            No ACLS event found. (Looks for lab days tagged <code>cert_course=acls</code>.)
          </div>
        ) : (
          <RegionGrid>
            {/* ── Region 1: Overview ── */}
            <Region title="Overview — megacode TL stats" icon={<UserCheck className="w-4 h-4" />}>
            <section>
              <div className="grid grid-cols-3 max-lg:grid-cols-2 gap-3">
                <StatTile label="Megacode lab days" value={megacodeLabDayIds.size} />
                <StatTile label="Groups" value={stats.totalGroups} />
                <StatTile label="Megacode attempts" value={stats.totalAttempts} />
                <StatTile label="Passed" value={stats.passed} tone="text-green-600 dark:text-green-400" />
                <StatTile label="Failed" value={stats.failed} tone="text-red-600 dark:text-red-400" />
                <StatTile label="Passed as TL" value={`${stats.passedTLCount}/${stats.totalStudents}`} tone={stats.passedTLCount === stats.totalStudents && stats.totalStudents > 0 ? 'text-green-600 dark:text-green-400' : undefined} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Megacode attempts only (practice and final testing). A team-lead pass in practice counts toward the AHA team-lead distinction.</p>
            </section>

            {/* FAILURE MARKER — who hasn't passed megacode as TL yet */}
            {stats.notPassed.length > 0 && (
              <section style={{ breakInside: 'avoid' }} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-xl p-4">
                <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Not yet passed megacode as TL — {stats.notPassed.length} of {stats.totalStudents}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {stats.notPassed.map(s => (
                    <span key={s.id} className={`text-sm font-medium px-3 py-1 rounded-full ${s.failed ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                      {s.last_name}, {s.first_name}{s.failed ? ' — failed' : ' — not yet'}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Red = failed a megacode as team lead; gray = has not yet led a passing megacode. Goal: every student passes at least one megacode as team lead.</p>
              </section>
            )}
            </Region>

            {/* ── Region 2: Schedule (agenda rows) ── */}
            <Region title="Schedule and stations" icon={<CalendarDays className="w-4 h-4" />} className="lg:row-span-2">
            {visibleDates.map((date) => {
              const dayEvents = events.filter(e => e.date === date).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
              const daySections = visibleLabDays.filter(d => d.date === date).sort(bySectionTime);
              // Join each lab row to its section: explicit FK first, then the
              // block's linked_section_number (default 1) against the lab day's
              // section_number. Each section nests under at most one row.
              const claimed = new Set<string>();
              const sectionFor = new Map<string, LabDay>();
              for (const e of dayEvents) {
                if (e.event_type !== 'lab') continue;
                const d = daySections.find(x => !claimed.has(x.id) && (
                  e.linked_lab_day_id ? x.id === e.linked_lab_day_id
                    : (x.section_number ?? 1) === (e.metadata?.linked_section_number ?? 1)
                ));
                if (d) { claimed.add(d.id); sectionFor.set(e.id, d); }
              }
              const unmatched = daySections.filter(d => !claimed.has(d.id));
              return (
                <section key={date} style={{ breakInside: 'avoid' }}>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-red-600" /> Day {dates.indexOf(date) + 1} — {prettyDate(date)}
                  </h3>

                  {/* Schedule (didactic + labs together) */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 ">
                    {dayEvents.length === 0 ? (
                      <div className="p-3 text-xs text-gray-400">No schedule blocks found for this day.</div>
                    ) : dayEvents.map(e => {
                      const editable = e.source === 'planner' && !!e.linked_id;
                      const names = e.instructor_names || [];
                      const nested = sectionFor.get(e.id);
                      return (
                        <div key={e.id}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-24 shrink-0">{hhmm(e.start_time)}–{hhmm(e.end_time)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLOR[e.event_type] || TYPE_COLOR.class}`}>{e.event_type}</span>
                          <span className="text-gray-800 dark:text-gray-100 flex-1 min-w-[12rem]">{e.title}</span>
                          {e.room && <span className="text-xs text-gray-400">{e.room}</span>}
                          {editable ? (
                            <>
                              {[
                                { field: 'instructor_id', label: 'Instructor', value: e.metadata?.instructor_id },
                                { field: 'additional_instructor_id', label: 'Co-instructor', value: e.metadata?.additional_instructor_id },
                              ].map(f => (
                                <select
                                  key={f.field}
                                  aria-label={`${f.label} for ${e.title}`}
                                  value={f.value || ''}
                                  disabled={savingBlock === e.id}
                                  onChange={(ev) => saveBlock(e, { [f.field]: ev.target.value || null })}
                                  className="text-xs min-h-[36px] w-40 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1"
                                >
                                  <option value="">{f.label}: —</option>
                                  {instructorOpts.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                              ))}
                              <input
                                type="text"
                                aria-label={`Note for ${e.title}`}
                                placeholder="Note"
                                defaultValue={e.content_notes || ''}
                                disabled={savingBlock === e.id}
                                onBlur={(ev) => { if (ev.target.value !== (e.content_notes || '')) saveBlock(e, { content_notes: ev.target.value || null }); }}
                                className="text-xs min-h-[36px] w-56 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2"
                              />
                              {savingBlock === e.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                            </>
                          ) : (
                            names.length > 0 && <span className="text-xs text-gray-400">{names.join(', ')}</span>
                          )}
                        </div>
                        {nested && <div className="px-3 pb-2 pl-6">{renderSection(nested)}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Lab sections with no matching schedule row (nothing is hidden) */}
                  {unmatched.length > 0 && <div className="mt-2 space-y-2">{unmatched.map(renderSection)}</div>}
                </section>
              );
            })}
            </Region>


            {/* ── Region 4: Student progress ── */}
            <Region title="Student progress" icon={<Users className="w-4 h-4" />}>
            {/* Per-group MEGACODE team-lead coverage (whole event) */}
            <section style={{ breakInside: 'avoid' }}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">Groups — megacode TL coverage (practice + testing)</h3>
              <div className="space-y-2">
                {groups.map(g => {
                  const gAttempts = attemptsByGroup.get(g.id) || [];
                  return (
                    <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{g.name} <span className="text-xs text-gray-400">({g.members.length})</span></div>
                        <div className="text-xs inline-flex items-center gap-1">
                          {gAttempts.map(a => a.overall_result === 'pass'
                            ? <CheckCircle2 key={a.id} className="w-4 h-4 text-green-500" />
                            : <XCircle key={a.id} className="w-4 h-4 text-red-500" />)}
                          {gAttempts.length === 0 && <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> none yet</span>}
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {g.members.map(m => {
                          const led = stats.passedTLIds.has(m.id);
                          return (
                            <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded-full ${led ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                              {led ? '✓ ' : ''}{m.last_name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* By instructor */}
            {byInstructor.length > 0 && (
              <section style={{ breakInside: 'avoid' }}>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><UserCheck className="w-4 h-4" /> By instructor (station assignments)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {byInstructor.map(([name, slots]) => (
                    <div key={name} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="font-medium text-gray-800 dark:text-gray-100 mb-1">{name}</div>
                      <div className="space-y-0.5">
                        {slots.map((s, i) => (
                          <div key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
                            Day {dates.indexOf(s.date) + 1} · {s.section} · #{s.station} {s.room ? `(${s.room})` : ''} — {s.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-gray-400">From station instructor labels. Assign via each section&apos;s Edit page (which also syncs to Google Calendar).</p>
              </section>
            )}
            </Region>
          </RegionGrid>
        )}
    </RegionShell>
  );
}

export default function AclsHubPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gray-400" /></div>}>
      <AclsHubPageContent />
    </Suspense>
  );
}
