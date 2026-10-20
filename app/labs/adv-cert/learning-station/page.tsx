'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeReturnTo } from '@/lib/return-to';
import { ArrowLeft, Eye, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import TimerBanner from '@/components/TimerBanner';
import DualPaneGrading from '@/components/grading/DualPaneGrading';
import ScenarioFullDisplay from '@/components/scenario/ScenarioFullDisplay';

interface StudentOpt { id: string; first_name: string; last_name: string }
interface GroupOpt { id: string; name: string; members: StudentOpt[] }
interface StationOpt { id: string; station_number: number; scenario_id: string | null; room: string | null }
interface Mark {
  id: string;
  station_id: string;
  student_id: string | null;
  lab_group_id?: string | null;
  team_lead_id?: string | null;
  mark: 'pass' | 'watch';
  note: string | null;
  marked_by: string | null;
}

const CHIPS = ['Pharm/dosing', 'Joules/energy', 'Pacing', 'Assessment', 'Timing', 'Team communication'];

/**
 * ACLS learning-station tracker. Unofficial, unscored. One submit = one group at
 * one station: select group, select who led (optional), Pass/Watch, submit.
 */
export default function AclsLearningStationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [labDayId, setLabDayId] = useState('');
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [stationId, setStationId] = useState('');
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [numRotations, setNumRotations] = useState<number | null>(null);
  const [caseTitle, setCaseTitle] = useState('');
  const [fullScenario, setFullScenario] = useState<any>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [groupId, setGroupId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [pending, setPending] = useState<'pass' | 'watch' | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setLabDayId(p.get('labDayId') || '');
    setReturnTo(safeReturnTo(p.get('returnTo')));
    setStationId(p.get('stationId') || '');
  }, []);

  const load = useCallback(async () => {
    if (!labDayId) { setLoading(false); return; }
    try {
      const [ctx, mk] = await Promise.all([
        fetch(`/api/adv-cert/grading-context?labDayId=${labDayId}`).then((r) => r.json()),
        fetch(`/api/adv-cert/learning-marks?labDayId=${labDayId}`).then((r) => r.json()),
      ]);
      if (ctx.success) { setGroups(ctx.groups || []); setStations(ctx.stations || []); setNumRotations(ctx.day?.num_rotations ?? null); }
      if (mk.success) setMarks(mk.marks || []);
    } catch {
      toast.error('Failed to load tracker');
    } finally {
      setLoading(false);
    }
  }, [labDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (session) load(); }, [session, load]);

  const station = stations.find((s) => s.id === stationId);
  const group = groups.find((g) => g.id === groupId);

  useEffect(() => {
    if (!station?.scenario_id) { setCaseTitle(''); setFullScenario(null); return; }
    fetch(`/api/lab-management/scenarios/${station.scenario_id}`)
      .then((r) => r.json())
      .then((d) => { const s = d?.scenario ?? d; setFullScenario(s || null); setCaseTitle(s ? `${s.case_code ? s.case_code + ' - ' : ''}${s.title || ''}` : ''); })
      .catch(() => { setCaseTitle(''); setFullScenario(null); });
  }, [station?.scenario_id]);

  async function submit() {
    if (!groupId || !pending) return;
    setSaving(true);
    try {
      const res = await fetch('/api/adv-cert/learning-marks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId, stationId, labGroupId: groupId, teamLeadId: leadId || undefined, mark: pending, note }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setMarks((prev) => [...prev.filter((m) => m.id !== d.mark.id), d.mark]);
      toast.success(`${group?.name || 'Group'}: ${pending === 'pass' ? 'Pass' : 'Watch'} saved`);
      setGroupId(''); setLeadId(''); setPending(null); setNote('');
    } catch {
      toast.error('Could not save mark');
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (id: string) => {
    for (const g of groups) { const m = g.members.find((x) => x.id === id); if (m) return `${m.first_name} ${m.last_name}`; }
    return 'Student';
  };
  const groupName = (id?: string | null) => groups.find((g) => g.id === id)?.name || 'Group';

  // Watch marks from OTHER stations today: who to keep an eye on. Group rows
  // name the group (and the lead when recorded); legacy rows name the student.
  const watchElsewhere = useMemo(
    () => marks.filter((m) => m.mark === 'watch' && m.station_id !== stationId),
    [marks, stationId]
  );
  const watchLabel = (m: Mark) =>
    m.student_id
      ? nameOf(m.student_id)
      : `${groupName(m.lab_group_id)}${m.team_lead_id ? ` (lead ${nameOf(m.team_lead_id)})` : ''}`;

  return (
    <div className="w-full max-w-none mx-auto p-6 max-sm:p-3">
      {labDayId && (
        <TimerBanner
          labDayId={labDayId}
          stationId={stationId || undefined}
          userEmail={session?.user?.email || undefined}
          userName={session?.user?.name || undefined}
          numRotations={numRotations || groups.length || stations.length || 4}
        />
      )}
      <Link href={returnTo || (labDayId ? `/labs/schedule/${labDayId}` : '/labs/acls-hub/board')} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:underline mb-3">
        <ArrowLeft className="w-4 h-4" /> {returnTo ? 'Back' : 'Back to lab day'}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ACLS Learning Station Tracker</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
        {station ? `Station #${station.station_number}${caseTitle ? ` - ${caseTitle}` : ''}` : 'Station'}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Not official, not scored. Pass = followed the algorithm. Watch = keep an eye on them. Watch shows on the hub for today only.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : !station ? (
        <p className="text-sm text-red-600">Station not found. Open this from a lab day station.</p>
      ) : (
        <>
          {watchElsewhere.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
              <span className="font-medium">Watch today:</span> {Array.from(new Set(watchElsewhere.map(watchLabel))).join(', ')}
            </div>
          )}
          <DualPaneGrading
            scenarioLabel="Case"
            scoringLabel="Pass / Watch"
            scenario={
              fullScenario ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                  <ScenarioFullDisplay scenario={fullScenario} hideEmpty />
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No case is assigned to this station.</p>
              )
            }
            scoring={
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Group</div>
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const done = marks.find((m) => m.station_id === stationId && m.lab_group_id === g.id);
                      return (
                        <button key={g.id} onClick={() => { setGroupId(g.id); setLeadId(''); }}
                          className={`min-h-[44px] px-4 rounded-lg text-sm border ${groupId === g.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                          {g.name}{done ? (done.mark === 'pass' ? ' (Pass)' : ' (Watch)') : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Who led (optional)</div>
                  <select value={leadId} onChange={(e) => setLeadId(e.target.value)} disabled={!group}
                    className="min-h-[44px] w-full max-w-sm px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-gray-100">
                    <option value="">Not recorded</option>
                    {(group?.members || []).map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3. Pass / Watch</div>
                  <div className="flex gap-2">
                    <button onClick={() => setPending('pass')} disabled={!group}
                      className={`min-h-[44px] px-4 rounded-lg text-sm inline-flex items-center gap-1 border ${pending === 'pass' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                      <CheckCircle2 className="w-4 h-4" /> Pass
                    </button>
                    <button onClick={() => setPending('watch')} disabled={!group}
                      className={`min-h-[44px] px-4 rounded-lg text-sm inline-flex items-center gap-1 border ${pending === 'watch' ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                      <Eye className="w-4 h-4" /> Watch
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {CHIPS.map((c) => (
                      <button key={c} type="button" onClick={() => setNote((n) => (n ? `${n}; ${c}` : c).slice(0, 500))}
                        className="min-h-[36px] px-3 rounded-full text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">{c}</button>
                    ))}
                  </div>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" maxLength={500}
                    className="w-full text-sm px-2 py-2 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100" />
                </div>
                <button onClick={submit} disabled={!group || !pending || saving}
                  className="min-h-[44px] px-6 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">
                  {saving ? 'Saving...' : '4. Submit, next group'}
                </button>
              </div>
            }
          />
        </>
      )}
    </div>
  );
}
