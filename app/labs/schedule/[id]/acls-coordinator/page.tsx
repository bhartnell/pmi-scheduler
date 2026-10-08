'use client';

/**
 * ACLS Coordinator Tracker — read-only stats + plan-state for an advanced-cert
 * (ACLS/PALS) lab day. NOT operational dispatch (that's the NREMT coordinator);
 * this is "where we are / what's next / who's teaching" + team-lead & megacode
 * stats, for clarity and ad-hoc adjustment during the day.
 *
 * Pure aggregator over existing data:
 *   - /api/adv-cert/grading-context?labDayId= → day, cohort, groups+members, stations
 *   - /api/adv-cert/attempts?labDayId=        → scored megacode attempts
 */

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Users, UserCheck, MapPin, Printer, Pencil, FileArchive, Download } from 'lucide-react';
import EditStationModal from '@/components/lab-day/EditStationModal';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';
import type { LabDay, Station as LabStation, Instructor, InstructorAvailabilityEntry } from '@/components/lab-day/types';

interface Student { id: string; first_name: string; last_name: string; status?: string | null }
interface Group { id: string; name: string; members: Student[] }
interface Station { id: string; station_number: number; instructor_name: string | null; room: string | null; custom_title: string | null; station_notes: string | null }
interface Day { id: string; date: string; cohort_id?: string; cert_course: string | null; is_adv_cert_testing: boolean; cohort?: { cohort_number: number } | null }
interface Attempt {
  id: string; lab_group_id: string; overall_result: string; comments: string | null; started_at: string;
  team_lead?: { id: string; first_name: string; last_name: string } | null;
  scenario?: { id: string; name: string; case_code: string | null } | null;
  students?: { student_id: string }[];
}

const sname = (s?: { first_name: string; last_name: string } | null) => s ? `${s.first_name} ${s.last_name}` : '—';

