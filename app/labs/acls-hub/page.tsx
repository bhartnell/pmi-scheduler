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

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, RefreshCw, Printer, CheckCircle2, XCircle, Clock,
  Users, UserCheck, MapPin, CalendarDays, Layers, GraduationCap,
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
  id: string; lab_day_id: string; lab_group_id: string; overall_result: string;
  started_at: string; team_lead?: { id: string; first_name: string; last_name: string } | null;
  scenario?: { id: string; name: string; case_code: string | null } | null;
}
interface CalEvent {
  id: string; title: string; date: string; start_time: string | null; end_time: string | null;
  event_type: string; instructor_names?: string[]; room?: string; linked_url?: string; status?: string;
}

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');
const sname = (s?: { first_name: string; last_name: string } | null) => (s ? `${s.first_name} ${s.last_name}` : '—');
const prettyDate = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); } catch { return d; } };

const TYPE_COLOR: Record<string, string> = {
  lab: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  class: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  exam: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
};

export default function AclsHubPage() {
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
      const hubRes = await fetch('/api/adv-cert/acls-hub');
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

  // Two-day / all-section aggregate stats.
  const stats = useMemo(() => {
    const passed = attempts.filter(a => a.overall_result === 'pass').length;
    const failed = attempts.filter(a => a.overall_result === 'fail').length;
    const groupsTested = new Set(attempts.map(a => a.lab_group_id)).size;
    const ledStudentIds = new Set(attempts.map(a => a.team_lead?.id).filter(Boolean) as string[]);
    const allStudents = groups.flatMap(g => g.members);
    const ledCount = allStudents.filter(s => ledStudentIds.has(s.id)).length;
    const sections = labDays.filter(d => (d.section_number ?? 1) > 1).length;
    return {
      passed, failed, groupsTested, totalGroups: groups.length,
      ledStudentIds, totalStudents: allStudents.length, ledCount,
      sections, labDaysCount: labDays.length, totalAttempts: attempts.length,
    };
  }, [attempts, groups, labDays]);

  const attemptsByGroup = useMemo(() => {
    const m = new Map<string, Attempt[]>();
    for (const a of attempts) { (m.get(a.lab_group_id) || m.set(a.lab_group_id, []).get(a.lab_group_id)!).push(a); }
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
          <Link href="/calendar" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3">
            <ArrowLeft className="w-4 h-4" /> Calendar
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-red-600" /> ACLS Hub
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {cohortLabel}{dates.length ? ` · ${dates.map(prettyDate).join(' + ')}` : ''} — full event, one place (read-only)
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

        {/* Print header */}
        <div className="hidden print:block mb-3 border-b border-black pb-2 text-black">
          <h1 className="text-xl font-bold">ACLS Event — {cohortLabel}</h1>
          <p className="text-sm">{dates.map(prettyDate).join('  +  ')}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !cohort ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            No ACLS event found. (Looks for lab days tagged <code>cert_course=acls</code>.)
          </div>
        ) : (
          <div className="space-y-6">
            {/* Aggregated coordinator stats — BOTH days, ALL sections */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <UserCheck className="w-4 h-4" /> Coordinator stats — across both days &amp; all sections
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Stat label="Lab days / sections" value={`${dates.length} / ${labDays.length}`} />
                <Stat label="Groups" value={stats.totalGroups} />
                <Stat label="Groups tested" value={stats.groupsTested} />
                <Stat label="Passed" value={stats.passed} tone="text-green-600 dark:text-green-400" />
                <Stat label="Failed" value={stats.failed} tone="text-red-600 dark:text-red-400" />
                <Stat label="Team-led" value={`${stats.ledCount}/${stats.totalStudents}`} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">Aggregated over every ACLS section both days — not a single lab day. Team-led = students who led ≥1 scored attempt across the event.</p>
            </section>

            {/* Per day: schedule + sections */}
            {visibleDates.map((date, idx) => {
              const dayEvents = events.filter(e => e.date === date).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
              const daySections = labDays.filter(d => d.date === date).sort((a, b) => (a.section_number ?? 1) - (b.section_number ?? 1));
              return (
                <section key={date} style={{ breakInside: 'avoid' }}>
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-red-600" /> Day {dates.indexOf(date) + 1} — {prettyDate(date)}
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

                  {/* Lab sections for the day */}
                  <div className="space-y-2">
                    {daySections.map(d => {
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
                              {dAttempts.filter(a => a.overall_result === 'pass').length} pass · {dAttempts.filter(a => a.overall_result === 'fail').length} fail recorded here
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Per-group team-lead coverage (across the whole event) */}
            <section style={{ breakInside: 'avoid' }}>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Groups — team-lead coverage (whole event)</h2>
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
                          const led = stats.ledStudentIds.has(m.id);
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
          </div>
        )}
      </div>
    </div>
  );
}
