'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ArrowLeft, Pencil, Plus, Lock, Unlock, X, Check } from 'lucide-react';
import { PageLoader } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { formatHubDate, formatHubTime, localCalendarDate } from '@/lib/nremt-hub-format';
import { nextStationNumber, isClosed, patchTilesIn, proctorChoices, withAssistant, sameStationPerson, whoIsWhere, placementLine, cleanReopenBody } from '@/lib/nremt-hub-stations';
import { buildStationPairs, nextExtraStationName, pairCodeFor, pickReopenStation, pickReopenPair, PAIR_TITLE, type PairItem } from '@/lib/nremt-pairs';
import IndividualTestingGrid from '@/components/lab-day/IndividualTestingGrid';
import ProctorsPanel, { PersonSearch, type PickedPerson } from '@/components/nremt/ProctorsPanel';
import type { RtdInput } from '@/lib/nremt-run-the-day';
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
  /** Optional second proctor (hub-only, station metadata.nremt_assistant). */
  assistant_name?: string | null;
  assistant_email?: string | null;
  /** True when the signed-in person is this station's assistant (shows under their own station). */
  assisting?: boolean;
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
  /** Copied closed extras nobody made or used; left out of every list and count, reused by Open another. */
  spares?: Tile[];
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

// ---- Proctor and location drop-downs on each tile (card 4225cd1c) ---------------------------
// Picking a name or a place saves at once through the existing station PATCH and updates that one
// tile in place: no panel, no refetch of the whole day. A failed save leaves the old value showing.

interface DropsApi {
  today: InstructorOption[];
  staff: InstructorOption[];
  rooms: { standard: string[]; nremtOnly: string[] };
  setProctor: (rows: Tile[], who: { name: string; email: string } | null) => Promise<boolean>;
  setAssistant: (rows: Tile[], who: { name: string; email: string } | null) => Promise<boolean>;
  setRoom: (rows: Tile[], room: string | null) => Promise<boolean>;
  addAndSet: (rows: Tile[], person: PickedPerson) => Promise<boolean>;
}

const ADD_PERSON = '__add__';
const MIXED = '__mixed__';

