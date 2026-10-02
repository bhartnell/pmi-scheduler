'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { safeReturnTo } from '@/lib/return-to';
import { ArrowLeft, Eye, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface StudentOpt { id: string; first_name: string; last_name: string }
interface GroupOpt { id: string; name: string; members: StudentOpt[] }
interface StationOpt { id: string; station_number: number; scenario_id: string | null; room: string | null }
interface Mark { id: string; station_id: string; student_id: string; mark: 'pass' | 'watch'; note: string | null; marked_by: string | null }

/**
 * ACLS learning-station tracker. Unofficial, unscored: Pass or Watch, one mark
 * per student per station, optional note. Watch carries for the day only.
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
  const [caseTitle, setCaseTitle] = useState('');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
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
      if (ctx.success) { setGroups(ctx.groups || []); setStations(ctx.stations || []); }
      if (mk.success) {
        setMarks(mk.marks || []);
        setNotes((prev) => {
          const next = { ...prev };
          for (const m of mk.marks || []) if (!(m.station_id + m.student_id in next)) next[m.station_id + m.student_id] = m.note || '';
          return next;
        });
      }
    } catch {
      toast.error('Failed to load tracker');
    } finally {
      setLoading(false);
    }
  }, [labDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (session) load(); }, [session, load]);

  const station = stations.find((s) => s.id === stationId);

  useEffect(() => {
    if (!station?.scenario_id) { setCaseTitle(''); return; }
    fetch(`/api/lab-management/scenarios/${station.scenario_id}`)
      .then((r) => r.json())
      .then((d) => { const s = d?.scenario ?? d; setCaseTitle(s ? `${s.case_code ? s.case_code + ' - ' : ''}${s.title || ''}` : ''); })
      .catch(() => setCaseTitle(''));
  }, [station?.scenario_id]);

  const markFor = (studentId: string) => marks.find((m) => m.station_id === stationId && m.student_id === studentId);

  async function save(studentId: string, mark: 'pass' | 'watch') {
    setSavingId(studentId);
    try {
      const res = await fetch('/api/adv-cert/learning-marks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId, stationId, studentId, mark, note: notes[stationId + studentId] || '' }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setMarks((prev) => [...prev.filter((m) => !(m.station_id === stationId && m.student_id === studentId)), d.mark]);
    } catch {
      toast.error('Could not save mark');
    } finally {
      setSavingId('');
    }
  }

  // Watch marks from OTHER stations today: who to keep an eye on.
  const watchElsewhere = useMemo(() => {
    const names: Record<string, string> = {};
    groups.forEach((g) => g.members.forEach((m) => { names[m.id] = `${m.first_name} ${m.last_name}`; }));
    return marks.filter((m) => m.mark === 'watch' && m.station_id !== stationId);
  }, [marks, groups, stationId]);
  const nameOf = (id: string) => {
    for (const g of groups) { const m = g.members.find((x) => x.id === id); if (m) return `${m.first_name} ${m.last_name}`; }
    return 'Student';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 max-sm:p-3">
      <Link href={returnTo || (labDayId ? `/labs/schedule/${labDayId}` : '/labs/acls-hub')} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:underline mb-3">
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
              <span className="font-medium">Watch today:</span> {Array.from(new Set(watchElsewhere.map((m) => nameOf(m.student_id)))).join(', ')}
            </div>
          )}
          <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
            {groups.map((g) => (
              <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{g.name}</h2>
                <ul className="space-y-3">
                  {g.members.map((s) => {
                    const m = markFor(s.id);
                    const busy = savingId === s.id;
                    return (
                      <li key={s.id} className="border-b border-gray-100 dark:border-gray-700 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-900 dark:text-gray-100">{s.first_name} {s.last_name}</span>
                          <div className="flex gap-2">
                            <button disabled={busy} onClick={() => save(s.id, 'pass')}
                              className={`min-h-[44px] px-4 rounded-lg text-sm inline-flex items-center gap-1 border ${m?.mark === 'pass' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                              <CheckCircle2 className="w-4 h-4" /> Pass
                            </button>
                            <button disabled={busy} onClick={() => save(s.id, 'watch')}
                              className={`min-h-[44px] px-4 rounded-lg text-sm inline-flex items-center gap-1 border ${m?.mark === 'watch' ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                              <Eye className="w-4 h-4" /> Watch
                            </button>
                          </div>
                        </div>
                        <input
                          value={notes[stationId + s.id] ?? ''}
                          onChange={(e) => setNotes((p) => ({ ...p, [stationId + s.id]: e.target.value }))}
                          onBlur={() => { if (m) save(s.id, m.mark); }}
                          placeholder="Optional note"
                          maxLength={500}
                          className="mt-1 w-full text-sm px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-gray-900 dark:text-gray-100"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
