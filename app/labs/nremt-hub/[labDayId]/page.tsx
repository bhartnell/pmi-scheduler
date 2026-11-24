'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ArrowLeft, Pencil, Plus, Lock, Unlock, X } from 'lucide-react';
import { PageLoader } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { formatHubDate, formatHubTime } from '@/lib/nremt-hub-format';
import { nextStationName, nextStationNumber, isClosed } from '@/lib/nremt-hub-stations';
import IndividualTestingGrid from '@/components/lab-day/IndividualTestingGrid';

// NREMT hub: the day hub. Stations grouped by skill sheet, one big "Open grading"
// button per station, plus (instructor+) station controls: edit a station, open another
// station for a skill, close / reopen, NREMT-only locations, and the existing Individual
// Testing Tracker. Every write uses an existing route (stations POST/PATCH, .../scenario).
// The grading page, evaluate API, Coordinator View, Skill Results and the lab day page
// are unchanged.
// Repeatable: works for any lab day with is_nremt_testing = true, any cohort.

interface Tile {
  id: string;
  station_number: number;
  suffix: string | null;
  room: string | null;
  proctors: string[];
  is_mine: boolean;
  skill_sheet_id: string | null;
  skill_label: string | null;
  own_name: string | null;
  nremt_code: string | null;
  scenario_id: string | null;
  scenario_title: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  coordinator_status: 'open' | 'closed' | 'break';
  eval_count: number | null;
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
  locations: { standard: string[]; nremtOnly: string[] };
  scenarios_by_code: Record<string, { id: string; title: string }[]>;
  skill_options: { id: string; skill_name: string; nremt_code: string | null }[];
}
interface InstructorOption {
  id: string;
  name: string;
  email: string;
}

const SCENARIO_CODES = ['E201', 'E202'];
const NEW_LOCATION = '__new__';