function StationDrops({ rows, drops }: { rows: Tile[]; drops: DropsApi }) {
  const [adding, setAdding] = useState(false);
  const [addingAssistant, setAddingAssistant] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [newRoom, setNewRoom] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const run = async (fn: () => Promise<boolean>) => {
    setState('saving');
    const ok = await fn();
    setState(ok ? 'saved' : 'failed');
    if (ok) setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 1500);
  };

  const emails = rows.map((r) => (r.instructor_email || '').toLowerCase());
  const mixedProctor = new Set(emails).size > 1;
  const proctorValue = mixedProctor ? MIXED : emails[0] || '';
  const asstEmails = rows.map((r) => (r.assistant_email || '').toLowerCase());
  const mixedAsst = new Set(asstEmails).size > 1;
  const asstValue = mixedAsst ? MIXED : asstEmails[0] || '';
  const assistantShown = showAssistant || !!asstValue;
  const rooms = rows.map((r) => r.room || '');
  const mixedRoom = new Set(rooms).size > 1;
  const roomValue = mixedRoom ? MIXED : rooms[0];
  const knownRooms = [...drops.rooms.standard, ...drops.rooms.nremtOnly];
  const staff = proctorChoices(drops.today, drops.staff).staff;
  const sel = 'w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 text-sm text-gray-900 dark:text-white';
  const label = 'text-xs font-medium text-gray-500 dark:text-gray-400';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={label}>Proctor and location</span>
        {state === 'saving' && <span className="text-xs text-gray-500 dark:text-gray-400">Saving...</span>}
        {state === 'saved' && <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-300"><Check className="w-3 h-3" /> Saved</span>}
        {state === 'failed' && <span className="text-xs text-red-600 dark:text-red-400">Not saved, old value kept</span>}
      </div>
      <select
        aria-label="Proctor"
        className={sel}
        value={proctorValue}
        disabled={state === 'saving'}
        onChange={(e) => {
          const v = e.target.value;
          if (v === ADD_PERSON) return setAdding(true);
          if (v === MIXED) return;
          if (v === '') return void run(() => drops.setProctor(rows, null));
          const who = [...drops.today, ...drops.staff].find((p) => p.email.toLowerCase() === v);
          if (who) void run(() => drops.setProctor(rows, { name: who.name, email: who.email }));
        }}
      >
        {mixedProctor && <option value={MIXED}>Different on each part</option>}
        <option value="">No proctor</option>
        {proctorValue && proctorValue !== MIXED && ![...drops.today, ...drops.staff].some((p) => p.email.toLowerCase() === proctorValue) && (
          <option value={proctorValue}>{rows[0].instructor_name || proctorValue}</option>
        )}
        {drops.today.length > 0 && (
          <optgroup label="Today's proctors">
            {drops.today.map((p) => <option key={p.email} value={p.email.toLowerCase()} disabled={asstEmails.some((e) => sameStationPerson(e, p.email))}>{p.name}</option>)}
          </optgroup>
        )}
        {staff.length > 0 && (
          <optgroup label="Staff">
            {staff.map((p) => <option key={p.email} value={p.email.toLowerCase()} disabled={asstEmails.some((e) => sameStationPerson(e, p.email))}>{p.name}</option>)}
          </optgroup>
        )}
        <option value={ADD_PERSON}>Add someone...</option>
      </select>
      {!assistantShown && (
        <button type="button" onClick={() => setShowAssistant(true)} className="min-h-[44px] px-1 text-sm text-blue-700 dark:text-blue-300 hover:underline">+ Add assistant</button>
      )}
      {assistantShown && (
        <>
          <select
            aria-label="Assistant"
            className={sel}
            value={asstValue}
            disabled={state === 'saving'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === ADD_PERSON) return setAddingAssistant(true);
              if (v === MIXED) return;
              if (v === '') return void run(() => drops.setAssistant(rows, null));
              const who = [...drops.today, ...drops.staff].find((p) => p.email.toLowerCase() === v);
              if (who) void run(() => drops.setAssistant(rows, { name: who.name, email: who.email }));
            }}
          >
            {mixedAsst && <option value={MIXED}>Different on each part</option>}
            <option value="">No assistant</option>
            {asstValue && asstValue !== MIXED && ![...drops.today, ...drops.staff].some((p) => p.email.toLowerCase() === asstValue) && (
              <option value={asstValue}>{rows[0].assistant_name || asstValue}</option>
            )}
            {drops.today.length > 0 && (
              <optgroup label="Today's proctors">
                {drops.today.map((p) => <option key={p.email} value={p.email.toLowerCase()} disabled={emails.some((e) => sameStationPerson(e, p.email))}>{p.name}</option>)}
              </optgroup>
            )}
            {staff.length > 0 && (
              <optgroup label="Staff">
                {staff.map((p) => <option key={p.email} value={p.email.toLowerCase()} disabled={emails.some((e) => sameStationPerson(e, p.email))}>{p.name}</option>)}
              </optgroup>
            )}
            <option value={ADD_PERSON}>Add someone...</option>
          </select>
          {addingAssistant && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2">
              <PersonSearch
                autoFocus
                busy={state === 'saving'}
                onPick={(p) => {
                  setAddingAssistant(false);
                  if (emails.some((e) => sameStationPerson(e, p.email))) return void alert('That person is already the proctor on this station.');
                  void run(async () => {
                    const name = p.name || p.email;
                    if (!(await drops.addAndSet([], p))) return false;
                    return drops.setAssistant(rows, { name, email: p.email });
                  });
                }}
              />
              <button type="button" onClick={() => setAddingAssistant(false)} className="min-h-[44px] px-3 text-sm text-gray-600 dark:text-gray-300 hover:underline">Cancel</button>
            </div>
          )}
        </>
      )}
      {adding && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2">
          <PersonSearch
            autoFocus
            busy={state === 'saving'}
            onPick={(p) => {
              setAdding(false);
              void run(() => drops.addAndSet(rows, p));
            }}
          />
          <button type="button" onClick={() => setAdding(false)} className="min-h-[44px] px-3 text-sm text-gray-600 dark:text-gray-300 hover:underline">Cancel</button>
        </div>
      )}
      <select
        aria-label="Location"
        className={sel}
        value={newRoom !== null ? '__new__' : roomValue}
        disabled={state === 'saving'}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__new__') return setNewRoom('');
          if (v === MIXED) return;
          void run(() => drops.setRoom(rows, v || null));
        }}
      >
        {mixedRoom && <option value={MIXED}>Different on each part</option>}
        <option value="">Location not set</option>
        {roomValue && roomValue !== MIXED && !knownRooms.includes(roomValue) && <option value={roomValue}>{roomValue}</option>}
        <optgroup label="Standard lab locations">
          {drops.rooms.standard.map((r) => <option key={r} value={r}>{r}</option>)}
        </optgroup>
        {drops.rooms.nremtOnly.length > 0 && (
          <optgroup label="NREMT-only locations">
            {drops.rooms.nremtOnly.map((r) => <option key={r} value={r}>{r}</option>)}
          </optgroup>
        )}
        <option value="__new__">Add new location...</option>
      </select>
      {newRoom !== null && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newRoom}
            onChange={(e) => setNewRoom(e.target.value)}
            placeholder="Type the location"
            className="flex-1 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-white"
          />
          <button
            type="button"
            disabled={!newRoom.trim() || state === 'saving'}
            onClick={() => {
              const v = newRoom.trim();
              setNewRoom(null);
              void run(() => drops.setRoom(rows, v));
            }}
            className="min-h-[44px] px-3 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            Save
          </button>
          <button type="button" onClick={() => setNewRoom(null)} className="min-h-[44px] px-2 text-sm text-gray-600 dark:text-gray-300 hover:underline">Cancel</button>
        </div>
      )}
    </div>
  );
}

