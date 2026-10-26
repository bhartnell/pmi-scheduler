'use client';

/**
 * CoordinatorTracker (PALS P2b/4) — course-parameterized coordinator page for
 * an advanced-cert (ACLS/PALS) lab day. NOT operational dispatch (that's the
 * NREMT coordinator); this is "where we are / what's next / who's teaching"
 * + team-lead & result stats, for clarity and ad-hoc adjustment during the day.
 *
 * ACLS keeps its original single-day aggregation (/api/adv-cert/grading-context
 * + /api/adv-cert/attempts, scoped to the one lab_day_id the route was opened
 * from) — nothing about the ACLS view changes here beyond living in this
 * shared component instead of its own page.
 *
 * PALS aggregates across the WHOLE cohort+course (both days, every section)
 * via /api/adv-cert/pals-hub, because its stat tiles are cross-section by
 * design ("Practice cases run" spans Day 1 Section B + Day 2 Sections C/D;
 * "Final rounds"/"Groups ready" read Day 2 Section E). Final-round grouping
 * logic lives in lib/pals-coordinator.ts (unit-tested, no I/O).
 */

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Users, UserCheck, MapPin, Printer, Pencil,
  FileArchive, Download, ChevronDown, ChevronRight, Eye, X,
} from 'lucide-react';
import RoomsPanel from '@/components/aha/RoomsPanel';
import EditStationModal from '@/components/lab-day/EditStationModal';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';
import type { LabDay, Station as LabStation, Instructor, InstructorAvailabilityEntry } from '@/components/lab-day/types';
import {
  finalRoundSlots, labelRoundSlots, groupFinalStatus, roundsRunSoFar,
  type PalsCoordAttempt, type PalsCoordLabDay, type RoundSlot,
} from '@/lib/pals-coordinator';
import { PALS_FINAL_ROUNDS } from '@/lib/pals-group-result';

type Course = 'acls' | 'pals';

// ── shared bits ──────────────────────────────────────────────────────────

const card = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4';
const btn = 'inline-flex items-center gap-1.5 min-h-[44px] px-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed';

