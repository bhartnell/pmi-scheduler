'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Eye, Loader2, Save, Crown, Play, Pause, RotateCcw, Flag, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { safeReturnTo } from '@/lib/return-to';
import { mintClientUuid } from '@/lib/pals-offline';

interface StudentOpt { id: string; first_name: string; last_name: string }
interface GroupOpt { id: string; name: string; members: StudentOpt[] }
interface StationOpt {
  id: string; station_number: number; scenario_id: string | null;
  custom_title: string | null; skill_name: string | null; skill_sheet_url: string | null;
  instructions_url: string | null; rotation_minutes: number | null; room: string | null;
}
interface ScenarioInfo { id: string; title: string; case_code: string | null; checklist: { id: string } | null }

function fmt(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Skill station: no marks. A stopwatch with segment laps and the reference sheet link.
function SkillStationPanel({ station }: { station: StationOpt }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const startRef = useRef<number>(0);
  const baseRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(baseRef.current + Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => {
      clearInterval(id);
      baseRef.current = baseRef.current + Math.floor((Date.now() - startRef.current) / 1000);
    };
  }, [running]);

  function reset() {
    setRunning(false);
    baseRef.current = 0;
    setElapsed(0);
    setLaps([]);
  }

  const targetSeconds = station.rotation_minutes ? station.rotation_minutes * 60 : null;
  const segments = laps.map((end, i) => ({ n: i + 1, seconds: end - (i === 0 ? 0 : laps[i - 1]) }));
  const sheet = station.skill_sheet_url || station.instructions_url;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 grid grid-cols-2 max-md:grid-cols-1 gap-6">
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Skill station: no marks and no pass/fail. Use the timer and the reference sheet.
        </p>
        <div className="text-6xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">{fmt(elapsed)}</div>
        {targetSeconds && (
          <p className={`mt-1 text-sm ${elapsed > targetSeconds ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
            Station time {fmt(targetSeconds)}{elapsed > targetSeconds ? ` (over by ${fmt(elapsed - targetSeconds)})` : ''}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
          </button>
          <button type="button" onClick={() => setLaps((l) => [...l, elapsed])} disabled={elapsed === 0 || (laps.length > 0 && laps[laps.length - 1] === elapsed)}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50">
            <Flag className="w-4 h-4" /> End segment
          </button>
          <button type="button" onClick={reset}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Segments</h3>
        {segments.length === 0 ? (
          <p className="text-sm text-gray-400">Tap End segment each time the group moves on. Times show here.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
            {segments.map((s) => (
              <li key={s.n} className="flex justify-between border-b border-gray-100 dark:border-gray-700 py-1">
                <span>Segment {s.n}</span><span className="font-mono">{fmt(s.seconds)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          {sheet ? (
            <a href={sheet} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-md border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-medium">
              <ExternalLink className="w-4 h-4" /> Reference sheet
            </a>
          ) : (
            <p className="text-sm text-gray-400">No reference sheet is linked to this station yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PalsPracticeStationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [labDayId, setLabDayId] = useState('');
  const [stationId, setStationId] = useState('');
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [stations, setStations] = useState<StationOpt[]>([]);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<ScenarioInfo | null>(null);

  const [groupId, setGroupId] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [result, setResult] = useState<'PASS' | 'NR' | ''>('');
  const [watch, setWatch] = useState(false);
  const [watchNote, setWatchNote] = useState('');
  const [clientUuid, setClientUuid] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    setLabDayId(p.get('labDayId') || '');
    setStationId(p.get('stationId') || '');
    setReturnTo(safeReturnTo(p.get('returnTo')));
    setClientUuid(mintClientUuid());
  }, []);

  useEffect(() => {
    if (!session || !labDayId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/pals/grading-context?labDayId=${labDayId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setStations(d.stations || []); setGroups(d.groups || []); }
        else toast.error(d.error || 'Failed to load the lab day');
      })
      .catch(() => toast.error('Failed to load the lab day'))
      .finally(() => setLoading(false));
  }, [session, labDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  const station = useMemo(() => stations.find((s) => s.id === stationId) || null, [stations, stationId]);

  useEffect(() => {
    if (!session || !station?.scenario_id) { setScenario(null); return; }
    fetch(`/api/pals/scenarios/${station.scenario_id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setScenario(d.scenario); else toast.error(d.error || 'Failed to load the case'); })
      .catch(() => toast.error('Failed to load the case'));
  }, [session, station?.scenario_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedGroup = groups.find((g) => g.id === groupId);

  function resetForNextStudent() {
    setTeamLeadId(''); setResult(''); setWatch(false); setWatchNote('');
    setClientUuid(mintClientUuid());
  }

  async function handleSave() {
    if (!station?.scenario_id) return;
    if (!teamLeadId) return toast.error('Tap the team lead');
    if (!result) return toast.error('Mark pass or not yet');
    setSaving(true);
    try {
      const res = await fetch('/api/pals/practice-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: teamLeadId,
          lab_day_id: labDayId,
          scenario_id: station.scenario_id,
          lab_station_id: station.id,
          lab_group_id: groupId || null,
          result: result === 'PASS' ? 'pass' : 'fail',
          watch: result === 'PASS' ? watch : null,
          watch_note: result === 'PASS' && watch ? watchNote : null,
          client_uuid: clientUuid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Saved - ${result === 'PASS' ? 'pass' : 'not yet'}${result === 'PASS' && watch ? ' (watch)' : ''}`);
        setSavedCount((n) => n + 1);
        resetForNextStudent();
      } else {
        // Keep everything on screen and keep the same client_uuid, so a retry cannot double-save.
        toast.error(data.error || 'Failed to save - try again');
      }
    } catch {
      toast.error('Could not reach the server - your entry is still here, try again');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }

  const backHref = returnTo || (labDayId ? `/labs/schedule/${labDayId}` : '/labs/pals-hub');
  const title = station?.custom_title || station?.skill_name || (station ? `Station ${station.station_number}` : 'Station');

  return (
    <div className="w-full max-w-[3000px] mx-auto px-4 md:px-6 2xl:px-8 py-4">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to lab day
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">PALS practice station</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {station ? `Station ${station.station_number}${station.room ? ` - ${station.room}` : ''}` : ''}
        {station?.scenario_id ? '' : station ? ' - skill station' : ''}
      </p>

      {!station && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
          Open this from a station&apos;s Grade button on the lab day so it knows which station you are at.
        </div>
      )}

      {station && !station.scenario_id && <SkillStationPanel station={station} />}

      {station?.scenario_id && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-md:grid-cols-1 gap-4">
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border-l-4 border-indigo-500">
              <div className="text-base font-bold text-gray-900 dark:text-white">
                {scenario ? `${scenario.case_code ? `[${scenario.case_code}] ` : ''}${scenario.title}` : title}
              </div>
              {scenario && !scenario.checklist && (
                <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  This case has no checklist linked yet, so it cannot be saved. Tell the coordinator.
                </p>
              )}
              {savedCount > 0 && <p className="mt-2 text-xs text-gray-400">{savedCount} saved at this station this visit</p>}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group</label>
              <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setTeamLeadId(''); }}
                className="w-full sm:w-72 min-h-[44px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm">
                <option value="">Select a group...</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>

              {selectedGroup && (
                <div className="mt-4">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Team lead <Crown size={11} className="inline -mt-0.5" />
                  </span>
                  {selectedGroup.members.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No members recorded for this group.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedGroup.members.map((m) => {
                        const on = m.id === teamLeadId;
                        return (
                          <button key={m.id} type="button" onClick={() => setTeamLeadId(on ? '' : m.id)}
                            className={`min-h-[44px] px-4 rounded-full text-sm border transition-colors ${
                              on ? 'bg-blue-600 text-white border-blue-600'
                                 : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                            }`}>
                            {on && <Crown size={13} className="inline -mt-0.5 mr-1" fill="currentColor" />}
                            {m.last_name}, {m.first_name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-4 self-start">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setResult(result === 'PASS' ? '' : 'PASS')}
                className={`min-h-[56px] rounded-lg text-base font-bold inline-flex items-center justify-center gap-2 border ${
                  result === 'PASS' ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                }`}>
                <CheckCircle2 className="w-5 h-5" /> Pass
              </button>
              <button type="button" onClick={() => { setResult(result === 'NR' ? '' : 'NR'); setWatch(false); setWatchNote(''); }}
                className={`min-h-[56px] rounded-lg text-base font-bold inline-flex items-center justify-center gap-2 border ${
                  result === 'NR' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                }`}>
                <XCircle className="w-5 h-5" /> Not yet
              </button>
            </div>

            {result === 'PASS' && (
              <div>
                <button type="button" onClick={() => setWatch((w) => !w)}
                  className={`min-h-[44px] px-4 rounded-md text-sm font-medium inline-flex items-center gap-2 border ${
                    watch ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                  }`}>
                  <Eye className="w-4 h-4" /> Pass but watch
                </button>
                {watch && (
                  <textarea rows={2} value={watchNote} onChange={(e) => setWatchNote(e.target.value)}
                    placeholder="Optional note: what to watch for next time"
                    className="mt-3 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm" />
                )}
              </div>
            )}

            <button type="button" onClick={handleSave}
              disabled={saving || !teamLeadId || !result || (scenario != null && !scenario.checklist)}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