export default function AclsCoordinatorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params?.id as string;

  const [day, setDay] = useState<Day | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefreshSec, setAutoRefreshSec] = useState(0); // 0 = off
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  // Station editing reuses the normal lab-day EditStationModal (room picker +
  // instructor dropdown over the standard instructor list, same save path).
  const [fullLabDay, setFullLabDay] = useState<LabDay | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [instructorAvailability, setInstructorAvailability] = useState<InstructorAvailabilityEntry[]>([]);
  const [editingStation, setEditingStation] = useState<LabStation | null>(null);

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

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
      } catch { /* editing unavailable; read-only view still works */ }
      if (ctx.success) { setDay(ctx.day); setGroups(ctx.groups || []); setStations(ctx.stations || []); }
      if (att.success) setAttempts(att.attempts || []);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [labDayId]);

  useEffect(() => { if (status === 'authenticated') load(); }, [load, status]);

  // Auto-refresh: poll on the selected interval (live-updating display during the course).
  useEffect(() => {
    if (status !== 'authenticated' || autoRefreshSec === 0) return;
    const t = setInterval(() => load(), autoRefreshSec * 1000);
    return () => clearInterval(t);
  }, [autoRefreshSec, status, load]);

  const calEmails = useMemo(() => {
    const emails = new Set<string>();
    fullLabDay?.stations?.forEach(st => { if (st.instructor_email) emails.add(st.instructor_email.toLowerCase()); });
    instructors.forEach(i => { if (i.email) emails.add(i.email.toLowerCase()); });
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
      .then(res => res.json())
      .then(data => { if (data.success) setInstructorAvailability(data.instructors || []); })
      .catch(() => {});
  }, [fullLabDay?.date, fullLabDay?.id, fullLabDay?.start_time, fullLabDay?.end_time]);

  // Attempts indexed by group.
  const attemptsByGroup = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of attempts) { const arr = m.get(a.lab_group_id); if (arr) arr.push(a); else m.set(a.lab_group_id, [a]); }
    return m;
  }, [attempts]);

  // Stats.
  const stats = useMemo(() => {
    const passed = attempts.filter(a => a.overall_result === 'pass').length;
    const failed = attempts.filter(a => a.overall_result === 'fail').length;
    const groupsTested = new Set(attempts.map(a => a.lab_group_id)).size;
    const pending = groups.length - groupsTested;
    // team-lead coverage: which students have led a tested attempt today
    const ledStudentIds = new Set(attempts.map(a => a.team_lead?.id).filter(Boolean) as string[]);
    const allStudents = groups.flatMap(g => g.members);
    const ledCount = allStudents.filter(s => ledStudentIds.has(s.id)).length;
    return { passed, failed, groupsTested, pending, ledStudentIds, totalStudents: allStudents.length, ledCount };
  }, [attempts, groups]);

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  if (!session) return null;

  const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <div className={`text-xl font-bold ${tone || 'text-gray-900 dark:text-white'}`}>{value}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 py-5">
        <Link href={`/labs/schedule/${labDayId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3 print:hidden">
          <ArrowLeft className="w-4 h-4" /> Lab Day
        </Link>
        <Link href="/labs/acls-hub" className="ml-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:underline print:hidden">/ ACLS Hub</Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ACLS Coordinator Tracker</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {day?.date}{day?.cohort?.cohort_number ? ` · Cohort ${day.cohort.cohort_number}` : ''}
              {day?.is_adv_cert_testing ? ' · scored testing day' : ''} — stats & plan-state (not dispatch)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              Auto
              <select
                value={autoRefreshSec}
                onChange={e => setAutoRefreshSec(Number(e.target.value))}
                className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-1"
              >
                <option value={0}>Off</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            </label>
            {lastRefreshed && <span className="text-[11px] text-gray-400 hidden sm:inline">updated {lastRefreshed}</span>}
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {day?.cohort_id && (() => {
          const course = day.cert_course === 'pals' ? 'pals' : 'acls';
          const q = (extra: string) => `cohortId=${day.cohort_id}&course=${course}${extra}`;
          const btn = 'inline-flex items-center gap-1 min-h-[44px] px-3 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700';
          return (
            <section className="mb-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 print:hidden">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Download className="w-4 h-4" /> Results export — whole cohort</h2>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/api/reports/aha?template=megacode&${q('&print=1')}`} target="_blank" rel="noreferrer" className={btn}><Printer className="w-4 h-4" /> Print megacode sheets</a>
                <a href={`/api/reports/aha/zip?${q('&grouping=student')}`} className={btn}><FileArchive className="w-4 h-4" /> PDF zip (per student)</a>
                <a href={`/api/reports/aha/zip?${q('&grouping=section')}`} className={btn}><FileArchive className="w-4 h-4" /> PDF zip (by section)</a>
                <a href="/reports/aha" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">More options (blank forms, sign-off instructor)</a>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">The zip can take 30–60s to build. Per-student print links are on each group member below.</p>
            </section>
          );
        })()}

        {/* Print-only team-lead tracking sheet — paper backup for the course (complements the Google-forms fallback). */}
        {day && (
          <div className="hidden print:block text-black">
            <div className="mb-3 border-b border-black pb-2">
              <h1 className="text-xl font-bold">
                {(day.cert_course || 'ACLS').toUpperCase()} Team-Lead Tracking Sheet
              </h1>
              <p className="text-sm">
                {day.date}{day.cohort?.cohort_number ? ` · Cohort ${day.cohort.cohort_number}` : ''}
                {day.is_adv_cert_testing ? ' · scored testing day' : ''}
                {'   '}Coordinator: ____________________
              </p>
            </div>
            {groups.map(g => {
              const gAttempts = attemptsByGroup.get(g.id) || [];
              return (
                <div key={g.id} className="mb-4" style={{ breakInside: 'avoid' }}>
                  <div className="font-bold text-sm border-b border-black mb-1">
                    {g.name} ({g.members.length})
                    {gAttempts.length > 0 && (
                      <span className="font-normal">
                        {'  — recorded: '}
                        {gAttempts.map(a => `${a.overall_result.toUpperCase()} (TL ${sname(a.team_lead)})`).join(', ')}
                      </span>
                    )}
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left">
                        <th className="border border-black px-1 py-0.5 w-1/3">Student</th>
                        <th className="border border-black px-1 py-0.5">Team-led?</th>
                        <th className="border border-black px-1 py-0.5">Scenario / case</th>
                        <th className="border border-black px-1 py-0.5">Pass / Fail</th>
                        <th className="border border-black px-1 py-0.5 w-1/4">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.members.map(m => (
                        <tr key={m.id}>
                          <td className="border border-black px-1 py-1">
                            {m.last_name}, {m.first_name}
                            {stats.ledStudentIds.has(m.id) ? ' ✓' : ''}
                          </td>
                          <td className="border border-black px-1 py-1">☐</td>
                          <td className="border border-black px-1 py-1"></td>
                          <td className="border border-black px-1 py-1">P / F</td>
                          <td className="border border-black px-1 py-1"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <p className="text-[10px] mt-2">
              ✓ = already recorded in the grader at print time. Use this sheet as a paper backup; enter results in the Megacode Grader when back online.
            </p>
          </div>
        )}

        <div className="print:hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !day ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            No advanced-cert context for this lab day.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Stat label="Groups" value={groups.length} />
              <Stat label="Groups tested" value={`${stats.groupsTested}/${groups.length}`} />
              <Stat label="Passed" value={stats.passed} tone="text-green-600 dark:text-green-400" />
              <Stat label="Failed" value={stats.failed} tone="text-red-600 dark:text-red-400" />
              <Stat label="Pending" value={stats.pending} tone="text-amber-600 dark:text-amber-400" />
              <Stat label="Team-led" value={`${stats.ledCount}/${stats.totalStudents}`} />
            </div>

            {/* Plan-state: who's teaching / where */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><MapPin className="w-4 h-4" /> Stations — who&apos;s teaching</h2>
              {stations.length === 0 ? <p className="text-xs text-gray-400">No stations recorded.</p> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {stations.map(st => (
                    <div key={st.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-xs">
                      <div className="font-medium text-gray-800 dark:text-gray-100">#{st.station_number} {st.room || st.custom_title || ''}</div>
                      {st.station_notes && <div className="text-gray-400">{st.station_notes}</div>}
                      <div className="text-gray-500 dark:text-gray-400 mt-0.5">{st.instructor_name || '— unassigned —'}</div>
                      {(() => {
                        const full = fullLabDay?.stations?.find(x => x.id === st.id);
                        return full ? (
                          <button type="button" onClick={() => setEditingStation(full)}
                            className="mt-1.5 inline-flex items-center gap-1 min-h-[32px] px-2 text-blue-600 dark:text-blue-400 hover:underline print:hidden">
                            <Pencil className="w-3 h-3" /> Edit room / instructor
                          </button>
                        ) : null;
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Groups: status + what's next */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Groups — status & what&apos;s next</h2>
              <div className="grid grid-cols-4 max-xl:grid-cols-2 max-md:grid-cols-1 gap-2 items-start">
                {groups.map(g => {
                  const gAttempts = attemptsByGroup.get(g.id) || [];
                  const tested = gAttempts.length > 0;
                  return (
                    <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{g.name} <span className="text-xs text-gray-400">({g.members.length})</span></div>
                        {day?.cohort_id && (
                          <a href={`/api/reports/aha/zip?cohortId=${day.cohort_id}&course=${day.cert_course === 'pals' ? 'pals' : 'acls'}&labGroupId=${g.id}&grouping=student`} title={`PDF zip for ${g.name}`} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 print:hidden"><FileArchive className="w-4 h-4" /></a>
                        )}
                        {tested
                          ? <span className="text-xs inline-flex items-center gap-1">{gAttempts.map(a => a.overall_result === 'pass'
                              ? <CheckCircle2 key={a.id} className="w-4 h-4 text-green-500" />
                              : <XCircle key={a.id} className="w-4 h-4 text-red-500" />)}</span>
                          : <span className="text-xs inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock className="w-3.5 h-3.5" /> pending</span>}
                      </div>
                      {gAttempts.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {gAttempts.map(a => (
                            <Link key={a.id} href={`/labs/adv-cert/attempt/${a.id}`} className="text-[11px] text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-2 min-h-[44px] px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <span className={a.overall_result === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{a.overall_result.toUpperCase()}</span>
                              <span>{a.scenario?.case_code ? `[${a.scenario.case_code}] ` : ''}{a.scenario?.name || 'scenario'}</span>
                              <span className="inline-flex items-center gap-0.5"><UserCheck className="w-3 h-3" /> TL: {sname(a.team_lead)}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {/* team-lead coverage for the group's members */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {g.members.map(m => {
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
          </div>
        )}
        </div>
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
          onSaved={() => { setEditingStation(null); load(); }}
        />
      )}
    </div>
  );
}
