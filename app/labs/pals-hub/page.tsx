'use client';

/**
 * PALS Hub — additive, READ-ONLY aggregator for the full PALS event.
 * Mirrors /labs/acls-hub's shape (Task Handoff Queue: "AHA HUB: PALS
 * aggregated view mirroring ACLS Hub"; PALS Hub Build Plan, docs/pals/):
 *   - Day 1 / Day 2 schedule (didactic + labs together), legible day view
 *   - Lab sections per day (Ben builds these via the UI; this page only
 *     displays them — no auto-created stations)
 *   - Practice team-lead coverage per student: AHA 2025 requires >=2 TL
 *     turns per student in PRACTICE (Module 6, Lesson 12) — testing is
 *     separate (satisfied as TL or team member, PASS 2 of 3)
 *   - By-instructor view + a clean print option
 *   - ?date=YYYY-MM-DD deep-link support (from the calendar's "Open PALS
 *     Hub" button) — pre-selects that day's tab on load
 *
 * Reads existing sources only: /api/adv-cert/pals-hub (sections + groups +
 * attempts) and /api/calendar/unified (schedule). Writes nothing. The
 * dedicated testing/grading page (/labs/pals/grade) stays the place to
 * actually grade — this page links to it, doesn't replace it.
 */

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, RefreshCw, Printer, CheckCircle2, XCircle, Clock,
  Users, UserCheck, MapPin, CalendarDays, Layers, Stethoscope, ClipboardCheck,
  ClipboardList, AlertTriangle,
} from 'lucide-react';
import { palsAgendaForDay, PALS_DAY1_OVERFLOW_NOTE, type PalsAgendaBlock } from '@/lib/pals-day-structure';

interface Member { id: string; first_name: string; last_name: string }
interface Group { id: string; name: string; members: Member[] }
interface Station {
  id: string; lab_day_id: string; station_number: number; custom_title: string | null;
  room: string | null; instructor_name: string | null; station_notes: string | null;
  station_type?: string | null;
  scenario?: { id: string; title: string; case_code: string | null } | null;
}
interface LabDay {
  id: string; date: string; section_number: number | null; section_label: string | null;
  title: string | null; start_time: string | null; end_time: string | null;
  lab_mode: string | null; is_adv_cert_testing: boolean; stations: Station[];
}
interface Attempt {
  id: string; lab_day_id: string; lab_group_id: string; result: string;
  attempted_at: string; team_lead?: { id: string; first_name: string; last_name: string } | null;
  scenario?: { id: string; name: string; case_code: string | null } | null;
}
interface CalEvent {
  id: string; title: string; date: string; start_time: string | null; end_time: string | null;
  event_type: string; instructor_names?: string[]; room?: string; linked_url?: string; status?: string;
}

// PALS days replace an instructor's regular classes on that date (Ben
// confirmed 2026-07-15) — those schedule_block rows are suppressed via
// pmi_schedule_blocks.status='cancelled' (the existing mechanism already used
// by /calendar, push-to-shared, and feed.ics). /api/calendar/unified doesn't
// filter cancelled server-side (the main /calendar page needs to be able to
// show them via its own toggle), so filter them out here — the PALS Hub
// schedule should only ever show what's actually happening on a PALS day.
const isNotCancelled = (e: CalEvent) => e.status !== 'cancelled';

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const prettyDate = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); } catch { return d; } };

const TYPE_COLOR: Record<string, string> = {
  lab: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  class: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  exam: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
};

const AGENDA_TYPE_COLOR: Record<string, string> = {
  lecture: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  practice: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  lab: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  testing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
  break: 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
  lunch: 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
};

function PalsHubPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cohort, setCohort] = useState<any>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string>('all');
  const [instructors, setInstructors] = useState<{ id: string; name: string; email: string }[]>([]);
  const [agendaInstructors, setAgendaInstructors] = useState<Record<string, string>>({});

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

  // Deep-link: ?date=YYYY-MM-DD (from the calendar's "Open PALS Hub"
  // button) pre-selects that day's tab once the real dates are known.
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && dates.includes(dateParam)) setActiveDate(dateParam);
  }, [searchParams, dates]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hubRes = await fetch('/api/adv-cert/pals-hub');
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
          setEvents((u.events || []).filter((e: CalEvent) => hub.dates.includes(e.date) && isNotCancelled(e)));

          // Reference-only instructor assignments for the didactic agenda rows
          // (Task Handoff Queue: "PALS hub - instructor picker on DIDACTIC
          // AGENDA ROWS") — keyed date|blockId to match palsAgendaForDay's ids.
          const aiRes = await fetch(`/api/adv-cert/pals-hub/agenda-instructors?cohortId=${hub.cohort.id}&start=${start}&end=${end}`);
          const ai = await aiRes.json();
          if (ai.success) {
            const map: Record<string, string> = {};
            for (const a of ai.assignments || []) {
              if (a.instructor_name) map[`${a.date}|${a.block_id}`] = a.instructor_name;
            }
            setAgendaInstructors(map);
          }
        } else {
          setEvents([]);
        }
      }
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (status === 'authenticated') load(); }, [load, status]);

  // Instructor picker (Task Handoff Queue: "PALS HUB POLISH") — reference-only
  // display, pulled from the same lab_users list the rest of lab management
  // uses. Deliberately PATCHes instructor_name only (no instructor_email), so
  // it does NOT trigger the calendar-sync/notification side effects that
  // /api/lab-management/stations/[id] runs for a full assignment — this is
  // just a quick label for Ben to see who's running each station, not a
  // replacement for the per-section Assign/Edit flow.
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/lab-management/instructors')
      .then(r => r.json())
      .then(d => { if (d.success) setInstructors(d.instructors || []); })
      .catch(() => { /* non-blocking */ });
  }, [status]);

  const updateStationInstructor = useCallback((labDayId: string, stationId: string, name: string) => {
    const value = name.trim() || null;
    setLabDays(prev => prev.map(d => d.id !== labDayId ? d : {
      ...d,
      stations: d.stations.map(st => st.id === stationId ? { ...st, instructor_name: value } : st),
    }));
    fetch(`/api/lab-management/stations/${stationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructor_name: value }),
    }).catch(() => { /* best-effort; Refresh reconciles */ });
  }, []);

  // Instructor picker for the didactic/video LESSON ROWS (Task Handoff
  // Queue: "PALS hub - instructor picker on DIDACTIC AGENDA ROWS") — same
  // reference-only pattern as updateStationInstructor above, just against
  // the new pals_agenda_instructors table since these rows have no other
  // DB backing.
  const updateAgendaInstructor = useCallback((date: string, blockId: string, name: string) => {
    const value = name.trim() || null;
    const key = `${date}|${blockId}`;
    setAgendaInstructors(prev => {
      const next = { ...prev };
      if (value) next[key] = value; else delete next[key];
      return next;
    });
    if (!cohort?.id) return;
    fetch('/api/adv-cert/pals-hub/agenda-instructors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cohortId: cohort.id, date, blockId, instructorName: value }),
    }).catch(() => { /* best-effort; Refresh reconciles */ });
  }, [cohort]);

  const visibleDates = activeDate === 'all' ? dates : dates.filter(d => d === activeDate);

  // Mirrors /labs/acls-hub: once a date has real sections (section_number > 1),
  // hide that date's original unsectioned section-1 row from the aggregated
  // view instead of double-displaying it. The row itself is never deleted —
  // this is display-only, so a section build stays fully reversible.
  const visibleLabDays = useMemo(() => {
    const sectionedDates = new Set(
      labDays.filter(d => (d.section_number ?? 1) > 1).map(d => d.date)
    );
    return labDays.filter(d => !((d.section_number ?? 1) === 1 && sectionedDates.has(d.date)));
  }, [labDays]);

  // PALS TEAM-LEAD COVERAGE: each attempt's own student IS the tested team
  // lead (no separate team_lead column, unlike ACLS's megacode model — see
  // docs/pals/PALS_Grading_Model_Spec.md).
  //
  // AHA 2025 Module 6 Lesson 12 (verbatim): "Every student must act as Team
  // Leader — at least TWICE in the full PALS Course." That requirement is
  // scoped to PRACTICE only — 6-student groups x 12 practice cases = exactly
  // 12 TL turns = 2 per student, ZERO slack, so any group >6 breaks it.
  // TESTING is separate and satisfied as TL *or* team member (PASS 2 of 3),
  // so testing attempts do NOT count toward the practice TL-coverage
  // threshold. Split attempts by the source lab_day's is_adv_cert_testing
  // flag to keep the two counts from bleeding into each other.
  const stats = useMemo(() => {
    const testingDayIds = new Set(visibleLabDays.filter(d => d.is_adv_cert_testing).map(d => d.id));
    const testingAttempts = attempts.filter(a => testingDayIds.has(a.lab_day_id));
    const practiceAttempts = attempts.filter(a => !testingDayIds.has(a.lab_day_id));

    const passed = testingAttempts.filter(a => a.result === 'PASS').length;
    const nr = testingAttempts.filter(a => a.result === 'NR').length;
    const groupsTested = new Set(testingAttempts.map(a => a.lab_group_id).filter(Boolean)).size;

    const practiceLeadCounts = new Map<string, number>();
    for (const a of practiceAttempts) {
      const id = a.team_lead?.id;
      if (!id) continue;
      practiceLeadCounts.set(id, (practiceLeadCounts.get(id) || 0) + 1);
    }
    const allStudents = groups.flatMap(g => g.members);
    const PRACTICE_TL_REQUIRED = 2;
    const covered = allStudents.filter(s => (practiceLeadCounts.get(s.id) || 0) >= PRACTICE_TL_REQUIRED);
    const notCovered = allStudents.filter(s => (practiceLeadCounts.get(s.id) || 0) < PRACTICE_TL_REQUIRED);
    const oversizedGroups = groups.filter(g => g.members.length > 6);
    const sections = visibleLabDays.filter(d => (d.section_number ?? 1) > 1).length;
    return {
      passed, nr, groupsTested, totalGroups: groups.length,
      practiceLeadCounts, practiceTlRequired: PRACTICE_TL_REQUIRED,
      totalStudents: allStudents.length, coveredCount: covered.length, notCovered, oversizedGroups,
      sections, labDaysCount: visibleLabDays.length, totalAttempts: attempts.length,
      practiceAttemptsCount: practiceAttempts.length, testingAttemptsCount: testingAttempts.length,
    };
  }, [attempts, groups, visibleLabDays]);

  const attemptsByGroup = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of attempts) { if (!a.lab_group_id) continue; (m.get(a.lab_group_id) || m.set(a.lab_group_id, []).get(a.lab_group_id)!).push(a); }
    return m;
  }, [attempts]);

  // ROTATION COUNTER PER SECTION (Task Handoff Queue: "raw per-station attempt
  // counts don't map to rotations; instructors disagreed on rotations left").
  // Expected rotations for a section = its station count (each group rotates
  // through every station once). Skip "Learning Stations" sections — those are
  // attestation-only (pals_skill_completions), never produce pals_test_attempts,
  // so they'd show a false "0 of N" here. Derived read-only from the same
  // attempts/labDays/groups this page already loads — no new API call.
  const rotationCoverage = useMemo(() => {
    const gradedSections = visibleLabDays.filter(
      (d) => d.stations.length > 0 && !/learning/i.test(d.section_label || '')
    );
    return gradedSections.map((d) => {
      const expected = d.stations.length;
      const dAttempts = attempts.filter((a) => a.lab_day_id === d.id);
      const perGroup = groups.map((g) => ({
        group: g,
        count: dAttempts.filter((a) => a.lab_group_id === g.id).length,
      }));
      const behind = perGroup.filter((p) => p.count < expected);
      return { labDay: d, expected, perGroup, behind };
    });
  }, [visibleLabDays, attempts, groups]);

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

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  if (!session) return null;

  const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div className={`text-xl font-bold ${tone || 'text-gray-900 dark:text-white'}`}>{value}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );

  const cohortLabel = cohort ? `${cohort.program?.abbreviation || ''} G${cohort.cohort_number ?? ''}`.trim() : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Controls (hidden on print) */}
        <div className="print:hidden">
          <Link href="/labs/aha-hub" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3">
            <ArrowLeft className="w-4 h-4" /> AHA Hub
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Stethoscope className="w-6 h-6 text-emerald-600" /> PALS Hub
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {cohortLabel}{dates.length ? ` · ${dates.map(prettyDate).join(' + ')}` : ''} — full event, one place (read-only)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/labs/pals/grade" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
                <ClipboardCheck className="w-3.5 h-3.5" /> Testing / Grade
              </Link>
              <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
          {/* Day selector */}
          {dates.length > 1 && (
            <div className="flex gap-1 mb-4">
              <button onClick={() => setActiveDate('all')} className={`px-3 py-1 text-xs rounded-md border ${activeDate === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 dark:border-gray-600'}`}>Both days</button>
              {dates.map((d, i) => (
                <button key={d} onClick={() => setActiveDate(d)} className={`px-3 py-1 text-xs rounded-md border ${activeDate === d ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-300 dark:border-gray-600'}`}>Day {i + 1}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── PRINT-ONLY SCHEDULE SHEET ── */}
        <div className="hidden print:block text-black pals-print">
          <style>{`@media print {
            @page { margin: 0.5in; size: letter portrait; }
            html, body { background: #fff !important; }
            .pals-print table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            .pals-print th, .pals-print td { border: 1px solid #000; padding: 3px 6px; text-align: left; vertical-align: top; font-size: 10pt; line-height: 1.25; }
            .pals-print th { background: #e5e5e5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; }
          }`}</style>
          {cohort && (
            <>
              <h1 className="text-xl font-bold">PALS Course Schedule — {cohortLabel}</h1>
              <p className="text-sm mb-2">{dates.map(prettyDate).join('   ·   ')}</p>
              {dates.map((date, di) => {
                const dayEvents = events.filter(e => e.date === date).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                const daySections = visibleLabDays.filter(d => d.date === date).sort((a, b) => (a.section_number ?? 1) - (b.section_number ?? 1));
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
                              <td>{[e.room, (e.instructor_names || []).join(', ')].filter(Boolean).join(' · ')}</td>
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
            No PALS event found. (Looks for lab days tagged <code>cert_course=pals</code>.)
          </div>
        ) : (
          <div className="space-y-6 print:hidden">
            {/* Testing stats — both days */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <UserCheck className="w-4 h-4" /> Testing stats
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Stat label="PALS lab days" value={stats.labDaysCount} />
                <Stat label="Groups" value={stats.totalGroups} />
                <Stat label="Testing attempts" value={stats.testingAttemptsCount} />
                <Stat label="Passed" value={stats.passed} tone="text-green-600 dark:text-green-400" />
                <Stat label="NR" value={stats.nr} tone="text-red-600 dark:text-red-400" />
                <Stat label="Practice attempts" value={stats.practiceAttemptsCount} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Testing (AHA rule): PASS 2 of 3, satisfiable as team lead OR a team member — this does not require 2 TL turns (that requirement is practice-only, see below).</p>
            </section>

            {/* PRACTICE TEAM-LEAD COVERAGE — AHA 2025 Module 6 Lesson 12: every
                student must act as Team Leader at least TWICE in the full PALS
                Course, and that's practice-only with zero slack (6 students x
                12 practice cases = exactly 2 turns each). */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <UserCheck className="w-4 h-4" /> Practice team-lead coverage (≥{stats.practiceTlRequired} required per student)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Covered (≥2 TL turns)" value={`${stats.coveredCount}/${stats.totalStudents}`} tone={stats.coveredCount === stats.totalStudents && stats.totalStudents > 0 ? 'text-green-600 dark:text-green-400' : undefined} />
                <Stat label="Oversized groups (>6)" value={stats.oversizedGroups.length} tone={stats.oversizedGroups.length > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">AHA 2025 (Module 6, Lesson 12): &quot;Every student must act as Team Leader — at least TWICE in the full PALS Course.&quot; 6-student groups × 12 practice cases = exactly 12 TL turns = 2 each, zero slack — any group over 6 breaks this.</p>
            </section>

            {/* OVERSIZED GROUP WARNING */}
            {stats.oversizedGroups.length > 0 && (
              <section style={{ breakInside: 'avoid' }} className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-3">
                <h2 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> {stats.oversizedGroups.length} group{stats.oversizedGroups.length > 1 ? 's' : ''} over 6 students — breaks the ≥2-TL-turns requirement
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {stats.oversizedGroups.map(g => (
                    <span key={g.id} className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                      {g.name} ({g.members.length})
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">With 12 practice cases and one TL turn each, a group over 6 students cannot mathematically give every member 2 TL turns — add practice cases or resize the group.</p>
              </section>
            )}

            {/* COVERAGE MARKER — who hasn't led twice yet in practice */}
            {stats.notCovered.length > 0 && (
              <section style={{ breakInside: 'avoid' }} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg p-3">
                <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Under {stats.practiceTlRequired} practice TL turns — {stats.notCovered.length} of {stats.totalStudents}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {stats.notCovered.map(s => (
                    <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {s.last_name}, {s.first_name} ({stats.practiceLeadCounts.get(s.id) || 0}/{stats.practiceTlRequired})
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">AHA goal: every student leads a PRACTICE case at least twice by the end of the course (regardless of PASS/NR — this tracks the opportunity, not the outcome).</p>
              </section>
            )}

            {/* ROTATION COVERAGE BY SECTION — "Section X: rotation N of 4" +
                which groups still need to go, derived from pals_test_attempts
                by section/group (raw per-station counts don't map cleanly to
                rotations left, so this converts count -> rotation N of
                {stations in that section}). */}
            {rotationCoverage.length > 0 && (
              <section style={{ breakInside: 'avoid' }}>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" /> Rotation coverage by section
                </h2>
                <div className="space-y-2">
                  {rotationCoverage.map(({ labDay, expected, perGroup, behind }) => (
                    <div key={labDay.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {labDay.section_label || labDay.title || 'Section'}
                        </span>
                        <span className="text-[11px] text-gray-400">{prettyDate(labDay.date)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {perGroup.map(({ group, count }) => (
                          <span key={group.id} className={`text-[11px] px-2 py-0.5 rounded-full ${
                            count >= expected
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                              : count === 0
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          }`}>
                            {group.name}: rotation {count} of {expected}
                          </span>
                        ))}
                      </div>
                      {behind.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                          Still need to go: {behind.map((b) => `${b.group.name} (${b.count}/${expected})`).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Per day: schedule + sections */}
            {visibleDates.map((date) => {
              const dayEvents = events.filter(e => e.date === date).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
              const daySections = visibleLabDays.filter(d => d.date === date).sort((a, b) => (a.section_number ?? 1) - (b.section_number ?? 1));
              return (
                <section key={date} style={{ breakInside: 'avoid' }}>
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-emerald-600" /> Day {dates.indexOf(date) + 1} — {prettyDate(date)}
                  </h2>

                  {/* PALS lesson-by-lesson agenda — PRIMARY day-of schedule
                      (Task Handoff Queue: "PALS HUB POLISH"). This is the
                      AHA 2025 agenda (docs/pals/PALS_2025_Day_Structure.md),
                      not pulled from pmi_schedule_blocks — on a PALS day the
                      live calendar schedule below often still shows the
                      instructors' regular classes (which PALS replaces on
                      these dates), so the real day plan lives here instead. */}
                  {(dates.indexOf(date) + 1 === 1 || dates.indexOf(date) + 1 === 2) && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 mb-3">
                      {palsAgendaForDay((dates.indexOf(date) + 1) as 1 | 2).map((b: PalsAgendaBlock) => {
                        const showPicker = b.type !== 'break' && b.type !== 'lunch';
                        const current = agendaInstructors[`${date}|${b.id}`] || '';
                        return (
                          <div key={b.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0">{b.start}{b.durationMinutes > 0 ? ` (${b.durationMinutes}m)` : ''}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${AGENDA_TYPE_COLOR[b.type] || AGENDA_TYPE_COLOR.lecture}`}>{b.type}</span>
                            <span className={`text-gray-800 dark:text-gray-100 flex-1 ${b.type === 'lab' || b.type === 'testing' ? 'font-semibold' : ''}`}>{b.label}</span>
                            {showPicker && (
                              <select
                                value={current}
                                onChange={(e) => updateAgendaInstructor(date, b.id, e.target.value)}
                                className="shrink-0 w-40 text-[11px] bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 text-gray-500 dark:text-gray-400 print:hidden"
                              >
                                <option value="">— unassigned —</option>
                                {current && !instructors.some(i => i.name === current) && (
                                  <option value={current}>{current} (not in list)</option>
                                )}
                                {instructors.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                              </select>
                            )}
                          </div>
                        );
                      })}
                      {dates.indexOf(date) + 1 === 1 && (
                        <div className="flex items-start gap-1.5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {PALS_DAY1_OVERFLOW_NOTE}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live calendar schedule — secondary reference, collapsed.
                      Should read empty on PALS days once the class-suppression
                      sync (Task Handoff Queue part 3, PR #45 + Sync All)
                      reaches Google/the live calendar; kept as a fallback in
                      case anything else lands on the calendar for this date. */}
                  <details className="mb-3 print:hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5" /> Live calendar schedule ({dayEvents.length}) — click to expand
                    </summary>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
                      {dayEvents.length === 0 ? (
                        <div className="p-3 text-xs text-gray-400">No schedule blocks found for this day.</div>
                      ) : dayEvents.map(e => (
                        <div key={e.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 w-24 shrink-0">{hhmm(e.start_time)}–{hhmm(e.end_time)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLOR[e.event_type] || TYPE_COLOR.class}`}>{e.event_type}</span>
                          <span className="text-gray-800 dark:text-gray-100 flex-1">{e.title}</span>
                          {e.room && <span className="text-xs text-gray-400 hidden sm:inline">{e.room}</span>}
                          {e.instructor_names && e.instructor_names.length > 0 && <span className="text-xs text-gray-400 hidden md:inline">{e.instructor_names.join(', ')}</span>}
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* Lab sections for the day — Ben builds these via the UI; this
                      view only displays what already exists, never creates any. */}
                  <div className="space-y-2">
                    {daySections.length === 0 ? (
                      <div className="text-xs text-gray-400 px-1">No lab sections built for this day yet.</div>
                    ) : daySections.map(d => {
                      const isSection = (d.section_number ?? 1) > 1;
                      const dAttempts = attempts.filter(a => a.lab_day_id === d.id);
                      return (
                        <div key={d.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
                              {isSection ? <Layers className="w-4 h-4 text-indigo-500" /> : <Clock className="w-4 h-4 text-gray-400" />}
                              {d.section_label || d.title || 'Lab'}
                              <span className="text-xs text-gray-400">{hhmm(d.start_time)}–{hhmm(d.end_time)} · {d.stations.length} stations{d.is_adv_cert_testing ? ' · testing' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2 print:hidden">
                              <Link href={`/labs/schedule/${d.id}`} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Open</Link>
                              <Link href={`/labs/schedule/${d.id}/edit`} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Assign</Link>
                              {d.is_adv_cert_testing && (
                                <Link href={`/labs/pals/grade?labDayId=${d.id}`} className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">Grade</Link>
                              )}
                            </div>
                          </div>
                          {/* Stations. station_type='skills' (Section A learning stations) are NOT
                              graded in the app (attestation + printable competency sheet per AHA
                              2025 — PALS Hub Build Plan Phase 5) — render as a plain card, not a
                              link into the PASS/NR grading flow. Everything else (practice/testing
                              scenario stations) keeps the existing "Grade" link. */}
                          {d.stations.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                              {d.stations.map(st => {
                                const isSkills = st.station_type === 'skills';
                                const body = (
                                  <>
                                    <div className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-gray-400" />#{st.station_number} {st.room || ''}
                                      {isSkills && (
                                        <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                                          <ClipboardList className="w-2.5 h-2.5" /> Attestation
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-gray-500 dark:text-gray-400">{st.scenario?.case_code || st.scenario?.title || st.custom_title || '—'}</div>
                                  </>
                                );
                                // Instructor picker: reference-only display (Task Handoff
                                // Queue "PALS HUB POLISH") — kept outside the grade-link
                                // <Link> below so picking a name doesn't navigate away.
                                const picker = (
                                  <select
                                    value={st.instructor_name || ''}
                                    onChange={(e) => updateStationInstructor(d.id, st.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 w-full text-[11px] bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 text-gray-500 dark:text-gray-400 print:hidden"
                                  >
                                    <option value="">— unassigned —</option>
                                    {st.instructor_name && !instructors.some(i => i.name === st.instructor_name) && (
                                      <option value={st.instructor_name}>{st.instructor_name} (not in list)</option>
                                    )}
                                    {instructors.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                                  </select>
                                );
                                return (
                                  <div
                                    key={st.id}
                                    className={`text-xs border rounded p-1.5 ${isSkills ? 'border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10' : 'border-gray-100 dark:border-gray-700'}`}
                                  >
                                    {isSkills ? (
                                      <div>{body}</div>
                                    ) : (
                                      <Link
                                        href={`/labs/pals/grade?labDayId=${d.id}&stationId=${st.id}`}
                                        className="block hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                                      >
                                        {body}
                                      </Link>
                                    )}
                                    {picker}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {dAttempts.length > 0 && (
                            <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                              {dAttempts.filter(a => a.result === 'PASS').length} pass · {dAttempts.filter(a => a.result === 'NR').length} NR recorded here
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Per-group team-lead coverage (whole event) */}
            <section style={{ breakInside: 'avoid' }}>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Groups — practice team-lead coverage</h2>
              <div className="space-y-2">
                {groups.map(g => {
                  const gAttempts = attemptsByGroup.get(g.id) || [];
                  const oversized = g.members.length > 6;
                  return (
                    <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          {g.name} <span className={`text-xs ${oversized ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'}`}>({g.members.length}{oversized ? ' — over 6' : ''})</span>
                        </div>
                        <div className="text-xs inline-flex items-center gap-1">
                          {gAttempts.map(a => a.result === 'PASS'
                            ? <CheckCircle2 key={a.id} className="w-4 h-4 text-green-500" />
                            : <XCircle key={a.id} className="w-4 h-4 text-red-500" />)}
                          {gAttempts.length === 0 && <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> none yet</span>}
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {g.members.map(m => {
                          const tlCount = stats.practiceLeadCounts.get(m.id) || 0;
                          const covered = tlCount >= stats.practiceTlRequired;
                          return (
                            <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded-full ${covered ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                              {covered ? '✓ ' : ''}{m.last_name} ({tlCount}/{stats.practiceTlRequired})
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
          </div>
        )}
      </div>
    </div>
  );
}

export default function PalsHubPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gray-400" /></div>}>
      <PalsHubPageContent />
    </Suspense>
  );
}