function StationTile({
  tile,
  large,
  canManage,
  saving,
  onEdit,
  onSetStatus,
  drops,
}: {
  tile: Tile;
  large?: boolean;
  canManage: boolean;
  saving: boolean;
  onEdit: (t: Tile) => void;
  onSetStatus: (t: Tile, status: 'open' | 'closed') => void;
  drops?: DropsApi;
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
        {tile.assisting && (
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Assisting {tile.proctors.length > 0 ? tile.proctors.join(', ') : 'this station'}</div>
        )}
        {!tile.assisting && tile.assistant_name && (
          <div className="text-sm text-gray-700 dark:text-gray-300">with {tile.assistant_name} assisting</div>
        )}
        {canManage && drops ? (
          <StationDrops rows={[tile]} drops={drops} />
        ) : (
          <>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Proctor: {withAssistant(tile.proctors.length > 0 ? tile.proctors.join(', ') : null, tile.assistant_name) || 'not set'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{tile.room ? `Location: ${tile.room}` : 'Location: not set'}</div>
          </>
        )}
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
  drops,
}: {
  pair: { o2: Tile; bvm: Tile };
  canManage: boolean;
  saving: boolean;
  onEdit: (p: { o2: Tile; bvm: Tile }) => void;
  onSetStatus: (rows: Tile[], status: 'open' | 'closed') => void;
  drops?: DropsApi;
}) {
  const { o2, bvm } = pair;
  const closed = isClosed(o2.coordinator_status) && isClosed(bvm.coordinator_status);
  const proctor = (t: Tile) => withAssistant(t.proctors.length > 0 ? t.proctors.join(', ') : null, t.assistant_name) || 'not set';
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
        {canManage && drops ? (
          <StationDrops rows={[o2, bvm]} drops={drops} />
        ) : (
          <>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Proctor: {sameProctor ? proctor(o2) : `${proctor(o2)} (O2 by NRB), ${proctor(bvm)} (BVM)`}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sameRoom ? (o2.room ? `Location: ${o2.room}` : 'Location: not set') : `Location: ${o2.room || 'not set'} (O2 by NRB), ${bvm.room || 'not set'} (BVM)`}
            </div>
          </>
        )}
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

  // ---- Proctor / location drop-downs: in-place saves (card 4225cd1c) ----
  const [proctorsVersion, setProctorsVersion] = useState(0);
  const [clearNote, setClearNote] = useState<string | null>(null);
  const sessionEmail = (session?.user?.email || '').toLowerCase();
  const patchTilesLocal = (ids: string[], patch: Partial<Tile>) => setData((d) => (d ? patchTilesIn(d, ids, patch) : d));
  const patchStation = async (id: string, body: Record<string, unknown>): Promise<string | null> => {
    try {
      const res = await fetch(`/api/lab-management/stations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      return d.success ? null : d.error || 'unknown error';
    } catch {
      return 'network error';
    }
  };
  const setProctorRows = async (rows: Tile[], who: { name: string; email: string } | null): Promise<boolean> => {
    const done: string[] = [];
    for (const row of rows) {
      const err = await patchStation(row.id, who ? { instructor_name: who.name, instructor_email: who.email } : { instructor_name: null, instructor_email: '' });
      if (err) {
        alert('Could not change the proctor: ' + err);
        if (done.length) patchTilesLocal(done, who ? { instructor_name: who.name, instructor_email: who.email, proctors: [who.name], is_mine: who.email.toLowerCase() === sessionEmail } : { instructor_name: null, instructor_email: null, proctors: [], is_mine: false });
        return false;
      }
      done.push(row.id);
    }
    patchTilesLocal(done, who ? { instructor_name: who.name, instructor_email: who.email, proctors: [who.name], is_mine: who.email.toLowerCase() === sessionEmail } : { instructor_name: null, instructor_email: null, proctors: [], is_mine: false });
    return true;
  };
  const setAssistantRows = async (rows: Tile[], who: { name: string; email: string } | null): Promise<boolean> => {
    const patchFor = (w: typeof who): Partial<Tile> => (w
      ? { assistant_name: w.name, assistant_email: w.email, assisting: w.email.toLowerCase() === sessionEmail }
      : { assistant_name: null, assistant_email: null, assisting: false });
    const done: string[] = [];
    for (const row of rows) {
      const err = await patchStation(row.id, { nremt_assistant: who ? { name: who.name, email: who.email } : null });
      if (err) {
        alert('Could not change the assistant: ' + err);
        if (done.length) patchTilesLocal(done, patchFor(who));
        return false;
      }
      done.push(row.id);
    }
    patchTilesLocal(done, patchFor(who));
    // The assistant's own "Your station" list comes from the server; fetch it when it could change for me.
    if ((who && who.email.toLowerCase() === sessionEmail) || rows.some((r) => r.assisting)) void load();
    return true;
  };
  const setRoomRows = async (rows: Tile[], room: string | null): Promise<boolean> => {
    const done: string[] = [];
    for (const row of rows) {
      const err = await patchStation(row.id, { room });
      if (err) {
        alert('Could not change the location: ' + err);
        if (done.length) patchTilesLocal(done, { room });
        return false;
      }
      done.push(row.id);
    }
    patchTilesLocal(done, { room });
    if (room) {
      setData((d) => (d && ![...d.locations.standard, ...d.locations.nremtOnly].includes(room) ? { ...d, locations: { ...d.locations, nremtOnly: [...d.locations.nremtOnly, room] } } : d));
    }
    return true;
  };
  const addAndSetProctor = async (rows: Tile[], p: PickedPerson): Promise<boolean> => {
    try {
      const res = await fetch('/api/lab-management/nremt-hub/proctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId, email: p.email, name: p.name, labUserId: p.labUserId }),
      });
      const d = await res.json();
      if (!d.success) {
        alert('Could not add that person: ' + (d.error || 'unknown error'));
        return false;
      }
    } catch {
      alert('Could not add that person');
      return false;
    }
    const name = p.name || p.email;
    setData((d) => (d && !(d.proctor_options || []).some((o) => o.email.toLowerCase() === p.email.toLowerCase()) ? { ...d, proctor_options: [...(d.proctor_options || []), { id: p.labUserId || null, name, email: p.email }] } : d));
    setProctorsVersion((v) => v + 1);
    return setProctorRows(rows, { name, email: p.email });
  };
  const clearAllProctors = async () => {
    const tiles = (data?.groups || []).flatMap((g) => g.stations).filter((t) => t.instructor_email || t.instructor_name || t.proctors.length > 0 || t.assistant_email);
    if (tiles.length === 0) return setClearNote('No station has a proctor or assistant.');
    if (!window.confirm(`Remove the proctor and assistant from ${tiles.length} station${tiles.length === 1 ? '' : 's'}? Locations and scenarios stay.`)) return;
    let cleared = 0;
    for (const t of tiles) {
      const okProctor = await setProctorRows([t], null);
      const okAsst = t.assistant_email ? await setAssistantRows([t], null) : true;
      if (okProctor && okAsst) cleared++;
      else break;
    }
    setClearNote(`Cleared the proctor and assistant on ${cleared} of ${tiles.length} stations.`);
  };
  const drops: DropsApi | undefined = canManage && data
    ? {
        today: (data.proctor_options || []).map((p) => ({ id: p.id || p.email, name: p.name, email: p.email })),
        staff: instructors,
        rooms: data.locations,
        setProctor: setProctorRows,
        setAssistant: setAssistantRows,
        setRoom: setRoomRows,
        addAndSet: addAndSetProctor,
      }
    : undefined;

  const [panel, setPanel] = useState<PanelState | null>(null);
  // Tabs (instructor and above). "Run the day" is the default; a listed proctor sees stations only.
  const [tab, setTab] = useState<'run' | 'stations'>('run');

  // Overview row: the same student-queue data and the same rules (lib/nremt-day-stats) the
  // Coordinator View status bar uses. Instructor+ only (the API's own gate); refreshes with the Run the day data (30s on Stations and proctors).
  const [stats, setStats] = useState<DayStats | null>(null);
  const [freeCount, setFreeCount] = useState<{ free: number; total: number } | null>(null);
  const onFreeCount = useCallback((free: number, total: number) => setFreeCount((p) => (p && p.free === free && p.total === total ? p : { free, total })), []);
  const loadStats = useCallback(() => {
    fetch(`/api/lab-management/student-queue?lab_day_id=${labDayId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setStats(computeDayStats(d.students || [], (d.stations || []).filter((st: { notMade?: boolean }) => !st.notMade), d.cells || {}, d.skillColumns || [], d.skillCells || {}));
      })
      .catch(() => {});
  }, [labDayId]);
  // On Run the day the stats come from the data that tab already fetched (onRunData), so there is no
  // second poll. On Stations and proctors there is no such data, so the old 30 s fetch stays there; it
  // skips while the browser tab is hidden and refreshes once when it is visible again.
  // Day start (date + start time, as the browser reads it) for the estimated finish on Run the day.
  const dayStartMs = ((): number | null => {
    if (!data?.day?.date || !data.day.start_time) return null;
    const m = /^(\d{1,2}):(\d{2})/.exec(data.day.start_time);
    if (!m) return null;
    const d = localCalendarDate(data.day.date);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  })();
  const onRunData = useCallback(
    (i: RtdInput) => setStats(computeDayStats(i.students, i.stations, i.cells, i.skillColumns, i.skillCells)),
    []
  );
  useEffect(() => {
    if (!canManage || !labDayId || tab === 'run') return;
    loadStats();
    const t = setInterval(() => {
      if (!document.hidden) loadStats();
    }, 30000);
    const onVisible = () => {
      if (!document.hidden) loadStats();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [canManage, labDayId, loadStats, tab]);

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
  // A not-made row (data.spares) reused by "Open another" starts clean: open, no proctor, no assistant,
  // no room, named after the skill's made stations. A made closed station is simply reopened as it was.
  const spareIds = new Set((data?.spares || []).map((t) => t.id));
  const reopenTile = async (tile: Tile): Promise<string | null> => {
    if (!spareIds.has(tile.id)) {
      const err = await patchStation(tile.id, { coordinator_status: 'open' });
      return err;
    }
    const made = (data?.groups || []).find((g) => g.key === tile.skill_sheet_id)?.stations || [];
    const name = nextExtraStationName(
      made.map((m) => ({ station_number: m.station_number, name: m.own_name || m.skill_label })),
      tile.skill_label || 'Station'
    );
    return patchStation(tile.id, cleanReopenBody(name));
  };
  const sparesOf = (sheetIds: Array<string | null>) => (data?.spares || []).filter((t) => t.skill_sheet_id && sheetIds.includes(t.skill_sheet_id));
  const reopenOrCreate = async (candidates: Tile[], create: PanelState) => {
    const pool = [...candidates, ...sparesOf([create.skillSheetId]).filter((t) => !candidates.some((c) => c.id === t.id) && (!candidates[0] || tileCode(t) === tileCode(candidates[0])))];
    const pick = pickReopenStation(pool.map((t) => ({ station_number: t.station_number, closed: isClosed(t.coordinator_status), tile: t })));
    if (!pick) return setPanel(create);
    setSavingId(pick.tile.id);
    const err = await reopenTile(pick.tile);
    setSavingId(null);
    if (err) alert('Could not change the station: ' + err);
    else setReopenNote(`Reopened ${spareIds.has(pick.tile.id) ? 'a new station' : stationLabel(pick.tile)}`);
    load();
    loadStats();
  };
  const reopenOrCreatePair = async (all: Tile[], create: PanelState) => {
    const pool = [...all, ...(data?.spares || []).filter((t) => tileCode(t) === 'E203' || tileCode(t) === 'E204')];
    const pair = pickReopenPair(buildStationPairs(pool.map((t) => ({ ...tileItem(t), closed: isClosed(t.coordinator_status) }))));
    if (!pair) return setPanel(create);
    setSavingId(pair.o2.tile.id);
    let err: string | null = null;
    for (const row of [pair.o2.tile, pair.bvm.tile]) {
      err = await reopenTile(row);
      if (err) break;
    }
    setSavingId(null);
    if (err) alert('Could not change the station: ' + err);
    else setReopenNote(`Reopened ${PAIR_TITLE}`);
    load();
    loadStats();
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
              const items: { label: string; value: string; note?: string }[] = [
                { label: 'Students', value: String(stats.students) },
                { label: 'Stations open', value: String(openCount), note: unitTotal > openCount ? `${unitTotal - openCount} closed` : undefined },
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
                      <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {it.value}
                        {it.note && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{it.note}</span>}
                      </div>
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
              </nav>
            )}

            {canManage && tab === 'run' && <RunTheDay labDayId={labDayId} canManage={canManage} onChanged={load} onFreeCount={onFreeCount} onData={onRunData} startMs={dayStartMs} />}

            {(!canManage || tab === 'stations') && (<>
            {canManage && (
              <ProctorsPanel
                placements={whoIsWhere(
                  (data.proctor_options || []).map((o) => ({ name: o.name, email: o.email })),
                  data.groups.flatMap((g) => g.stations).map((t) => ({
                    station_number: t.station_number,
                    title: t.own_name || t.skill_label || `Station ${t.station_number}`,
                    instructor_email: t.instructor_email,
                    instructor_name: t.instructor_name,
                    assistant_email: t.assistant_email ?? null,
                    assistant_name: t.assistant_name ?? null,
                    coordinator_status: t.coordinator_status,
                  }))
                ).map((w) => placementLine(w.name, w.places))}
                key={proctorsVersion}
                labDayId={labDayId}
                onChanged={load}
                extra={
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button type="button" onClick={clearAllProctors} className="min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      Clear all proctors
                    </button>
                    {clearNote && <span role="status" className="text-sm text-gray-700 dark:text-gray-300">{clearNote}</span>}
                  </div>
                }
              />
            )}
            {data.my_stations.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your station</h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                  {data.my_stations.map((t) => (
                    <StationTile key={t.id} tile={t} large canManage={canManage} saving={savingId === t.id} onEdit={(x) => setPanel({ mode: 'edit', tile: x, skillSheetId: x.skill_sheet_id, skillLabel: x.skill_label || '' })} onSetStatus={setStationStatus} drops={drops} />
                  ))}
                </div>
              </section>
            )}

            {data.groups.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">This day has no stations yet. Add them on the lab day page.</p>
            )}

            {(() => {
              const allTiles = data.groups.flatMap((g) => g.stations);
              const visible = (t: Tile) => showClosed || !isClosed(t.coordinator_status);
              const isPartGroup = (g: Group) => g.stations.some((t) => tileCode(t) === 'E203' || tileCode(t) === 'E204');
              const partGroups = data.groups.filter(isPartGroup);
              const firstPartGroup = partGroups[0];
              const partTiles = partGroups.flatMap((g) => g.stations);
              const pairs = tilePairs(partTiles);
              const pairedIds = new Set(pairs.flatMap((p) => [p.o2.id, p.bvm.id]));
              // A BVM + O2 pair is one station in the count: closed when both parts are closed.
              const closedCount = allTiles.filter((t) => !pairedIds.has(t.id) && isClosed(t.coordinator_status)).length + pairs.filter((p) => isClosed(p.o2.coordinator_status) && isClosed(p.bvm.coordinator_status)).length;
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
                                  drops={drops}
                                />
                              ))}
                              {looseShown.map((t) => (
                                <div key={t.id} className="space-y-1">
                                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{tileCode(t) === 'E203' ? 'BVM only' : 'O2 by NRB only'}</div>
                                  <StationTile tile={t} canManage={canManage} saving={savingId === t.id} onEdit={openEdit} onSetStatus={setStationStatus} drops={drops} />
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
                              <StationTile key={t.id} tile={t} canManage={canManage} saving={savingId === t.id} onEdit={openEdit} onSetStatus={setStationStatus} drops={drops} />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {canManage && (
              <details className="rounded-lg bg-white dark:bg-gray-800 shadow">
                <summary className="cursor-pointer min-h-[44px] flex items-center px-4 font-semibold text-gray-900 dark:text-white">Individual Testing Tracker</summary>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <IndividualTestingGrid labDayId={labDayId} isNremtTesting refreshMs={15000} />
                </div>
              </details>
            )}

            </>)}

            {canManage && (
              <div className="flex flex-wrap gap-3">
                <Link href={`/labs/schedule/${labDayId}/coordinator`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Coordinator View (previous)
                </Link>
                <Link href={`/labs/schedule/${labDayId}`} className="inline-flex items-center min-h-[44px] px-4 rounded-lg bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Lab day page (previous)
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
                allNumbers={[...data.groups.flatMap((g) => g.stations), ...(data.spares || [])].map((st) => st.station_number)}
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