const Tile = ({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 min-w-0">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
    <div className={`text-2xl font-bold mt-0.5 ${tone || 'text-gray-900 dark:text-white'}`}>{value}</div>
    {sub && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

const Tag = ({ tone, children }: { tone?: 'go' | 'stop' | 'warn' | 'info'; children: React.ReactNode }) => {
  const cls: Record<string, string> = {
    go: 'border-green-600 text-green-700 dark:text-green-400',
    stop: 'border-red-600 text-red-700 dark:text-red-400',
    warn: 'border-amber-600 text-amber-700 dark:text-amber-400',
    info: 'border-blue-600 text-blue-700 dark:text-blue-400',
  };
  return <span className={`inline-flex items-center text-[11px] font-mono px-1.5 py-0.5 rounded-full border ${tone ? cls[tone] : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>{children}</span>;
};

const FINAL_RULE_TEXT: Record<Course, string> = {
  pals: 'PALS final, Day 2 Section E. Four scenario stations run three synchronized rounds, 25 minutes each; every station runs the same case in a given round. The group is the unit: a group passes by passing 2 of the 3 rounds, and every student in the group receives the group’s result for each round on their final sheet. A new team lead leads each round; the lead is recorded. Two fails opens remediation and a retest that links back to the failed rounds.',
  acls: 'Each student tests individually as team lead on a megacode; one passing megacode clears the student; the best passing sheet prints.',
};

const DIFF_ROWS: { spot: string; acls: string; pals: string }[] = [
  { spot: 'Final result', acls: 'Per student (best passing megacode)', pals: 'Per group, 2 of 3 synchronized rounds' },
  { spot: 'Practice cases', acls: 'Not a distinct phase', pals: 'Day 1 Section B + Day 2 Sections C/D, graded per TL' },
  { spot: 'Skill stations', acls: 'BLS / Airway, graded skills', pals: 'Learning stations, not graded — timer and reference sheet only' },
  { spot: 'Stats row', acls: 'Groups / Groups tested / Passed / Failed / Pending / Team-led', pals: 'Practice run / Students graded / Team-led / Watch flags / Final rounds / Groups ready' },
  { spot: 'Rooms', acls: 'This lab day, scenario stations by room', pals: 'Day 1 / Day 2 pickers, scenario stations by room' },
  { spot: 'Graded by', acls: 'Already stored', pals: 'Already stored' },
  { spot: 'Station timing', acls: 'Rotation minutes per station', pals: 'Per AHA case timing (sim + debrief); no per-station prebrief' },
  { spot: 'Printed at the end', acls: 'One megacode sheet per student', pals: 'Three final rounds per student, carrying the group result' },
  { spot: 'Temporary regroup', acls: 'Not built', pals: 'Board renders this PR; write path is P3c' },
  { spot: 'Student tap', acls: 'Opens the attempt record page', pals: 'Opens the student overlay (Today + Readiness)' },
  { spot: 'Regroup', acls: 'Not built', pals: 'This round / rest of today / rest of the course' },
  { spot: 'Access', acls: 'Any instructor', pals: 'Any instructor' },
];

function printDate(d?: string | null) {
  if (!d) return '';
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CoordinatorTracker() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params?.id as string;

  const [fullLabDay, setFullLabDay] = useState<LabDay | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [instructorAvailability, setInstructorAvailability] = useState<InstructorAvailabilityEntry[]>([]);
  const [editingStation, setEditingStation] = useState<LabStation | null>(null);
  const [autoRefreshSec, setAutoRefreshSec] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

  const loadDay = useCallback(async () => {
    if (!labDayId) return;
    try {
      const [ldRes, instRes, locRes] = await Promise.all([
        fetch(`/api/lab-management/lab-days/${labDayId}`),
        fetch('/api/lab-management/instructors'),
        fetch('/api/lab-management/locations?type=lab_rooms'),
      ]);
      const ld = await ldRes.json();
      const inst = await instRes.json();
      const loc = await locRes.json();
      if (ld.success) setFullLabDay(ld.labDay);
      if (inst.success) setInstructors(inst.instructors || []);
      if (loc.success) setLocations(loc.locations || []);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch { /* non-blocking */ }
  }, [labDayId]);

  useEffect(() => { if (status === 'authenticated') loadDay(); }, [loadDay, status, refreshTick]);

  useEffect(() => {
    if (status !== 'authenticated' || autoRefreshSec === 0) return;
    const t = setInterval(() => setRefreshTick((n) => n + 1), autoRefreshSec * 1000);
    return () => clearInterval(t);
  }, [autoRefreshSec, status]);

  const calEmails = useMemo(() => {
    const emails = new Set<string>();
    fullLabDay?.stations?.forEach((st) => { if (st.instructor_email) emails.add(st.instructor_email.toLowerCase()); });
    instructors.forEach((i) => { if (i.email) emails.add(i.email.toLowerCase()); });
    return Array.from(emails);
  }, [fullLabDay, instructors]);
  const { availability: calendarAvailability } = useCalendarAvailability(
    fullLabDay?.date || null, calEmails,
    fullLabDay?.start_time?.substring(0, 5) || '08:00', fullLabDay?.end_time?.substring(0, 5) || '17:00'
  );
  useEffect(() => {
    if (!fullLabDay?.date || !fullLabDay?.id) return;
    const labStart = fullLabDay.start_time || '08:00:00';
    const labEnd = fullLabDay.end_time || '17:00:00';
    fetch(`/api/lab-management/instructor-availability?date=${fullLabDay.date}&start_time=${labStart}&end_time=${labEnd}&lab_day_id=${fullLabDay.id}`)
      .then((res) => res.json())
      .then((data) => { if (data.success) setInstructorAvailability(data.instructors || []); })
      .catch(() => {});
  }, [fullLabDay?.date, fullLabDay?.id, fullLabDay?.start_time, fullLabDay?.end_time]);

  if (status === 'loading' || !fullLabDay) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }
  if (!session) return null;

  const course: Course = fullLabDay.cert_course === 'pals' ? 'pals' : 'acls';
  const courseLabel = course === 'pals' ? 'PALS' : 'ACLS';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-[3000px] mx-auto px-4 md:px-6 2xl:px-8 py-5">
        <nav className="text-xs text-gray-500 dark:text-gray-400 mb-2 print:hidden">
          Testing and certification / {courseLabel} Hub /{' '}
          {fullLabDay.cohort?.program?.abbreviation} {fullLabDay.cohort?.cohort_number ? `G${fullLabDay.cohort.cohort_number}` : ''} / Coordinator
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{courseLabel} Coordinator Tracker</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {printDate(fullLabDay.date)}
              {fullLabDay.cohort?.cohort_number ? ` · Cohort G${fullLabDay.cohort.cohort_number}` : ''}
              {fullLabDay.section_label ? ` · ${fullLabDay.section_label}` : ''}
              {' '}— progress tracker and adjustments; the hub is where the day runs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              Auto refresh
              <select
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-1"
              >
                <option value={0}>Off</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            </label>
            {lastRefreshed && <span className="text-[11px] text-gray-400 hidden sm:inline">updated {lastRefreshed}</span>}
            <button onClick={() => setRefreshTick((n) => n + 1)} className={btn}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={() => window.print()} className={btn}>
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {course === 'pals'
          ? <PalsBody fullLabDay={fullLabDay} refreshTick={refreshTick} />
          : <AclsBody labDayId={labDayId} fullLabDay={fullLabDay} instructors={instructors}
              calendarAvailability={calendarAvailability} instructorAvailability={instructorAvailability}
              editingStation={editingStation} setEditingStation={setEditingStation} refreshTick={refreshTick} />}
      </div>
      {editingStation && fullLabDay && (
        <EditStationModal
          station={editingStation}
          labDay={fullLabDay}
          instructors={instructors}
          locations={locations}
          calendarAvailability={calendarAvailability}
          instructorAvailability={instructorAvailability}
          session={session}
          onClose={() => setEditingStation(null)}
          onSaved={() => { setEditingStation(null); setRefreshTick((n) => n + 1); }}
        />
      )}
    </div>
  );
}

// ── ACLS body (unchanged behavior from the old acls-coordinator page) ─────

interface Student { id: string; first_name: string; last_name: string; status?: string | null }
interface Group { id: string; name: string; members: Student[] }
interface AclsDay { id: string; date: string; cohort_id?: string; cert_course: string | null; is_adv_cert_testing: boolean; cohort?: { cohort_number: number } | null }
interface AclsStation { id: string; station_number: number; instructor_name: string | null; room: string | null; custom_title: string | null; station_notes: string | null }
interface AclsAttempt {
  id: string; lab_group_id: string; overall_result: string; comments: string | null; started_at: string;
  team_lead?: { id: string; first_name: string; last_name: string } | null;
  scenario?: { id: string; name: string; case_code: string | null } | null;
  students?: { student_id: string }[];
}
const sname = (s?: { first_name: string; last_name: string } | null) => (s ? `${s.first_name} ${s.last_name}` : '-');

function AclsBody({
  labDayId, fullLabDay, instructors, calendarAvailability, instructorAvailability, editingStation, setEditingStation, refreshTick,
}: {
  labDayId: string; fullLabDay: LabDay; instructors: Instructor[];
  calendarAvailability: unknown; instructorAvailability: InstructorAvailabilityEntry[];
  editingStation: LabStation | null; setEditingStation: (s: LabStation | null) => void; refreshTick: number;
}) {
  const [day, setDay] = useState<AclsDay | null>(null);
  const [blankGroup, setBlankGroup] = useState('');
  const [blankVariant, setBlankVariant] = useState('2/5');
  const [groups, setGroups] = useState<Group[]>([]);
  const [stations, setStations] = useState<AclsStation[]>([]);
  const [attempts, setAttempts] = useState<AclsAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!labDayId) return;
    setLoading(true);
    try {
      const [ctxRes, attRes] = await Promise.all([
        fetch(`/api/adv-cert/grading-context?labDayId=${labDayId}`),
        fetch(`/api/adv-cert/attempts?labDayId=${labDayId}`),
      ]);
      const ctx = await ctxRes.json();
      const att = await attRes.json();
      if (ctx.success) { setDay(ctx.day); setGroups(ctx.groups || []); setStations(ctx.stations || []); }
      if (att.success) setAttempts(att.attempts || []);
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [labDayId]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const attemptsByGroup = useMemo(() => {
    const m = new Map<string, AclsAttempt[]>();
    for (const a of attempts) { const arr = m.get(a.lab_group_id); if (arr) arr.push(a); else m.set(a.lab_group_id, [a]); }
    return m;
  }, [attempts]);

  const stats = useMemo(() => {
    const passed = attempts.filter((a) => a.overall_result === 'pass').length;
    const failed = attempts.filter((a) => a.overall_result === 'fail').length;
    const groupsTested = new Set(attempts.map((a) => a.lab_group_id)).size;
    const pending = groups.length - groupsTested;
    const ledStudentIds = new Set(attempts.map((a) => a.team_lead?.id).filter(Boolean) as string[]);
    const allStudents = groups.flatMap((g) => g.members);
    const ledCount = allStudents.filter((s) => ledStudentIds.has(s.id)).length;
    return { passed, failed, groupsTested, pending, ledStudentIds, totalStudents: allStudents.length, ledCount };
  }, [attempts, groups]);

  return (
    <>
      {day?.cohort_id && (() => {
        const course = day.cert_course === 'pals' ? 'pals' : 'acls';
        const q = (extra: string) => `cohortId=${day.cohort_id}&course=${course}${extra}`;
        return (
          <section className={`mb-4 ${card} print:hidden`}>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Download className="w-4 h-4" /> Results export - whole cohort</h2>
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/api/reports/aha?template=megacode&${q('&print=1')}`} target="_blank" rel="noreferrer" className={btn}><Printer className="w-4 h-4" /> Print megacode sheets</a>
              <a href={`/api/reports/aha/zip?${q('&grouping=student')}`} className={btn}><FileArchive className="w-4 h-4" /> PDF zip (per student)</a>
              <a href={`/api/reports/aha/zip?${q('&grouping=section')}`} className={btn}><FileArchive className="w-4 h-4" /> PDF zip (by section)</a>
              <a href="/reports/aha" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">More options (blank forms, sign-off instructor)</a>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Blank forms (names, group and date filled; scoring blank) for:</span>
              <select value={blankGroup} onChange={(e) => setBlankGroup(e.target.value)} className="min-h-[44px] px-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                <option value="">Whole cohort</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select value={blankVariant} onChange={(e) => setBlankVariant(e.target.value)} className="min-h-[44px] px-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" title="Megacode scenario set">
                {['1/3/8', '2/5', '4/7/10', '6/11', '9', '12'].map((v) => <option key={v} value={v}>Megacode {v}</option>)}
              </select>
              {[['megacode', 'Megacode'], ['airway', 'Airway'], ['adult_bls', 'Adult BLS'], ['infant_cpr', 'Infant CPR']].map(([t, label]) => (
                <a key={t} href={`/api/reports/aha?template=${t}&${q('&blank=1&print=1')}${blankGroup ? `&labGroupId=${blankGroup}` : ''}${day.date ? `&date=${String(day.date).slice(0, 10)}` : ''}${t === 'megacode' ? `&variant=${encodeURIComponent(blankVariant)}` : ''}`} target="_blank" rel="noreferrer" className={btn}><Printer className="w-4 h-4" /> Blank {label}</a>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">The zip can take 30-60s to build. Per-student print links are on each group member below.</p>
          </section>
        );
      })()}

      {day && (
        <div className="hidden print:block text-black">
          <div className="mb-3 border-b border-black pb-2">
            <h1 className="text-xl font-bold">{(day.cert_course || 'ACLS').toUpperCase()} Team-Lead Tracking Sheet</h1>
            <p className="text-sm">
              {day.date}{day.cohort?.cohort_number ? ` · Cohort ${day.cohort.cohort_number}` : ''}
              {day.is_adv_cert_testing ? ' · scored testing day' : ''}{'   '}Coordinator: ____________________
            </p>
          </div>
          {groups.map((g) => {
            const gAttempts = attemptsByGroup.get(g.id) || [];
            return (
              <div key={g.id} className="mb-4" style={{ breakInside: 'avoid' }}>
                <div className="font-bold text-sm border-b border-black mb-1">
                  {g.name} ({g.members.length})
                  {gAttempts.length > 0 && <span className="font-normal">{' - recorded: '}{gAttempts.map((a) => `${a.overall_result.toUpperCase()} (TL ${sname(a.team_lead)})`).join(', ')}</span>}
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="text-left">
                    <th className="border border-black px-1 py-0.5 w-1/3">Student</th>
                    <th className="border border-black px-1 py-0.5">Team-led?</th>
                    <th className="border border-black px-1 py-0.5">Scenario / case</th>
                    <th className="border border-black px-1 py-0.5">Pass / Fail</th>
                    <th className="border border-black px-1 py-0.5 w-1/4">Notes</th>
                  </tr></thead>
                  <tbody>
                    {g.members.map((m) => (
                      <tr key={m.id}>
                        <td className="border border-black px-1 py-1">{m.last_name}, {m.first_name}{stats.ledStudentIds.has(m.id) ? ' ✓' : ''}</td>
                        <td className="border border-black px-1 py-1">☐</td>
                        <td className="border border-black px-1 py-1" />
                        <td className="border border-black px-1 py-1">P / F</td>
                        <td className="border border-black px-1 py-1" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <p className="text-[10px] mt-2">✓ = already recorded in the grader at print time. Use this sheet as a paper backup; enter results in the Megacode Grader when back online.</p>
        </div>
      )}

      <div className="print:hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !day ? (
          <div className={`text-sm text-gray-500 dark:text-gray-400 ${card}`}>No advanced-cert context for this lab day.</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
              <Tile label="Groups" value={groups.length} />
              <Tile label="Groups tested" value={`${stats.groupsTested}/${groups.length}`} />
              <Tile label="Passed" value={stats.passed} tone="text-green-600 dark:text-green-400" />
              <Tile label="Failed" value={stats.failed} tone="text-red-600 dark:text-red-400" />
              <Tile label="Pending" value={stats.pending} tone="text-amber-600 dark:text-amber-400" />
              <Tile label="Team-led" value={`${stats.ledCount}/${stats.totalStudents}`} />
            </div>

            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><MapPin className="w-4 h-4" /> Stations - who&apos;s teaching</h2>
              {stations.length === 0 ? <p className="text-xs text-gray-400">No stations recorded.</p> : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-2">
                  {stations.map((st) => (
                    <div key={st.id} className={`${card} text-xs`}>
                      <div className="font-medium text-gray-800 dark:text-gray-100">#{st.station_number} {st.room || st.custom_title || ''}</div>
                      {st.station_notes && <div className="text-gray-400">{st.station_notes}</div>}
                      <div className="text-gray-500 dark:text-gray-400 mt-0.5">{st.instructor_name || ' - unassigned - '}</div>
                      {(() => {
                        const full = fullLabDay?.stations?.find((x) => x.id === st.id);
                        return full ? (
                          <button type="button" onClick={() => setEditingStation(full)} className="mt-1.5 inline-flex items-center gap-1 min-h-[32px] px-2 text-blue-600 dark:text-blue-400 hover:underline print:hidden">
                            <Pencil className="w-3 h-3" /> Edit room / instructor
                          </button>
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Groups - status & what&apos;s next</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-2 items-start">
                {groups.map((g) => {
                  const gAttempts = attemptsByGroup.get(g.id) || [];
                  const tested = gAttempts.length > 0;
                  return (
                    <div key={g.id} className={card}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{g.name} <span className="text-xs text-gray-400">({g.members.length})</span></div>
                        {day?.cohort_id && (
                          <a href={`/api/reports/aha/zip?cohortId=${day.cohort_id}&course=${day.cert_course === 'pals' ? 'pals' : 'acls'}&labGroupId=${g.id}&grouping=student`} title={`PDF zip for ${g.name}`} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 print:hidden"><FileArchive className="w-4 h-4" /></a>
                        )}
                        {tested
                          ? <span className="text-xs inline-flex items-center gap-1">{gAttempts.map((a) => (a.overall_result === 'pass' ? <CheckCircle2 key={a.id} className="w-4 h-4 text-green-500" /> : <XCircle key={a.id} className="w-4 h-4 text-red-500" />))}</span>
                          : <span className="text-xs inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock className="w-3.5 h-3.5" /> pending</span>}
                      </div>
                      {gAttempts.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {gAttempts.map((a) => (
                            <Link key={a.id} href={`/labs/adv-cert/attempt/${a.id}`} className="text-[11px] text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-2 min-h-[44px] px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <span className={a.overall_result === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{a.overall_result.toUpperCase()}</span>
                              <span>{a.scenario?.case_code ? `[${a.scenario.case_code}] ` : ''}{a.scenario?.name || 'scenario'}</span>
                              <span className="inline-flex items-center gap-0.5"><UserCheck className="w-3 h-3" /> TL: {sname(a.team_lead)}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {g.members.map((m) => {
                          const led = stats.ledStudentIds.has(m.id);
                          return (
                            <a key={m.id} href={`/api/reports/aha?template=megacode&studentId=${m.id}&course=${day?.cert_course === 'pals' ? 'pals' : 'acls'}&print=1`} target="_blank" rel="noreferrer" title={`Print ${m.first_name} ${m.last_name} results`} className={`text-[10px] px-1.5 py-0.5 rounded-full hover:underline ${led ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                              {led ? '✓ ' : ''}{m.first_name} {m.last_name}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">Green = student has team-led a scored attempt today. Grade in the Megacode Grader; this view reflects saved results.</p>
            </section>

            <HowFinalTested course="acls" />
            <RoomsPanel days={[{ id: fullLabDay.id, date: String(fullLabDay.date).slice(0, 10) }]} refreshTick={refreshTick} onChanged={load} />
            <WhatDiffers />
          </div>
        )}
      </div>
    </>
  );
}

// ── PALS body ───────────────────────────────────────────────────────────

interface PalsGroup { id: string; name: string; members: { id: string; first_name: string; last_name: string }[] }
interface PalsHubResponse {
  cohort: { id: string; cohort_number: number; program?: { abbreviation: string } } | null;
  dates: string[];
  labDays: PalsCoordLabDay[];
  groups: PalsGroup[];
  attempts: PalsCoordAttempt[];
}

function HowFinalTested({ course }: { course: Course }) {
  return (
    <section className={card}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">How the final is tested</h2>
      <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">{FINAL_RULE_TEXT[course]}</p>
    </section>
  );
}

function WhatDiffers() {
  const [open, setOpen] = useState(false);
  return (
    <section className={card}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-300 w-full text-left">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} What differs from the ACLS Coordinator Tracker
      </button>
      {open && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[11px] uppercase text-gray-500">
              <th className="py-1 pr-3">Spot</th><th className="py-1 pr-3">ACLS</th><th className="py-1">PALS</th>
            </tr></thead>
            <tbody>
              {DIFF_ROWS.map((r) => (
                <tr key={r.spot} className="border-t border-gray-200 dark:border-gray-700 align-top">
                  <td className="py-1.5 pr-3 font-medium text-gray-800 dark:text-gray-100">{r.spot}</td>
                  <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{r.acls}</td>
                  <td className="py-1.5 text-gray-600 dark:text-gray-400">{r.pals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type MoveDuration = 'round' | 'today' | 'course';
interface TempMove { studentId: string; fromGroupId: string; toGroupId: string; duration: MoveDuration }

function PalsBody({ fullLabDay, refreshTick }: { fullLabDay: LabDay; refreshTick: number }) {
  const [hub, setHub] = useState<PalsHubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regroupOpen, setRegroupOpen] = useState(false);
  const [moves, setMoves] = useState<TempMove[]>([]);
  const [moveDialog, setMoveDialog] = useState<{ studentId: string; studentName: string; fromGroupId: string; toGroupId: string; toGroupName: string } | null>(null);
  const [resultOverlay, setResultOverlay] = useState<{ group: PalsGroup; round: number } | null>(null);
  const [studentOverlay, setStudentOverlay] = useState<{ student: { id: string; first_name: string; last_name: string }; group: PalsGroup } | null>(null);

  const cohortId = fullLabDay.cohort?.id;

  const load = useCallback(async () => {
    if (!cohortId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/adv-cert/pals-hub?cohortId=${encodeURIComponent(cohortId)}`);
      const data = await res.json();
      if (data.success) setHub(data);
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [cohortId]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const labDays = hub?.labDays ?? [];
  const groups = hub?.groups ?? [];
  const attempts = hub?.attempts ?? [];

  const handleDropStudent = useCallback((studentId: string, fromGroupId: string, toGroupId: string) => {
    if (fromGroupId === toGroupId) return;
    const toGroup = groups.find((g) => g.id === toGroupId);
    const student = groups.flatMap((g) => g.members).find((s) => s.id === studentId);
    if (!toGroup || !student) return;
    setMoveDialog({ studentId, studentName: `${student.last_name}, ${student.first_name}`, fromGroupId, toGroupId, toGroupName: toGroup.name });
  }, [groups]);

  const testingDays = useMemo(() => labDays.filter((d) => d.is_adv_cert_testing), [labDays]);
  const practiceDays = useMemo(() => labDays.filter((d) => !d.is_adv_cert_testing), [labDays]);
  const testingAttempts = useMemo(() => {
    const ids = new Set(testingDays.map((d) => d.id));
    return attempts.filter((a) => ids.has(a.lab_day_id));
  }, [attempts, testingDays]);
  const practiceAttempts = useMemo(() => {
    const ids = new Set(practiceDays.map((d) => d.id));
    return attempts.filter((a) => ids.has(a.lab_day_id));
  }, [attempts, practiceDays]);

  const roundSlots: RoundSlot[] = useMemo(() => labelRoundSlots(finalRoundSlots(testingDays), testingAttempts), [testingDays, testingAttempts]);

  const stats = useMemo(() => {
    const allStudents = groups.flatMap((g) => g.members);
    const totalStudents = allStudents.length;

    // "Cases run" out of every (group x practice station) rotation slot across
    // Day 1 Section B + Day 2 Sections C/D. Deduped per (group, scenario) so a
    // retest/regrade doesn't double-count.
    const practiceSlots = practiceDays.reduce((sum, d) => sum + d.stations.length, 0) * (groups.length || 0);
    const practiceRun = new Set(practiceAttempts.filter((a) => a.lab_group_id && a.scenario?.id).map((a) => `${a.lab_group_id}:${a.scenario!.id}`)).size;

    const gradedStudentIds = new Set(practiceAttempts.map((a) => a.team_lead?.id).filter(Boolean) as string[]);
    const ledStudentIds = new Set(attempts.map((a) => a.team_lead?.id).filter(Boolean) as string[]);

    const watchAttempts = practiceAttempts.filter((a) => a.watch === true);
    const watchStudentIds = new Set(watchAttempts.map((a) => a.team_lead?.id).filter(Boolean) as string[]);

    const roundsRun = roundsRunSoFar(testingAttempts, roundSlots);

    const groupStatuses = groups.map((g) => groupFinalStatus(g.id, testingAttempts, roundSlots).groupResult.status);
    const ready = groupStatuses.filter((s) => s === 'pass').length;
    const canStillPass = groupStatuses.filter((s) => s === 'pending').length;
    const notReady = groupStatuses.filter((s) => s === 'fail').length;

    return {
      practiceRun, practiceSlots,
      gradedCount: gradedStudentIds.size, totalStudents,
      ledCount: ledStudentIds.size,
      watchCount: watchAttempts.length, watchStudentCount: watchStudentIds.size,
      roundsRun,
      ready, canStillPass, notReady,
    };
  }, [groups, practiceAttempts, attempts, testingAttempts, roundSlots, practiceDays]);

  if (loading && !hub) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <section className={`${card} print:hidden`}>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Download className="w-4 h-4" /> Results export - whole cohort</h2>
        <p className="text-[11px] text-gray-400 mb-2">What each button is, in plain words.</p>
        <div className="flex flex-wrap items-center gap-2">
          <a href={cohortId ? `/api/reports/aha?template=megacode&cohortId=${cohortId}&course=pals&print=1` : '#'} target="_blank" rel="noreferrer" className={btn} aria-disabled={!cohortId}>
            <Printer className="w-4 h-4" /> Print case sheets
          </a>
          <button type="button" disabled title="Fills the official AHA PDFs; needs the templates from the AHA PDFs card" className={`${btn} bg-cyan-700 hover:bg-cyan-700 text-white border-cyan-700`}>
            Official AHA forms (passing results)
          </button>
          <a href={cohortId ? `/api/reports/aha/zip?cohortId=${cohortId}&course=pals&grouping=student` : '#'} className={btn} aria-disabled={!cohortId}>
            <FileArchive className="w-4 h-4" /> PDF zip, one file per student
          </a>
          <BlankSheetsMenu cohortId={cohortId} />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Print = look at it now. Zip = file it. Official AHA forms = the record for the shared drive. Blank = paper fallback if a station is offline. The zip can take 30 to 60 seconds.</p>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3 print:hidden">
        <Tile label="Practice cases run" value={`${stats.practiceRun}/${stats.practiceSlots}`} sub="Day 1 B + Day 2 C, D" />
        <Tile label="Students graded" value={`${stats.gradedCount}/${stats.totalStudents}`} sub="at least one practice case" />
        <Tile label="Team-led" value={`${stats.ledCount}/${stats.totalStudents}`} sub="practice or final" />
        <Tile label="Watch flags" value={stats.watchCount} tone="text-amber-600 dark:text-amber-400" sub={`${stats.watchStudentCount} students, from practice`} />
        <Tile label="Final rounds" value={`${stats.roundsRun}/${PALS_FINAL_ROUNDS}`} sub="Section E, synchronized" />
        <Tile label="Groups ready" value={`${stats.ready}/${groups.length}`} tone="text-green-600 dark:text-green-400" sub={`${stats.canStillPass} can still pass, ${stats.notReady} not ready`} />
      </div>

      <HowFinalTested course="pals" />

      <section className="print:hidden">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Users className="w-4 h-4" /> Groups - final rounds and practice history</h2>
        <p className="text-[11px] text-gray-400 mb-2">Final: group passes 2 of 3, every member gets the group result.</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(19rem,1fr))] gap-3 items-start">
          {groups.map((g) => (
            <GroupCard
              key={g.id} group={g} groups={groups} roundSlots={roundSlots} testingAttempts={testingAttempts} practiceAttempts={practiceAttempts}
              onOpenRound={(round) => setResultOverlay({ group: g, round })}
              onOpenStudent={(student) => setStudentOverlay({ student, group: g })}
              onDropStudent={handleDropStudent}
              movesOut={moves.filter((m) => m.fromGroupId === g.id)}
              movesIn={moves.filter((m) => m.toGroupId === g.id)}
            />
          ))}
          {groups.length === 0 && <p className="text-xs text-gray-400">No lab groups for this cohort yet.</p>}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Green chip = student has team-led a graded case (practice or final). Watch = flagged on a practice case, carried here so a struggling student is visible before the final.
          Drag a chip onto another group to move the student for a round; the chip shows where they came from. Tap a round or a practice row to open that attempt record.
          Grade in the PALS grader; this view reflects saved results.
        </p>
      </section>

      <RoomsPanel days={labDays.map((d) => ({ id: d.id, date: d.date }))} refreshTick={refreshTick} onChanged={load} />

      <section className={`${card} print:hidden`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Regroup students</h2>
          <button type="button" onClick={() => setRegroupOpen((o) => !o)} className={btn}>
            {regroupOpen ? 'Close regroup' : 'Open regroup'}
          </button>
        </div>
        {regroupOpen && <RegroupBoard groups={groups} attempts={attempts} moves={moves} onDropStudent={handleDropStudent} />}
      </section>

      <WhatDiffers />

      {moveDialog && (
        <MoveDialog
          dialog={moveDialog}
          onCancel={() => setMoveDialog(null)}
          onPick={(duration) => {
            setMoves((prev) => [
              ...prev.filter((m) => m.studentId !== moveDialog.studentId),
              { studentId: moveDialog.studentId, fromGroupId: moveDialog.fromGroupId, toGroupId: moveDialog.toGroupId, duration },
            ]);
            setMoveDialog(null);
          }}
        />
      )}
      {resultOverlay && <ResultOverlay data={resultOverlay} roundSlots={roundSlots} testingAttempts={testingAttempts} onClose={() => setResultOverlay(null)} />}
      {studentOverlay && <StudentOverlay data={studentOverlay} attempts={attempts} roundSlots={roundSlots} testingAttempts={testingAttempts} onClose={() => setStudentOverlay(null)} />}
    </div>
  );
}

function BlankSheetsMenu({ cohortId }: { cohortId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${btn} border-dashed`}>
        Blank sheets, paper backup
      </button>
      {open && (
        <div className="absolute z-10 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[16rem]">
          <a href={cohortId ? `/api/reports/aha?template=megacode&cohortId=${cohortId}&course=pals&blank=1&print=1` : '#'} target="_blank" rel="noreferrer" className="block px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Blank case testing sheet (group, names filled)</a>
          <a href={cohortId ? `/api/reports/aha?template=megacode&cohortId=${cohortId}&course=pals&blank=1&practice=1&print=1` : '#'} target="_blank" rel="noreferrer" className="block px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Blank practice case sheet</a>
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group, groups, roundSlots, testingAttempts, practiceAttempts, onOpenRound, onOpenStudent, onDropStudent, movesOut, movesIn,
}: {
  group: PalsGroup; groups: PalsGroup[]; roundSlots: RoundSlot[]; testingAttempts: PalsCoordAttempt[]; practiceAttempts: PalsCoordAttempt[];
  onOpenRound: (round: number) => void; onOpenStudent: (student: { id: string; first_name: string; last_name: string }) => void;
  onDropStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
  movesOut: TempMove[]; movesIn: TempMove[];
}) {
  const { outcomes, groupResult } = groupFinalStatus(group.id, testingAttempts, roundSlots);
  const verdict = groupResult.status === 'pass'
    ? { label: `READY, ${groupResult.passedRounds} of ${PALS_FINAL_ROUNDS}`, tone: 'go' as const, border: 'border-green-500' }
    : groupResult.status === 'fail'
      ? { label: `NOT READY, ${groupResult.failedRounds} fails`, tone: 'stop' as const, border: 'border-red-500' }
      : { label: `${groupResult.passedRounds} of ${groupResult.passedRounds + groupResult.failedRounds}, round ${groupResult.passedRounds + groupResult.failedRounds + 1} decides`, tone: 'warn' as const, border: 'border-amber-500' };

  const myPractice = practiceAttempts.filter((a) => a.lab_group_id === group.id);
  const movedOutIds = new Set(movesOut.map((m) => m.studentId));
  const visibleMembers = group.members.filter((m) => !movedOutIds.has(m.id));
  const ledStudentIds = new Set([...testingAttempts, ...practiceAttempts].map((a) => a.team_lead?.id).filter(Boolean) as string[]);
  const watchStudentIds = new Set(myPractice.filter((a) => a.watch === true).map((a) => a.team_lead?.id).filter(Boolean) as string[]);

  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`${card} border-2 ${verdict.border}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const studentId = e.dataTransfer.getData('text/plain');
        const fromGroupId = e.dataTransfer.getData('application/x-group-id');
        if (studentId && fromGroupId) onDropStudent(studentId, fromGroupId, group.id);
      }}
      style={dragOver ? { outline: '2px dashed #0891b2', outlineOffset: '2px' } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-900 dark:text-white">{group.name} <span className="text-xs text-gray-400 font-normal">({group.members.length})</span></div>
        <Tag tone={verdict.tone}>{verdict.label}</Tag>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Final rounds, Section E</div>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {outcomes.map((o) => (
            <button
              key={o.round} type="button" onClick={() => onOpenRound(o.round)}
              className="text-left bg-gray-50 dark:bg-gray-900/40 rounded-lg p-2 min-h-[44px] hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Round {o.round}</div>
              <div className={`text-xs font-bold ${o.result === 'PASS' ? 'text-green-600 dark:text-green-400' : o.result === 'NR' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {o.result === 'PASS' ? 'PASS' : o.result === 'NR' ? 'FAIL' : 'pending'}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{roundSlots[o.round - 1]?.scenarioTitle || roundSlots[o.round - 1]?.caseCode || ''}</div>
              {o.attempt?.team_lead && <div className="text-[10px] text-gray-500 dark:text-gray-400">TL {sname(o.attempt.team_lead)}</div>}
            </button>
          ))}
        </div>
      </div>

      {groupResult.status === 'fail' && (
        <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-[11px] text-red-800 dark:text-red-300">
          2 of 3 final rounds failed. Instructor note: none entered yet.
        </div>
      )}

      {myPractice.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Practice cases, graded per student</div>
          <div className="space-y-1 mt-1">
            {myPractice.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[11px]">
                <span className="text-gray-700 dark:text-gray-300 truncate">{a.scenario?.title || a.scenario?.case_code || 'case'}</span>
                <span className="flex items-center gap-1 font-mono">
                  <span className={a.result === 'PASS' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>TL {sname(a.team_lead)} {a.result === 'PASS' ? 'pass' : 'fail'}</span>
                  {a.watch && <Tag tone="warn">watch</Tag>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Students</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {visibleMembers.map((m) => (
            <button
              key={m.id} type="button" draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.setData('application/x-group-id', group.id); }}
              onClick={() => onOpenStudent(m)}
              className={`text-[11px] px-2 py-1 rounded-full border ${ledStudentIds.has(m.id) ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
            >
              {m.first_name} {m.last_name}
              {watchStudentIds.has(m.id) && <span className="ml-1 text-amber-600 dark:text-amber-400">watch</span>}
            </button>
          ))}
          {movesIn.map((m) => {
            const student = groups.flatMap((g) => g.members).find((s) => s.id === m.studentId);
            const fromGroup = groups.find((g) => g.id === m.fromGroupId);
            const durationLabel = m.duration === 'round' ? 'this round' : m.duration === 'today' ? 'rest of today' : 'rest of the course';
            return (
              <span key={m.studentId} className="text-[11px] px-2 py-1 rounded-full border border-dashed border-blue-400 text-blue-700 dark:text-blue-300">
                {student ? `${student.first_name} ${student.last_name} ` : ''}from {fromGroup?.name ?? 'another group'} · {durationLabel}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RegroupBoard({
  groups, attempts, moves, onDropStudent,
}: {
  groups: PalsGroup[]; attempts: PalsCoordAttempt[]; moves: TempMove[];
  onDropStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
}) {
  const ledIds = new Set(attempts.filter((a) => a.result !== 'PASS').map((a) => a.team_lead?.id).filter(Boolean) as string[]);
  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Drag a chip to another column to move that student. The move only applies here until P3c adds the write path — nothing is saved to the roster yet.</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
        {groups.map((g) => {
          const movedOut = new Set(moves.filter((m) => m.fromGroupId === g.id).map((m) => m.studentId));
          const members = g.members.filter((m) => !movedOut.has(m.id));
          const failCount = members.filter((m) => ledIds.has(m.id)).length;
          return (
            <div
              key={g.id}
              className="bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 p-2 min-h-[8rem]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const studentId = e.dataTransfer.getData('text/plain');
                const fromGroupId = e.dataTransfer.getData('application/x-group-id');
                if (studentId && fromGroupId) onDropStudent(studentId, fromGroupId, g.id);
              }}
            >
              <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">{g.name}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">{members.length} students · {failCount} fail · {members.length} led</div>
              <div className="space-y-1">
                {members.map((m) => (
                  <div
                    key={m.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.setData('application/x-group-id', g.id); }}
                    className="text-xs px-2 py-1.5 min-h-[32px] rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-grab"
                  >
                    {m.last_name}, {m.first_name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MoveDialog({
  dialog, onCancel, onPick,
}: {
  dialog: { studentName: string; toGroupName: string }; onCancel: () => void; onPick: (duration: MoveDuration) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className={`${card} max-w-sm w-full`} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Move {dialog.studentName} to {dialog.toGroupName}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">How long does this move last?</p>
        <div className="space-y-2">
          <button type="button" onClick={() => onPick('round')} className="w-full min-h-[44px] text-left px-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">This round only</button>
          <button type="button" onClick={() => onPick('today')} className="w-full min-h-[44px] text-left px-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Rest of today</button>
          <button type="button" onClick={() => onPick('course')} className="w-full min-h-[44px] text-left px-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Rest of the course</button>
        </div>
        <button type="button" onClick={onCancel} className="mt-3 text-xs text-gray-500 hover:underline">Cancel</button>
      </div>
    </div>
  );
}

function ResultOverlay({
  data, roundSlots, testingAttempts, onClose,
}: { data: { group: PalsGroup; round: number }; roundSlots: RoundSlot[]; testingAttempts: PalsCoordAttempt[]; onClose: () => void }) {
  const { outcomes } = groupFinalStatus(data.group.id, testingAttempts, roundSlots);
  const outcome = outcomes[data.round - 1];
  const slot = roundSlots[data.round - 1];
  if (!outcome?.attempt) {
    return (
      <Modal onClose={onClose} title={`${data.group.name} - Round ${data.round}`}>
        <p className="text-sm text-gray-600 dark:text-gray-400">This round has not been graded yet. The grader opens from the station on the hub.</p>
      </Modal>
    );
  }
  const a = outcome.attempt;
  return (
    <Modal onClose={onClose} title={`${data.group.name} - Round ${data.round}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{slot?.scenarioTitle || slot?.caseCode || ''} - TL {sname(a.team_lead)}</p>
      <div className="text-xs flex flex-wrap gap-3 mb-3">
        <span>Result <strong className={outcome.result === 'PASS' ? 'text-green-600' : 'text-red-600'}>{outcome.result === 'PASS' ? 'PASS' : 'FAIL'}</strong></span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Criterion-level detail and the instructor debrief note open from the attempt record in the PALS grader.</p>
    </Modal>
  );
}

function StudentOverlay({
  data, attempts, roundSlots, testingAttempts, onClose,
}: {
  data: { student: { id: string; first_name: string; last_name: string }; group: PalsGroup };
  attempts: PalsCoordAttempt[]; roundSlots: RoundSlot[]; testingAttempts: PalsCoordAttempt[]; onClose: () => void;
}) {
  const mine = attempts.filter((a) => a.team_lead?.id === data.student.id);
  const { groupResult } = groupFinalStatus(data.group.id, testingAttempts, roundSlots);
  return (
    <Modal onClose={onClose} title={`${data.student.first_name} ${data.student.last_name}`}>
      <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Today</div>
          {mine.length === 0 ? <p className="text-xs text-gray-400">No graded cases today.</p> : (
            <table className="w-full text-[11px]">
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-1 pr-2">{a.scenario?.title || a.scenario?.case_code}</td>
                    <td className={`py-1 pr-2 font-semibold ${a.result === 'PASS' ? 'text-green-600' : 'text-red-600'}`}>{a.result}</td>
                    {a.watch && <td className="py-1"><Tag tone="warn">watch</Tag></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Readiness</div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Team-led today: {mine.length > 0 ? 'yes' : 'no'}.</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Final result follows the group: {groupResult.passedRounds} of {groupResult.passedRounds + groupResult.failedRounds} so far, {groupResult.status === 'pass' ? 'READY' : groupResult.status === 'fail' ? 'NOT READY' : 'pending'}.</p>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`${card} max-w-lg w-full max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"><Eye className="w-4 h-4" /> {title}</h3>
          <button type="button" onClick={onClose} className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
