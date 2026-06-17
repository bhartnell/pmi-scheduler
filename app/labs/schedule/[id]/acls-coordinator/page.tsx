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
import { ArrowLeft, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Users, UserCheck, MapPin } from 'lucide-react';

interface Student { id: string; first_name: string; last_name: string; status?: string | null }
interface Group { id: string; name: string; members: Student[] }
interface Station { id: string; station_number: number; instructor_name: string | null; room: string | null; custom_title: string | null; station_notes: string | null }
interface Day { id: string; date: string; cert_course: string | null; is_adv_cert_testing: boolean; cohort?: { cohort_number: number } | null }
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
      if (ctx.success) { setDay(ctx.day); setGroups(ctx.groups || []); setStations(ctx.stations || []); }
      if (att.success) setAttempts(att.attempts || []);
    } catch { /* non-blocking */ } finally { setLoading(false); }
  }, [labDayId]);

  useEffect(() => { if (status === 'authenticated') load(); }, [load, status]);

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
      <div className="max-w-5xl mx-auto px-4 py-5">
        <Link href={`/labs/schedule/${labDayId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3">
          <ArrowLeft className="w-4 h-4" /> Lab Day
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ACLS Coordinator Tracker</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {day?.date}{day?.cohort?.cohort_number ? ` · Cohort ${day.cohort.cohort_number}` : ''}
              {day?.is_adv_cert_testing ? ' · scored testing day' : ''} — stats & plan-state (not dispatch)
            </p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

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
              <Stat label="Tested" value={stats.groupsTested} />
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
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Groups: status + what's next */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Groups — status & what&apos;s next</h2>
              <div className="space-y-2">
                {groups.map(g => {
                  const gAttempts = attemptsByGroup.get(g.id) || [];
                  const tested = gAttempts.length > 0;
                  return (
                    <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{g.name} <span className="text-xs text-gray-400">({g.members.length})</span></div>
                        {tested
                          ? <span className="text-xs inline-flex items-center gap-1">{gAttempts.map(a => a.overall_result === 'pass'
                              ? <CheckCircle2 key={a.id} className="w-4 h-4 text-green-500" />
                              : <XCircle key={a.id} className="w-4 h-4 text-red-500" />)}</span>
                          : <span className="text-xs inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock className="w-3.5 h-3.5" /> pending</span>}
                      </div>
                      {gAttempts.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {gAttempts.map(a => (
                            <div key={a.id} className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <span className={a.overall_result === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{a.overall_result.toUpperCase()}</span>
                              <span>{a.scenario?.case_code ? `[${a.scenario.case_code}] ` : ''}{a.scenario?.name || 'scenario'}</span>
                              <span className="inline-flex items-center gap-0.5"><UserCheck className="w-3 h-3" /> TL: {sname(a.team_lead)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* team-lead coverage for the group's members */}
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
              <p className="mt-2 text-[11px] text-gray-400">Green = student has team-led a scored attempt today. Grade in the Megacode Grader; this view reflects saved results.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
