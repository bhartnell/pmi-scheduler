'use client';

/**
 * PALS Hub — additive, READ-ONLY aggregator for the full PALS event.
 * Mirrors /labs/acls-hub's shape (Task Handoff Queue: "AHA HUB: PALS
 * aggregated view mirroring ACLS Hub"):
 *   - Day 1 / Day 2 schedule (didactic + labs together), legible day view
 *   - Lab sections per day (Ben builds these via the UI; this page only
 *     displays them — no auto-created stations)
 *   - Team-lead coverage per student: >=1 PALS testing attempt as the
 *     tested lead counts as covered (Ben-confirmed threshold) — flags
 *     students with 0 vs >=1
 *   - By-instructor view + a clean print option
 *
 * Reads existing sources only: /api/adv-cert/pals-hub (sections + groups +
 * attempts) and /api/calendar/unified (schedule). Writes nothing. The
 * dedicated testing/grading page (/labs/pals/grade) stays the place to
 * actually grade — this page links to it, doesn't replace it.
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, RefreshCw, Printer, CheckCircle2, XCircle, Clock,
  Users, UserCheck, MapPin, CalendarDays, Layers, Stethoscope, ClipboardCheck,
} from 'lucide-react';

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
  id: string; lab_day_id: string; lab_group_id: string; result: string;
  attempted_at: string; team_lead?: { id: string; first_name: string; last_name: string } | null;
  scenario?: { id: string; name: string; case_code: string | null } | null;
}
interface CalEvent {
  id: string; title: string; date: string; start_time: string | null; end_time: string | null;
  event_type: string; instructor_names?: string[]; room?: string; linked_url?: string; status?: string;
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const prettyDate = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); } catch { return d; } };

const TYPE_COLOR: Record<string, string> = {
  lab: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  class: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  exam: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
};

export default function PalsHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohort, setCohort] = useState<any>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string>('all');

  useEffect(() => { if (status === 'unauthenticated') router.push('/auth/signin'); }, [status, router]);

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
          setEvents((u.events || []).filter((e: CalEvent) => hub.dates.includes(e.date)));
        } else {
          setEvents([]);
        }
      }
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (status === 'authenticated') load(); }, [load, status]);

  const visibleDates = activeDate === 'all' ? dates : dates.filter(d => d === activeDate);

  // PALS TEAM-LEAD COVERAGE: each attempt's own student IS the tested team
  // lead (no separate team_lead column, unlike ACLS's megacode model — see
  // docs/pals/PALS_Grading_Model_Spec.md). Coverage threshold is >=1
  // attempt as the tested lead, regardless of PASS/NR (Ben-confirmed:
  // this tracks who got the OPPORTUNITY to lead, not who passed).
  const stats = useMemo(() => {
    const passed = attempts.filter(a => a.result === 'PASS').length;
    const nr = attempts.filter(a => a.result === 'NR').length;
    const groupsTested = new Set(attempts.map(a => a.lab_group_id).filter(Boolean)).size;
    const leadAttemptCounts = new Map<string, number>();
    for (const a of attempts) {
      const id = a.team_lead?.id;
      if (!id) continue;
      leadAttemptCounts.set(id, (leadAttemptCounts.get(id) || 0) + 1);
    }
    const allStudents = groups.flatMap(g => g.members);
    const covered = allStudents.filter(s => (leadAttemptCounts.get(s.id) || 0) >= 1);
    const notCovered = allStudents.filter(s => (leadAttemptCounts.get(s.id) || 0) === 0);
    const sections = labDays.filter(d => (d.section_number ?? 1) > 1).length;
    return {
      passed, nr, groupsTested, totalGroups: groups.length,
      leadAttemptCounts, totalStudents: allStudents.length, coveredCount: covered.length, notCovered,
      sections, labDaysCount: labDays.length, totalAttempts: attempts.length,
    };
  }, [attempts, groups, labDays]);

  const attemptsByGroup = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of attempts) { if (!a.lab_group_id) continue; (m.get(a.lab_group_id) || m.set(a.lab_group_id, []).get(a.lab_group_id)!).push(a); }
    return m;
  }, [attempts]);

  // By-instructor: every station assignment across all sections, grouped by name.
  const byInstructor = useMemo(() => {
    const m = new Map<string, { date: string; section: string; station: number; room: string | null; title: string }[]>();
    for (const d of labDays) {
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
  }, [labDays]);

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
                const daySections = labDays.filter(d => d.date === date).sort((a, b) => (a.section_number ?? 1) - (b.section_number ?? 1));
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
                <UserCheck className="w-4 h-4" /> Testing stats — both days
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Stat label="PALS lab days" value={stats.labDaysCount} />
                <Stat label="Groups" value={stats.totalGroups} />
                <Stat label="Testing attempts" value={stats.totalAttempts} />
                <Stat label="Passed" value={stats.passed} tone="text-green-600 dark:text-green-400" />
                <Stat label="NR" value={stats.nr} tone="text-red-600 dark:text-red-400" />
                <Stat label="Team-lead coverage" value={`${stats.coveredCount}/${stats.totalStudents}`} tone={stats.coveredCount === stats.totalStudents && stats.totalStudents > 0 ? 'text-green-600 dark:text-green-400' : undefined} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Team-lead coverage = students tested as team lead at least once (PASS or NR both count as coverage — this tracks who got the opportunity to lead, not who passed).</p>
            </section>

            {/* COVERAGE MARKER — who hasn't led yet */}
            {stats.notCovered.length > 0 && (
              <section style={{ breakInside: 'avoid' }} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg p-3">
                <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Not yet tested as team lead — {stats.notCovered.length} of {stats.totalStudents}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {stats.notCovered.map(s => (
                    <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {s.last_name}, {s.first_name}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Goal: every student is tested as team lead at least once (threshold ≥1, regardless of PASS/NR).</p>
              </section>
            )}

            {/* Per day: schedule + sections */}
            {visibleDates.map((date) => {
              const dayEvents = events.filter(e => e.date === date).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
              const daySections = labDays.filter(d => d.date === date).sort((a, b) => (a.section_number ?? 1) - (b.section_number ?? 1));
              return (
                <section key={date} style={{ breakInside: 'avoid' }}>
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-emerald-600" /> Day {dates.indexOf(date) + 1} — {prettyDate(date)}
                  </h2>

                  {/* Schedule (didactic + labs together) */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 mb-3">
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
                          {/* Stations */}
                          {d.stations.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                              {d.stations.map(st => (
                                <div key={st.id} className="text-xs border border-gray-100 dark:border-gray-700 rounded p-1.5">
                                  <div className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-gray-400" />#{st.station_number} {st.room || ''}
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400">{st.scenario?.case_code || st.scenario?.title || st.custom_title || '—'}</div>
                                  <div className="text-gray-400">{st.instructor_name || '— unassigned —'}</div>
                                </div>
                              ))}
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
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Groups — team-lead coverage</h2>
              <div className="space-y-2">
                {groups.map(g => {
                  const gAttempts = attemptsByGroup.get(g.id) || [];
                  return (
                    <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{g.name} <span className="text-xs text-gray-400">({g.members.length})</span></div>
                        <div className="text-xs inline-flex items-center gap-1">
                          {gAttempts.map(a => a.result === 'PASS'
                            ? <CheckCircle2 key={a.id} className="w-4 h-4 text-green-500" />
                            : <XCircle key={a.id} className="w-4 h-4 text-red-500" />)}
                          {gAttempts.length === 0 && <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> none yet</span>}
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {g.members.map(m => {
                          const covered = (stats.leadAttemptCounts.get(m.id) || 0) >= 1;
                          return (
                            <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded-full ${covered ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                              {covered ? '✓ ' : ''}{m.last_name}
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