function StationTile({
  tile,
  large,
  canManage,
  saving,
  onEdit,
  onSetStatus,
}: {
  tile: Tile;
  large?: boolean;
  canManage: boolean;
  saving: boolean;
  onEdit: (t: Tile) => void;
  onSetStatus: (t: Tile, status: 'open' | 'closed') => void;
}) {
  const closed = isClosed(tile.coordinator_status);
  const title = tile.own_name || tile.skill_label || `Station ${tile.station_number}`;
  return (
    <div
      className={`rounded-lg shadow p-4 flex flex-col gap-3 ${
        closed ? 'bg-gray-100 dark:bg-gray-900 opacity-70' : 'bg-white dark:bg-gray-800'
      } ${large ? 'border-2 border-red-500' : 'border border-gray-200 dark:border-gray-700'}`}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className={`font-bold text-gray-900 dark:text-white ${large ? 'text-xl' : 'text-lg'}`}>{title}</div>
          {closed && (
            <span className="shrink-0 rounded-full bg-gray-300 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-800 dark:text-gray-200">Closed</span>
          )}
          {tile.coordinator_status === 'break' && (
            <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">On break</span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Station {tile.station_number}
          {tile.suffix ? ` ${tile.suffix}` : ''}
        </div>
        {tile.skill_label && (
          <span className="inline-block rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200">
            {tile.skill_label}
          </span>
        )}
        {tile.nremt_code && SCENARIO_CODES.includes(tile.nremt_code) && (
          <div className="text-sm text-gray-700 dark:text-gray-300">Scenario: {tile.scenario_title || 'not picked'}</div>
        )}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Proctor: {tile.proctors.length > 0 ? tile.proctors.join(', ') : 'not set'}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{tile.room ? `Location: ${tile.room}` : 'Location: not set'}</div>
      </div>
      {closed && canManage ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSetStatus(tile, 'open')}
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold min-h-[52px] disabled:opacity-60"
        >
          <Unlock className="w-4 h-4" /> {saving ? 'Saving...' : 'Reopen'}
        </button>
      ) : (
        <Link
          href={`/labs/grade/station/${tile.id}`}
          className={`flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[52px] ${large ? 'text-lg' : ''}`}
        >
          Open grading
        </Link>
      )}
      {canManage && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(tile)}
            className="flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Pencil className="w-4 h-4" /> Edit station
          </button>
          {!closed && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onSetStatus(tile, 'closed')}
              className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              <Lock className="w-4 h-4" /> Close
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface PanelState {
  mode: 'edit' | 'create';
  tile?: Tile; // edit
  skillSheetId: string | null; // create: the group's skill
  skillLabel: string;
}

function StationPanel({
  state,
  data,
  labDayId,
  instructors,
  allNames,
  allNumbers,
  onClose,
  onSaved,
}: {
  state: PanelState;
  data: HubData;
  labDayId: string;
  instructors: InstructorOption[];
  allNames: Array<string | null>;
  allNumbers: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = state.tile;
  const isEdit = state.mode === 'edit';
  const [ownName, setOwnName] = useState(isEdit ? t?.own_name || '' : nextStationName(state.skillLabel, allNames));
  const [skillId, setSkillId] = useState<string>((isEdit ? t?.skill_sheet_id : state.skillSheetId) || '');
  const [scenarioId, setScenarioId] = useState<string>(isEdit ? t?.scenario_id || '' : '');
  const [proctorEmail, setProctorEmail] = useState<string>(isEdit ? t?.instructor_email || '' : '');
  const knownRoom = isEdit ? t?.room || '' : '';
  const allRooms = [...data.locations.standard, ...data.locations.nremtOnly];
  const [room, setRoom] = useState<string>(knownRoom && !allRooms.includes(knownRoom) ? knownRoom : knownRoom);
  const [newRoom, setNewRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const skill = data.skill_options.find((o) => o.id === skillId) || null;
  const code = skill?.nremt_code || (isEdit && skillId === t?.skill_sheet_id ? t?.nremt_code : null) || null;
  const scenarioList = code && SCENARIO_CODES.includes(code) ? data.scenarios_by_code[code] || [] : [];
  const skillChanged = isEdit && (skillId || '') !== (t?.skill_sheet_id || '');
  const roomValue = room === NEW_LOCATION ? newRoom.trim() : room;

  const save = async () => {
    setErr(null);
    if (room === NEW_LOCATION && !newRoom.trim()) return setErr('Type the new location, or pick one from the list.');
    if (skillChanged && t && (t.eval_count === null || t.eval_count > 0)) {
      const n = t.eval_count === null ? 'may have' : `has ${t.eval_count}`;
      const ok = window.confirm(
        `This station ${n} recorded evaluations for its current skill. They stay counted under that skill and are not moved. ` +
          'Only new evaluations here count for the new skill. Change the skill anyway?'
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const inst = instructors.find((i) => i.email === proctorEmail) || null;
      const instructorName = inst ? inst.name : proctorEmail ? t?.instructor_name || null : null;
      if (isEdit && t) {
        const body: Record<string, unknown> = {};
        if (ownName.trim() !== (t.own_name || '')) body.custom_title = ownName.trim() || null;
        if (roomValue !== (t.room || '')) body.room = roomValue || null;
        if (proctorEmail !== (t.instructor_email || '')) {
          body.instructor_name = instructorName;
          body.instructor_email = proctorEmail;
        }
        if (skillChanged) {
          body.skill_sheet_id = skillId || null;
          body.skill_name = skill?.skill_name || null;
        }
        if (Object.keys(body).length > 0) {
          const res = await fetch(`/api/lab-management/stations/${t.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const d = await res.json();
          if (!d.success) throw new Error(d.error || 'Could not save the station');
        }
        // Scenario: only written when it changed, or when the skill changed (which clears it).
        const chosen = scenarioList.some((sc) => sc.id === scenarioId) ? scenarioId : null;
        if (skillChanged ? !!t.scenario_id || !!chosen : (chosen || '') !== (t.scenario_id || '')) {
          const res = await fetch(`/api/lab-management/stations/${t.id}/scenario`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario_id: chosen }),
          });
          const d = await res.json();
          if (!d.success) throw new Error(d.error || 'Could not save the scenario');
        }
      } else {
        const body: Record<string, unknown> = {
          lab_day_id: labDayId,
          station_number: nextStationNumber(allNumbers),
          station_type: 'skills',
          skill_sheet_id: skillId || null,
          skill_name: skill?.skill_name || state.skillLabel || null,
          custom_title: ownName.trim() || null,
          room: roomValue || null,
          added_during_exam: true,
        };
        if (proctorEmail) {
          body.instructor_name = instructorName;
          body.instructor_email = proctorEmail;
        }
        if (scenarioId && scenarioList.some((s) => s.id === scenarioId)) body.selected_scenario_id = scenarioId;
        const res = await fetch('/api/lab-management/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.error || 'Could not open the station');
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save');
      setBusy(false);
    }
  };

  const field = 'w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3';
  const label = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? `Edit station ${t?.station_number}` : `Open another ${state.skillLabel} station`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>

        <div>
          <label className={label}>Station name</label>
          <input className={field} value={ownName} onChange={(e) => setOwnName(e.target.value)} placeholder="e.g. Patient Assessment - Medical 2" />
        </div>

        <div>
          <label className={label}>NREMT skill this station covers</label>
          <select
            className={field}
            value={skillId}
            disabled={!isEdit}
            onChange={(e) => {
              setSkillId(e.target.value);
              setScenarioId('');
            }}
          >
            {!skillId && <option value="">Not set</option>}
            {data.skill_options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.skill_name}
              </option>
            ))}
            {skillId && !data.skill_options.some((o) => o.id === skillId) && <option value={skillId}>{state.skillLabel || t?.skill_label || 'Current skill'}</option>}
          </select>
          {!isEdit && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fixed to this group so it fills the same completion spot.</p>}
          {skillChanged && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Changing the skill clears the scenario. Evaluations already recorded here stay counted under the old skill.
            </p>
          )}
        </div>

        {scenarioList.length > 0 && (
          <div>
            <label className={label}>Scenario</label>
            <select className={field} value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              <option value="">Not picked</option>
              {scenarioList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={label}>Proctor</label>
          <select className={field} value={proctorEmail} onChange={(e) => setProctorEmail(e.target.value)}>
            <option value="">No proctor</option>
            {proctorEmail && !instructors.some((i) => i.email === proctorEmail) && <option value={proctorEmail}>{t?.instructor_name || proctorEmail}</option>}
            {instructors.map((i) => (
              <option key={i.id} value={i.email}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>Location</label>
          <select className={field} value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">Not set</option>
            <optgroup label="Standard lab locations">
              {data.locations.standard.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </optgroup>
            {(data.locations.nremtOnly.length > 0 || (room && !allRooms.includes(room))) && (
              <optgroup label="NREMT-only locations">
                {data.locations.nremtOnly.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                {room && !allRooms.includes(room) && room !== NEW_LOCATION && <option value={room}>{room}</option>}
              </optgroup>
            )}
            <option value={NEW_LOCATION}>Add new location...</option>
          </select>
          {room === NEW_LOCATION && (
            <div className="mt-2">
              <input className={field} value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="Type the location" autoFocus />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Saved for NREMT days only. It does not appear in the regular lab location lists.</p>
            </div>
          )}
        </div>

        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={save} className="min-h-[44px] px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60">
            {busy ? 'Saving...' : isEdit ? 'Save' : 'Open station'}
          </button>
        </div>
      </div>
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

  const [panel, setPanel] = useState<PanelState | null>(null);

  // Close / reopen: the existing coordinator_status mark on the station (the same one the
  // Coordinator View sets). Nothing is deleted; evaluations stay counted.
  const setStationStatus = async (tile: Tile, next: 'open' | 'closed') => {
    setSavingId(tile.id);
    try {
      const res = await fetch(`/api/lab-management/stations/${tile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinator_status: next }),
      });
      const d = await res.json();
      if (!d.success) alert('Could not change the station: ' + (d.error || 'unknown error'));
    } catch {
      alert('Could not change the station');
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
                    <StationTile key={t.id} tile={t} large canManage={canManage} saving={savingId === t.id} onEdit={(x) => setPanel({ mode: 'edit', tile: x, skillSheetId: x.skill_sheet_id, skillLabel: x.skill_label || '' })} onSetStatus={setStationStatus} />
                  ))}
                </div>
              </section>
            )}

            {data.groups.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">This day has no stations yet. Add them on the lab day page.</p>
            )}

            {data.groups.map((g) => (
              <section key={g.key} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {g.skill_name} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({g.stations.length})</span>
                  </h2>
                  {canManage && g.key !== 'other' && (
                    <button
                      type="button"
                      onClick={() => setPanel({ mode: 'create', skillSheetId: g.key, skillLabel: g.skill_name })}
                      className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <Plus className="w-4 h-4" /> Open another {g.skill_name} station
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1 gap-4">
                  {g.stations.map((t) => (
                    <StationTile key={t.id} tile={t} canManage={canManage} saving={savingId === t.id} onEdit={(x) => setPanel({ mode: 'edit', tile: x, skillSheetId: x.skill_sheet_id, skillLabel: x.skill_label || '' })} onSetStatus={setStationStatus} />
                  ))}
                </div>
              </section>
            ))}

            {canManage && (
              <details className="rounded-lg bg-white dark:bg-gray-800 shadow">
                <summary className="cursor-pointer min-h-[44px] flex items-center px-4 font-semibold text-gray-900 dark:text-white">Individual Testing Tracker</summary>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <IndividualTestingGrid labDayId={labDayId} isNremtTesting />
                </div>
              </details>
            )}

            {panel && (
              <StationPanel
                key={panel.mode + (panel.tile?.id || panel.skillSheetId || '')}
                state={panel}
                data={data}
                labDayId={labDayId}
                instructors={instructors}
                allNames={data.groups.flatMap((g) => g.stations.filter((st) => st.skill_sheet_id === panel.skillSheetId).map((st) => st.own_name || st.skill_label))}
                allNumbers={data.groups.flatMap((g) => g.stations.map((st) => st.station_number))}
                onClose={() => setPanel(null)}
                onSaved={() => {
                  setPanel(null);
                  load();
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
