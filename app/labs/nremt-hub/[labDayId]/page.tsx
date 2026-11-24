'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ArrowLeft, UserCog } from 'lucide-react';
import { PageLoader } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { formatHubDate, formatHubTime } from '@/lib/nremt-hub-format';

// NREMT hub, slice 1 of 3: the day hub. Stations grouped by skill sheet, one big
// "Open grading" button per station. A front door only: the grading page, evaluate
// API, Coordinator View, Skill Results and the lab day page are unchanged.
// Repeatable: works for any lab day with is_nremt_testing = true, any cohort.

interface Tile {
  id: string;
  station_number: number;
  suffix: string | null;
  room: string | null;
  proctors: string[];
  is_mine: boolean;
}
interface Group {
  key: string;
  skill_name: string;
  stations: Tile[];
}
interface HubData {
  day: {
    id: string;
    date: string;
    start_time: string | null;
    end_time: string | null;
    cohort_label: string | null;
    student_count: number;
    station_count: number;
  };
  my_stations: Tile[];
  groups: Group[];
}
interface InstructorOption {
  id: string;
  name: string;
  email: string;
}

function StationTile({
  tile,
  large,
  canManage,
  instructors,
  onChangeProctor,
  saving,
}: {
  tile: Tile;
  large?: boolean;
  canManage: boolean;
  instructors: InstructorOption[];
  onChangeProctor: (stationId: string, instructor: InstructorOption | null) => void;
  saving: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-col gap-3 ${
        large ? 'border-2 border-red-500' : 'border border-gray-200 dark:border-gray-700'
      }`}
    >
      <div>
        <div className={`font-bold text-gray-900 dark:text-white ${large ? 'text-xl' : 'text-lg'}`}>
          Station {tile.station_number}
          {tile.suffix ? ` ${tile.suffix}` : ''}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{tile.room ? `Room: ${tile.room}` : 'Room: not set'}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Proctor: {tile.proctors.length > 0 ? tile.proctors.join(', ') : 'not set'}
        </div>
      </div>
      <Link
        href={`/labs/grade/station/${tile.id}`}
        className={`flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[52px] ${
          large ? 'text-lg' : ''
        }`}
      >
        Open grading
      </Link>
      {canManage && (
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <UserCog className="w-4 h-4 flex-shrink-0" />
          <select
            aria-label={`Change proctor for station ${tile.station_number}`}
            disabled={saving}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v === '__clear__') return onChangeProctor(tile.id, null);
              const inst = instructors.find((i) => i.email === v);
              if (inst) onChangeProctor(tile.id, inst);
            }}
            className="flex-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2"
          >
            <option value="">{saving ? 'Saving...' : 'Change proctor'}</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.email}>
                {i.name}
              </option>
            ))}
            <option value="__clear__">Clear proctor</option>
          </select>
        </label>
      )}
    </div>
  );
}

export default function NremtHubDayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const labDayId = params?.labDayId as string;
  const [role, setRole] = useState<string | null>(null);
  const effectiveRole = useEffectiveRole(role);
  const [data, setData] = useState<HubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.user) setRole(d.user.role);
      })
      .catch(() => {});
  }, [session]);

  const load = useCallback(() => {
    fetch(`/api/lab-management/nremt-hub?labDayId=${labDayId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setError(d.error || 'Could not load this NREMT day');
        else setData(d);
      })
      .catch(() => setError('Could not load this NREMT day'));
  }, [labDayId]);

  useEffect(() => {
    if (session && labDayId) load();
  }, [session, labDayId, load]);

  const canManage = effectiveRole ? hasMinRole(effectiveRole, 'instructor') : false;

  useEffect(() => {
    if (!canManage) return;
    fetch('/api/lab-management/instructors')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setInstructors(d.instructors);
      })
      .catch(() => {});
  }, [canManage]);

  // Same write path the lab day page's station editor uses: PATCH the station.
  const changeProctor = async (stationId: string, inst: InstructorOption | null) => {
    setSavingId(stationId);
    try {
      const res = await fetch(`/api/lab-management/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructor_name: inst ? inst.name : null, instructor_email: inst ? inst.email : '' }),
      });
      const d = await res.json();
      if (!d.success) alert('Could not change the proctor: ' + (d.error || 'unknown error'));
    } catch {
      alert('Could not change the proctor');
    }
    setSavingId(null);
    load();
  };

  if (status === 'loading' || (!data && !error)) return <PageLoader />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NREMT Testing Day</h1>
              {data && (
                <p className="text-gray-600 dark:text-gray-400">
                  {formatHubDate(data.day.date)}
                  {data.day.start_time ? `, ${formatHubTime(data.day.start_time)}` : ''}
                  {data.day.cohort_label ? ` · ${data.day.cohort_label}` : ''} &middot; {data.day.student_count} students
                </p>
              )}
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        <Link href="/labs/nremt-hub" className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> All NREMT days
        </Link>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {data && (
          <>
            {canManage && (
              <div className="flex flex-wrap gap-3">
                <Link href={`/labs/schedule/${labDayId}/coordinator`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Coordinator View
                </Link>
                <Link href={`/labs/schedule/${labDayId}/results`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Skill Results
                </Link>
                <Link href={`/labs/schedule/${labDayId}`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Set-up (lab day page)
                </Link>
              </div>
            )}

            {data.my_stations.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your station</h2>
                <div className="grid grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
                  {data.my_stations.map((t) => (
                    <StationTile key={t.id} tile={t} large canManage={canManage} instructors={instructors} onChangeProctor={changeProctor} saving={savingId === t.id} />
                  ))}
                </div>
              </section>
            )}

            {data.groups.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">This day has no stations yet. Add them on the lab day page.</p>
            )}

            {data.groups.map((g) => (
              <section key={g.key} className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {g.skill_name} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({g.stations.length})</span>
                </h2>
                <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
                  {g.stations.map((t) => (
                    <StationTile key={t.id} tile={t} canManage={canManage} instructors={instructors} onChangeProctor={changeProctor} saving={savingId === t.id} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
