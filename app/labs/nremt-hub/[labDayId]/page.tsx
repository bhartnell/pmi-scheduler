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
import { nextStationNumber, isClosed } from '@/lib/nremt-hub-stations';
import { buildStationPairs, nextExtraStationName, pairCodeFor, pickReopenStation, pickReopenPair, PAIR_TITLE, type PairItem } from '@/lib/nremt-pairs';
import IndividualTestingGrid from '@/components/lab-day/IndividualTestingGrid';
import ProctorsPanel from '@/components/nremt/ProctorsPanel';
import RunTheDay from '@/components/nremt/RunTheDay';
import { shortSkillLabel } from '@/lib/nremt-skill-labels';
import { computeDayStats, type DayStats } from '@/lib/nremt-day-stats';

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
  proctor_options?: { id: string | null; name: string; email: string }[];
  is_proctor?: boolean;
  can_manage?: boolean;
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

function PairTile({
  pair,
  canManage,
  saving,
  onEdit,
  onSetStatus,
}: {
  pair: { o2: Tile; bvm: Tile };
  canManage: boolean;
  saving: boolean;
  onEdit: (p: { o2: Tile; bvm: Tile }) => void;
  onSetStatus: (rows: Tile[], status: 'open' | 'closed') => void;
}) {
  const { o2, bvm } = pair;
  const closed = isClosed(o2.coordinator_status) && isClosed(bvm.coordinator_status);
  const proctor = (t: Tile) => (t.proctors.length > 0 ? t.proctors.join(', ') : 'not set');
  const sameProctor = proctor(o2) === proctor(bvm);
  const sameRoom = (o2.room || '') === (bvm.room || '');
  return (
    <div className={`rounded-lg shadow p-4 flex flex-col gap-3 ${closed ? 'bg-gray-100 dark:bg-gray-900 opacity-70' : 'bg-white dark:bg-gray-800'} border border-gray-200 dark:border-gray-700`}>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-bold text-lg text-gray-900 dark:text-white">{PAIR_TITLE}</div>
          {closed && <span className="shrink-0 rounded-full bg-gray-300 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-800 dark:text-gray-200">Closed</span>}
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300">
          1. O2 by NRB - station {o2.station_number}
          {!closed && isClosed(o2.coordinator_status) ? ' (closed)' : ''}
          <br />
          2. BVM - station {bvm.station_number}
          {!closed && isClosed(bvm.coordinator_status) ? ' (closed)' : ''}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Proctor: {sameProctor ? proctor(o2) : `${proctor(o2)} (O2 by NRB), ${proctor(bvm)} (BVM)`}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {sameRoom ? (o2.room ? `Location: ${o2.room}` : 'Location: not set') : `Location: ${o2.room || 'not set'} (O2 by NRB), ${bvm.room || 'not set'} (BVM)`}
        </div>
      </div>
      {closed && canManage ? (
        <button type="button" disabled={saving} onClick={() => onSetStatus([o2, bvm], 'open')} className="flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold min-h-[52px] disabled:opacity-60">
          <Unlock className="w-4 h-4" /> {saving ? 'Saving...' : 'Reopen'}
        </button>
      ) : (
        <>
          <Link href={`/labs/grade/station/${o2.id}`} className="flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold min-h-[52px]">
            Open grading
          </Link>
          <Link href={`/labs/grade/station/${bvm.id}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline self-start min-h-[44px] inline-flex items-center">
            Open BVM directly
          </Link>
        </>
      )}
      {canManage && (
        <div className="flex gap-2">
          <button type="button" onClick={() => onEdit(pair)} className="flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Pencil className="w-4 h-4" /> Edit station
          </button>
          {!closed && (
            <button type="button" disabled={saving} onClick={() => onSetStatus([o2, bvm], 'closed')} className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60">
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
  /** Edit of a BVM + O2 by NRB pair: proctor and location apply to this partner row too. */
  partner?: Tile;
  /** Create of BOTH parts of the two-part station (O2 by NRB first, then BVM). */
  pairCreate?: { o2SheetId: string | null; bvmSheetId: string | null; o2Label: string; bvmLabel: string; o2Group: Tile[]; bvmGroup: Tile[] };
}

const tileCode = (t: Tile) => pairCodeFor(t.nremt_code, t.skill_label);
const tileItem = (t: Tile): PairItem & { tile: Tile } => ({
  id: t.id,
  station_number: t.station_number,
  code: tileCode(t),
  proctor: t.proctors.length > 0 ? t.proctors.join(', ') : t.instructor_name,
  room: t.room,
  tile: t,
});
/** BVM + O2 by NRB pairs among the day's tiles (same proctor, else same room when both are empty). */
const tilePairs = (tiles: Tile[]) => buildStationPairs(tiles.map(tileItem)).map((p) => ({ o2: p.o2.tile, bvm: p.bvm.tile }));

function StationPanel({
  state,
  data,
  labDayId,
  instructors,
  groupStations,
  allNumbers,
  onClose,
  onSaved,
}: {
  state: PanelState;
  data: HubData;
  labDayId: string;
  instructors: InstructorOption[];
  groupStations: Array<{ station_number: number; name: string | null }>;
  allNumbers: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = state.tile;
  const isEdit = state.mode === 'edit';
  const partner = state.partner;
  const pc = state.pairCreate;
  // Extra stations are named after the base station in the group plus the next number
  // (never "Station 5B" style, never a "CPR -" prefix). Existing rows are not renamed.
  const [ownName, setOwnName] = useState(
    isEdit ? t?.own_name || '' : pc ? nextExtraStationName(pc.o2Group.map((x) => ({ station_number: x.station_number, name: x.own_name })), pc.o2Label) : nextExtraStationName(groupStations, state.skillLabel)
  );
  const [ownName2, setOwnName2] = useState(pc ? nextExtraStationName(pc.bvmGroup.map((x) => ({ station_number: x.station_number, name: x.own_name })), pc.bvmLabel) : '');
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
      if (isEdit && t && partner) {
        // BVM + O2 by NRB: proctor and location apply to both rows (two calls to the station PATCH).
        for (const row of [t, partner]) {
          const body: Record<string, unknown> = {};
          if (roomValue !== (row.room || '')) body.room = roomValue || null;
          if (proctorEmail !== (row.instructor_email || '')) {
            body.instructor_name = instructorName;
            body.instructor_email = proctorEmail;
          }
          if (Object.keys(body).length === 0) continue;
          const res = await fetch(`/api/lab-management/stations/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const d = await res.json();
          if (!d.success) throw new Error(d.error || 'Could not save the station');
        }
      } else if (!isEdit && pc) {
        const parts = [
          { sheet: pc.o2SheetId, label: pc.o2Label, name: ownName, what: 'O2 by NRB' },
          { sheet: pc.bvmSheetId, label: pc.bvmLabel, name: ownName2, what: 'BVM' },
        ];
        let n = nextStationNumber(allNumbers);
        let opened = 0;
        for (const part of parts) {
          const b: Record<string, unknown> = {
            lab_day_id: labDayId,
            station_number: n++,
            station_type: 'skills',
            skill_sheet_id: part.sheet || null,
            skill_name: part.label || null,
            custom_title: part.name.trim() || null,
            room: roomValue || null,
            added_during_exam: true,
          };
          if (proctorEmail) {
            b.instructor_name = instructorName;
            b.instructor_email = proctorEmail;
          }
          const res = await fetch('/api/lab-management/stations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(b),
          });
          const d = await res.json();
          if (!d.success) {
            throw new Error(
              (opened > 0 ? `The ${parts[0].what} part was opened but the ${part.what} part was not. Close this and use "Open another" for ${part.what} only. ` : '') +
                (d.error || 'Could not open the station')
            );
          }
          opened++;
        }
      } else if (isEdit && t) {
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
            {partner ? `Edit ${PAIR_TITLE}` : pc ? `Open another ${PAIR_TITLE} station` : isEdit ? `Edit station ${t?.station_number}` : `Open another ${state.skillLabel} station`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>

        {!partner && (
          <div>
            <label className={label}>{pc ? 'O2 by NRB station name' : 'Station name'}</label>
            <input className={field} value={ownName} onChange={(e) => setOwnName(e.target.value)} placeholder="e.g. Patient Assessment - Medical 2" />
          </div>
        )}
        {pc && (
          <div>
            <label className={label}>BVM station name</label>
            <input className={field} value={ownName2} onChange={(e) => setOwnName2(e.target.value)} />
          </div>
        )}
        {!partner && !pc && (<>

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

        </>)}

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
  // Closed stations are tucked away by default (nothing is deleted); one control reveals them.
  const [showClosed, setShowClosed] = useState(false);

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

  // A listed proctor (student account) gets the stations-only view: the API sends can_manage false.
  const canManage = data?.is_proctor ? false : effectiveRole ? hasMinRole(effectiveRole, 'instructor') : false;

  // Instructors plus the day's proctor list, so a person can be added and placed in one sitting.
  const pickerPeople: InstructorOption[] = [
    ...instructors,
    ...(data?.proctor_options || [])
      .filter((p) => !instructors.some((i) => i.email.toLowerCase() === p.email.toLowerCase()))
      .map((p) => ({ id: p.id || p.email, name: p.name, email: p.email })),
  ];

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
  // Tabs (instructor and above). "Run the day" is the default; a listed proctor sees stations only.
  const [tab, setTab] = useState<'run' | 'stations'>('run');

  // Overview row: the same student-queue data and the same rules (lib/nremt-day-stats) the
  // Coordinator View status bar uses. Instructor+ only (the API's own gate); refreshes every 30s.
  const [stats, setStats] = useState<DayStats | null>(null);
  const [freeCount, setFreeCount] = useState<{ free: number; total: number } | null>(null);
  const onFreeCount = useCallback((free: number, total: number) => setFreeCount((p) => (p && p.free === free && p.total === total ? p : { free, total })), []);
  const loadStats = useCallback(() => {
    fetch(`/api/lab-management/student-queue?lab_day_id=${labDayId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setStats(computeDayStats(d.students || [], d.stations || [], d.cells || {}, d.skillColumns || [], d.skillCells || {}));
      })
      .catch(() => {});
  }, [labDayId]);
  useEffect(() => {
    if (!canManage || !labDayId) return;
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, [canManage, labDayId, loadStats]);

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
    loadStats();
  };

  // Close / reopen both rows of the two-part station (two calls to the same station PATCH).
  const setRowsStatus = async (rows: Tile[], next: 'open' | 'closed') => {
    setSavingId(rows[0].id);
    try {
      for (const row of rows) {
        const res = await fetch(`/api/lab-management/stations/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinator_status: next }),
        });
        const d = await res.json();
        if (!d.success) {
          alert('Could not change the station: ' + (d.error || 'unknown error'));
          break;
        }
      }
    } catch {
      alert('Could not change the station');
    }
    setSavingId(null);
    load();
    loadStats();
  };

  // "Open another ..." reopens the lowest-numbered CLOSED station of that skill first (Nov 25 already
  // holds closed extras); only when the skill has none does it open the create panel for a new one.
  const [reopenNote, setReopenNote] = useState<string | null>(null);
  const stationLabel = (t: Tile) => t.own_name || t.skill_label || `Station ${t.station_number}`;
  const reopenOrCreate = async (candidates: Tile[], create: PanelState) => {
    const pick = pickReopenStation(candidates.map((t) => ({ station_number: t.station_number, closed: isClosed(t.coordinator_status), tile: t })));
    if (!pick) return setPanel(create);
    await setStationStatus(pick.tile, 'open');
    setReopenNote(`Reopened ${stationLabel(pick.tile)}`);
  };
  const reopenOrCreatePair = async (all: Tile[], create: PanelState) => {
    const pair = pickReopenPair(buildStationPairs(all.map((t) => ({ ...tileItem(t), closed: isClosed(t.coordinator_status) }))));
    if (!pair) return setPanel(create);
    await setRowsStatus([pair.o2.tile, pair.bvm.tile], 'open');
    setReopenNote(`Reopened ${PAIR_TITLE} (${stationLabel(pair.o2.tile)} and ${stationLabel(pair.bvm.tile)})`);
  };

  if (status === 'loading' || (!data && !error)) return <PageLoader />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="w-full max-w-[3000px] mx-auto px-4 md:px-6 2xl:px-8 py-4 flex items-center justify-between gap-4">
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

      <main className="w-full max-w-[3000px] mx-auto px-4 md:px-6 2xl:px-8 py-6 space-y-6">
        <Link href="/labs/nremt-hub" className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> All NREMT days
        </Link>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {data && (
          <>
            {canManage && stats && (() => {
              const allTiles = data.groups.flatMap((g) => g.stations);
              // A BVM + O2 by NRB pair counts as one station.
              const dayPairs = tilePairs(allTiles);
              const pairedIds = new Set(dayPairs.flatMap((p) => [p.o2.id, p.bvm.id]));
              const singles = allTiles.filter((t) => !pairedIds.has(t.id));
              const unitTotal = singles.length + dayPairs.length;
              const openCount = singles.filter((t) => !isClosed(t.coordinator_status)).length + dayPairs.filter((p) => !isClosed(p.o2.coordinator_status) && !isClosed(p.bvm.coordinator_status)).length;
              const pct = stats.skillsPossible > 0 ? Math.round((stats.skillsCompleted / stats.skillsPossible) * 100) : 0;
              const items: { label: string; value: string }[] = [
                { label: 'Students', value: String(stats.students) },
                { label: 'Stations open', value: `${openCount} of ${unitTotal}` },
                { label: 'Testing now', value: String(stats.testing) },
                { label: 'Waiting', value: String(stats.waiting) },
                { label: 'Complete', value: String(stats.complete) },
                { label: 'Overall', value: `${stats.skillsCompleted} of ${stats.skillsPossible} (${pct}%)` },
              ];
              if (tab === 'run' && freeCount) items.splice(2, 0, { label: 'Stations free', value: `${freeCount.free} of ${freeCount.total}` });
              return (
                <section aria-label="Day overview" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                  {items.map((it) => (
                    <div key={it.label} className="rounded-lg bg-white dark:bg-gray-800 shadow px-4 py-3 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{it.label}</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{it.value}</div>
                    </div>
                  ))}
                </section>
              );
            })()}

            {canManage && (
              <nav aria-label="Day views" className="flex flex-wrap items-center gap-2">
                {([['run', 'Run the day'], ['stations', 'Stations and proctors']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    aria-current={tab === k ? 'page' : undefined}
                    className={`min-h-[44px] px-4 rounded-lg font-semibold ${tab === k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow'}`}
                  >
                    {label}
                  </button>
                ))}
                <Link href={`/labs/schedule/${labDayId}/results`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Skill results
                </Link>
                <Link href={`/labs/schedule/${labDayId}`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Set-up
                </Link>
              </nav>
            )}

            {canManage && tab === 'run' && <RunTheDay labDayId={labDayId} canManage={canManage} onChanged={load} onFreeCount={onFreeCount} />}

            {(!canManage || tab === 'stations') && (<>
            {data.my_stations.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your station</h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                  {data.my_stations.map((t) => (
                    <StationTile key={t.id} tile={t} large canManage={canManage} saving={savingId === t.id} onEdit={(x) => setPanel({ mode: 'edit', tile: x, skillSheetId: x.skill_sheet_id, skillLabel: x.skill_label || '' })} onSetStatus={setStationStatus} />
                  ))}
                </div>
              </section>
            )}

            {data.groups.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">This day has no stations yet. Add them on the lab day page.</p>
            )}

            {(() => {
              const allTiles = data.groups.flatMap((g) => g.stations);
              const closedCount = allTiles.filter((t) => isClosed(t.coordinator_status)).length;
              const visible = (t: Tile) => showClosed || !isClosed(t.coordinator_status);
              const isPartGroup = (g: Group) => g.stations.some((t) => tileCode(t) === 'E203' || tileCode(t) === 'E204');
              const partGroups = data.groups.filter(isPartGroup);
              const firstPartGroup = partGroups[0];
              const partTiles = partGroups.flatMap((g) => g.stations);
              const pairs = tilePairs(partTiles);
              const pairedIds = new Set(pairs.flatMap((p) => [p.o2.id, p.bvm.id]));
              const pairsShown = pairs.filter((p) => showClosed || !(isClosed(p.o2.coordinator_status) && isClosed(p.bvm.coordinator_status)));
              const looseShown = partTiles.filter((t) => !pairedIds.has(t.id) && visible(t));
              const o2Group = partGroups.find((g) => g.stations.some((t) => tileCode(t) === 'E204'));
              const bvmGroup = partGroups.find((g) => g.stations.some((t) => tileCode(t) === 'E203'));
              const openEdit = (x: Tile) => setPanel({ mode: 'edit', tile: x, skillSheetId: x.skill_sheet_id, skillLabel: x.skill_label || '' });
              return (
                <>
                  {reopenNote && (
                    <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 min-h-[44px] text-sm text-green-900 dark:text-green-200">
                      <span>{reopenNote}</span>
                      <button type="button" onClick={() => setReopenNote(null)} aria-label="Dismiss" className="min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                  {closedCount > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowClosed((v) => !v)}
                        className="min-h-[44px] px-3 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:underline"
                      >
                        {showClosed ? 'Hide closed stations' : `Show closed stations (${closedCount})`}
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,560px),1fr))] gap-4 items-start">
                    {data.groups.map((g) => {
                      if (isPartGroup(g)) {
                        if (g !== firstPartGroup) return null;
                        return (
                          <section key="bvm-o2-pair" className="space-y-3 rounded-xl bg-white dark:bg-gray-800 shadow p-4 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {PAIR_TITLE} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({pairsShown.length + looseShown.length})</span>
                              </h2>
                              {canManage && (
                                <details className="relative">
                                  <summary className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-300 text-sm font-medium cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 list-none">
                                    <Plus className="w-4 h-4" /> Open another
                                  </summary>
                                  <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 p-1 flex flex-col">
                                    {o2Group && bvmGroup && (
                                      <button
                                        type="button"
                                        className="text-left min-h-[44px] px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                                        onClick={() =>
                                          reopenOrCreatePair(partTiles, {
                                            mode: 'create',
                                            skillSheetId: null,
                                            skillLabel: PAIR_TITLE,
                                            pairCreate: {
                                              o2SheetId: o2Group.key,
                                              bvmSheetId: bvmGroup.key,
                                              o2Label: o2Group.skill_name,
                                              bvmLabel: bvmGroup.skill_name,
                                              o2Group: o2Group.stations,
                                              bvmGroup: bvmGroup.stations,
                                            },
                                          })
                                        }
                                      >
                                        Both parts
                                      </button>
                                    )}
                                    {bvmGroup && (
                                      <button type="button" className="text-left min-h-[44px] px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white" onClick={() => reopenOrCreate(bvmGroup.stations.filter((t) => tileCode(t) === 'E203'), { mode: 'create', skillSheetId: bvmGroup.key, skillLabel: bvmGroup.skill_name })}>
                                        BVM only
                                      </button>
                                    )}
                                    {o2Group && (
                                      <button type="button" className="text-left min-h-[44px] px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white" onClick={() => reopenOrCreate(o2Group.stations.filter((t) => tileCode(t) === 'E204'), { mode: 'create', skillSheetId: o2Group.key, skillLabel: o2Group.skill_name })}>
                                        O2 by NRB only
                                      </button>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                              {pairsShown.map((p) => (
                                <PairTile
                                  key={p.o2.id}
                                  pair={p}
                                  canManage={canManage}
                                  saving={savingId === p.o2.id}
                                  onEdit={(x) => setPanel({ mode: 'edit', tile: x.o2, partner: x.bvm, skillSheetId: x.o2.skill_sheet_id, skillLabel: PAIR_TITLE })}
                                  onSetStatus={setRowsStatus}
                                />
                              ))}
                              {looseShown.map((t) => (
                                <div key={t.id} className="space-y-1">
                                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{tileCode(t) === 'E203' ? 'BVM only' : 'O2 by NRB only'}</div>
                                  <StationTile tile={t} canManage={canManage} saving={savingId === t.id} onEdit={openEdit} onSetStatus={setStationStatus} />
                                </div>
                              ))}
                            </div>
                          </section>
                        );
                      }
                      const shown = g.stations.filter(visible);
                      if (shown.length === 0) return null;
                      const groupLabel = shortSkillLabel(g.skill_name, g.stations[0]?.nremt_code);
                      return (
                        <section key={g.key} className="space-y-3 rounded-xl bg-white dark:bg-gray-800 shadow p-4 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                              <span title={g.skill_name}>{groupLabel}</span> <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({shown.length})</span>
                            </h2>
                            {canManage && g.key !== 'other' && (
                              <button
                                type="button"
                                onClick={() => reopenOrCreate(g.stations, { mode: 'create', skillSheetId: g.key, skillLabel: g.skill_name })}
                                className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <Plus className="w-4 h-4" /> Open another {groupLabel} station
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                            {shown.map((t) => (
                              <StationTile key={t.id} tile={t} canManage={canManage} saving={savingId === t.id} onEdit={openEdit} onSetStatus={setStationStatus} />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {canManage && <ProctorsPanel labDayId={labDayId} onChanged={load} />}

            {canManage && (
              <details className="rounded-lg bg-white dark:bg-gray-800 shadow">
                <summary className="cursor-pointer min-h-[44px] flex items-center px-4 font-semibold text-gray-900 dark:text-white">Individual Testing Tracker</summary>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <IndividualTestingGrid labDayId={labDayId} isNremtTesting />
                </div>
              </details>
            )}

            </>)}

            {canManage && (
              <div className="flex flex-wrap gap-3">
                <Link href={`/labs/schedule/${labDayId}/coordinator`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Coordinator View (previous)
                </Link>
              </div>
            )}

            {panel && (
              <StationPanel
                key={panel.mode + (panel.tile?.id || panel.skillSheetId || '')}
                state={panel}
                data={data}
                labDayId={labDayId}
                instructors={pickerPeople}
                groupStations={data.groups.flatMap((g) => g.stations.filter((st) => st.skill_sheet_id === panel.skillSheetId).map((st) => ({ station_number: st.station_number, name: st.own_name })))}
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
