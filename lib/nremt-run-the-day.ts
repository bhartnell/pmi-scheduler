// Run-the-day helpers for the NREMT hub (card 4225cd1c). Pure functions, no I/O.
// Migrated from the Coordinator View (app/labs/schedule/[id]/coordinator): station state,
// who is testing where, the eligible list and top suggestion, closed/break stations left out
// of routing. ONE intended difference: eligibility and suggestion are by SKILL, not by
// station. A day can run several stations for one skill (Nov 25: 14 stations, 7 skills), and
// the Coordinator View's per-station list would offer a student who already passed Medical at
// "Medical 1" for "Medical 2". The Coordinator View itself is left as it is.
//
// Input shapes are the student-queue API response.

import { shortSkillLabel } from './nremt-skill-labels.ts';
import { buildStationPairs, pairCodeFor, pairNeed, firstPart, needsLabel, inPairGap, PAIR_TITLE, type PairNeed } from './nremt-pairs.ts';

export interface RtdStudent {
  id: string;
  first_name: string;
  last_name: string;
}
export interface RtdStation {
  id: string;
  station_number: number;
  custom_title?: string | null;
  skill_name?: string | null;
  skillSheetId?: string | null;
  instructorName?: string | null;
  /** Proctor for the hub: station_instructors name, else the station's own text (API proctorName). */
  proctorName?: string | null;
  /** Free-text room on the station (lab_stations.room). */
  room?: string | null;
  stationSuffix?: string | null;
  coordinatorStatus?: 'open' | 'closed' | 'break';
  isRetakeStation?: boolean;
}
export interface RtdCell {
  queueId?: string | null;
  status: string;
  result?: string | null;
  /** When the queue row was created (en route = status 'queued'). ISO string. */
  queuedAt?: string | null;
  /** When the proctor first started grading (queue row started_at). */
  startedAt?: string | null;
  /** When the proctor finished (queue row completed_at); null when unknown. */
  completedAt?: string | null;
  evalSummary?: { evaluatorName: string | null } | null;
}
export interface RtdSkillColumn {
  skillName: string;
  stationIds: string[];
  skillSheetId?: string | null;
  nremtCode?: string | null;
}
export interface RtdInput {
  students: RtdStudent[];
  stations: RtdStation[];
  cells: Record<string, RtdCell>;
  skillColumns: RtdSkillColumn[];
  skillCells: Record<string, RtdCell>;
}

export function studentName(s: RtdStudent): string {
  return `${s.first_name} ${s.last_name}`.trim();
}

/** The skill column a station belongs to, or null when the day has no skill columns for it. */
export function skillForStation(stationId: string, skillColumns: RtdSkillColumn[]): RtdSkillColumn | null {
  return skillColumns.find((c) => c.stationIds.includes(stationId)) || null;
}

/** A station takes part in routing only when it is open (closed and on-break stations are left out). */
export function isRoutable(station: RtdStation): boolean {
  const st = station.coordinatorStatus || 'open';
  return st === 'open';
}

/** Student currently graded (in progress) at this station, or null. */
export function studentAtStation(station: RtdStation, input: RtdInput): RtdStudent | null {
  for (const s of input.students) {
    if (input.cells[`${s.id}_${station.id}`]?.status === 'in_progress') return s;
  }
  return null;
}

export interface EnRoute {
  student: RtdStudent;
  station: RtdStation;
  queueId: string | null;
  sentAt: string | null;
}

/**
 * Students sent to a station and waiting for the proctor to start. Saved as a queue row with
 * status 'queued'; it leaves this list on its own once the cell turns in_progress / completed.
 * Skipped for a student who already has a final or in-progress mark at that station.
 */
export function enRouteList(input: RtdInput): EnRoute[] {
  const out: EnRoute[] = [];
  for (const st of input.stations) {
    for (const s of input.students) {
      // In progress at ANY station: no longer en route anywhere (they walked to another station).
      if (input.stations.some((o) => input.cells[`${s.id}_${o.id}`]?.status === 'in_progress')) continue;
      const cell = input.cells[`${s.id}_${st.id}`];
      if (cell?.status === 'queued') {
        out.push({ student: s, station: st, queueId: cell.queueId || null, sentAt: cell.queuedAt || null });
      }
    }
  }
  return out;
}

/** Stations nobody is in: routable, nobody in progress, nobody en route. */
export function freeStations(input: RtdInput): RtdStation[] {
  const busyEnRoute = new Set(enRouteList(input).map((e) => e.station.id));
  return input.stations.filter(
    (st) => isRoutable(st) && !studentAtStation(st, input) && !busyEnRoute.has(st.id)
  );
}

/** Stations someone is in right now, with the student. Closed/break stations are not listed here. */
export function testingNow(input: RtdInput): { station: RtdStation; student: RtdStudent; startedAt: string | null }[] {
  const out: { station: RtdStation; student: RtdStudent; startedAt: string | null }[] = [];
  for (const st of input.stations) {
    const s = studentAtStation(st, input);
    if (s) out.push({ station: st, student: s, startedAt: input.cells[`${s.id}_${st.id}`]?.startedAt || null });
  }
  return out;
}

export interface Candidate {
  student: RtdStudent;
  skillName: string | null;
  /** NREMT code of the skill when known, for the short label. */
  nremtCode?: string | null;
  isRetake: boolean;
  firstAttemptBy: string | null;
  doneCount: number;
  totalSkills: number;
  /** Same person graded the first attempt and proctors this station. */
  sameProctorAsFirstAttempt: boolean;
}

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Skills this student has passed or finished (completed skill cell). */
function doneSkillCount(student: RtdStudent, input: RtdInput): number {
  let n = 0;
  for (const col of input.skillColumns) {
    const c = input.skillCells[`${student.id}_${col.skillName}`];
    if (c?.status === 'completed' && c.result === 'pass') n++;
  }
  return n;
}

/**
 * Students who can be sent to this station, in suggestion order. BY SKILL:
 * - not testing at any station and not en route anywhere;
 * - has not passed this station's skill (a failed skill stays eligible: retake);
 * - not testing or en route for this skill at ANY station of the skill.
 * Order: a retake station prefers retake students, then fewest skills done first (the
 * Coordinator View's order), then name. A retake whose first-attempt proctor is this
 * station's proctor goes last while another eligible student exists (a warning, not a block).
 */
export function candidatesForStation(station: RtdStation, input: RtdInput): Candidate[] {
  const col = skillForStation(station.id, input.skillColumns);
  const enRoute = enRouteList(input);
  const out: Candidate[] = [];
  for (const s of input.students) {
    // Testing at any station.
    const testingAnywhere = input.stations.some((st) => input.cells[`${s.id}_${st.id}`]?.status === 'in_progress');
    if (testingAnywhere) continue;
    // En route anywhere (this station included: it is not free then, but keep the rule explicit).
    if (enRoute.some((e) => e.student.id === s.id)) continue;

    let isRetake = false;
    let firstAttemptBy: string | null = null;
    if (col) {
      const sc = input.skillCells[`${s.id}_${col.skillName}`];
      if (sc?.status === 'completed' && sc.result === 'pass') continue; // passed this skill
      if (sc?.status === 'completed' && sc.result === 'fail') {
        isRetake = true;
        firstAttemptBy = sc.evalSummary?.evaluatorName || null;
      }
    } else {
      // No skill column for this station: fall back to the station's own cell.
      const c = input.cells[`${s.id}_${station.id}`];
      if (c?.status === 'completed' && c.result !== 'fail') continue;
      if (c?.status === 'completed' && c.result === 'fail') isRetake = true;
    }
    out.push({
      student: s,
      skillName: col?.skillName || null,
      nremtCode: col?.nremtCode || null,
      isRetake,
      firstAttemptBy,
      doneCount: doneSkillCount(s, input),
      totalSkills: input.skillColumns.length,
      sameProctorAsFirstAttempt: isRetake && sameName(firstAttemptBy, station.proctorName ?? station.instructorName),
    });
  }
  out.sort((a, b) => {
    if (a.sameProctorAsFirstAttempt !== b.sameProctorAsFirstAttempt) return a.sameProctorAsFirstAttempt ? 1 : -1;
    if (station.isRetakeStation && a.isRetake !== b.isRetake) return a.isRetake ? -1 : 1;
    if (a.doneCount !== b.doneCount) return a.doneCount - b.doneCount;
    return studentName(a.student).localeCompare(studentName(b.student));
  });
  return out;
}

/** One plain line of why this student is suggested. */
export function whyLine(c: Candidate): string {
  if (c.isRetake) {
    return c.firstAttemptBy ? `Retake - first attempt graded by ${c.firstAttemptBy}` : 'Retake';
  }
  if (c.totalSkills > 0 && c.skillName) {
    return `${c.doneCount} of ${c.totalSkills} done - has not done ${shortSkillLabel(c.skillName, c.nremtCode)}`;
  }
  return `${c.doneCount} done`;
}

/** Minutes since an ISO time, never negative; null when there is no time. */
export function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 60000));
}

/**
 * Spread suggestions across the free stations (fix 2). Walk the free stations in order; each gets
 * its best candidate who is not already the suggestion on an earlier card. A station with nobody
 * left gets null (the card says "Nobody waiting for this skill"). The full eligible list per
 * station is unchanged and still feeds "Someone else".
 */
export function spreadSuggestions(
  free: RtdStation[],
  input: RtdInput
): { station: RtdStation; list: Candidate[]; top: Candidate | null }[] {
  const taken = new Set<string>();
  return free.map((station) => {
    const list = candidatesForStation(station, input);
    const top = list.find((c) => !taken.has(c.student.id)) || null;
    if (top) taken.add(top.student.id);
    return { station, list, top };
  });
}


// ---------------------------------------------------------------------------------------------
// The two-part BVM + O2 by NRB station is ONE station on the hub (card 4225cd1c, 2026-11-24).
// ---------------------------------------------------------------------------------------------

export type RtdUnit =
  | { kind: 'single'; key: string; station: RtdStation }
  | { kind: 'pair'; key: string; o2: RtdStation; bvm: RtdStation };

export function unitStations(u: RtdUnit): RtdStation[] {
  return u.kind === 'single' ? [u.station] : [u.o2, u.bvm];
}

function pairItems(input: RtdInput) {
  return input.stations.map((st) => ({
    id: st.id,
    station_number: st.station_number,
    code: pairCodeFor(skillForStation(st.id, input.skillColumns)?.nremtCode, st.skill_name),
    proctor: st.proctorName ?? st.instructorName ?? null,
    room: st.room ?? null,
  }));
}

/** Stations of the day grouped into units: each BVM + O2 pair is one unit, everything else is single. */
export function dayUnits(input: RtdInput): RtdUnit[] {
  const byId = new Map(input.stations.map((s) => [s.id, s]));
  const pairs = buildStationPairs(pairItems(input));
  const paired = new Set<string>();
  const units: RtdUnit[] = [];
  for (const p of pairs) {
    paired.add(p.o2.id);
    paired.add(p.bvm.id);
    units.push({ kind: 'pair', key: `pair-${p.o2.id}`, o2: byId.get(p.o2.id)!, bvm: byId.get(p.bvm.id)! });
  }
  for (const st of input.stations) if (!paired.has(st.id)) units.push({ kind: 'single', key: st.id, station: st });
  const first = (u: RtdUnit) => Math.min(...unitStations(u).map((s) => s.station_number));
  return units.sort((a, b) => first(a) - first(b));
}

export function unitTitle(u: RtdUnit, nameOf: (s: RtdStation) => string): string {
  return u.kind === 'pair' ? PAIR_TITLE : nameOf(u.station);
}

function passedAt(student: RtdStudent, st: RtdStation, input: RtdInput): boolean {
  const col = skillForStation(st.id, input.skillColumns);
  if (col) {
    const c = input.skillCells[`${student.id}_${col.skillName}`];
    return c?.status === 'completed' && c.result === 'pass';
  }
  const c = input.cells[`${student.id}_${st.id}`];
  return c?.status === 'completed' && c.result === 'pass';
}

export function needOf(student: RtdStudent, pair: { o2: RtdStation; bvm: RtdStation }, input: RtdInput): PairNeed {
  return pairNeed(passedAt(student, pair.o2, input), passedAt(student, pair.bvm, input));
}

function busyAnywhere(student: RtdStudent, input: RtdInput): boolean {
  return input.stations.some((st) => {
    const s = input.cells[`${student.id}_${st.id}`]?.status;
    return s === 'in_progress' || s === 'queued';
  });
}

export interface UnitCandidate {
  student: RtdStudent;
  /** Station the Send button routes to (for a pair: the first part the student owes). */
  stationId: string;
  why: string;
  warn: string | null;
}

/** For a single station: the existing eligibility, shaped for the unit card. */
function singleCandidates(station: RtdStation, input: RtdInput): UnitCandidate[] {
  return candidatesForStation(station, input).map((c) => ({
    student: c.student,
    stationId: station.id,
    why: whyLine(c),
    warn: c.sameProctorAsFirstAttempt ? 'This proctor graded the first attempt' : null,
  }));
}

/** For a pair: anyone not testing or en route who has not passed O2 by NRB, or has not passed BVM. */
export function pairCandidates(pair: { o2: RtdStation; bvm: RtdStation }, input: RtdInput): UnitCandidate[] {
  const out: (UnitCandidate & { done: number })[] = [];
  for (const s of input.students) {
    if (busyAnywhere(s, input)) continue;
    const need = needOf(s, pair, input);
    const part = firstPart(need);
    if (!part) continue;
    out.push({ student: s, stationId: part === 'o2' ? pair.o2.id : pair.bvm.id, why: needsLabel(need), warn: null, done: doneSkillCount(s, input) });
  }
  out.sort((a, b) => a.done - b.done || studentName(a.student).localeCompare(studentName(b.student)));
  return out.map((c) => ({ student: c.student, stationId: c.stationId, why: c.why, warn: c.warn }));
}

export interface PairGap {
  student: RtdStudent;
  finished: 'o2' | 'bvm';
  stationId: string;
}

/**
 * Between finishing one part and starting the other the proctor reads the next instructions: for
 * 5 minutes after a student completes one part at this pair while still needing the other, the card
 * reads "finished X, Y next" instead of offering Send. No hard lock (the screen can clear it).
 */
export function pairGap(pair: { o2: RtdStation; bvm: RtdStation }, input: RtdInput, now: number): PairGap | null {
  for (const s of input.students) {
    if (busyAnywhere(s, input)) continue;
    for (const [which, st, other] of [['o2', pair.o2, pair.bvm], ['bvm', pair.bvm, pair.o2]] as const) {
      const c = input.cells[`${s.id}_${st.id}`];
      if (c?.status === 'completed' && inPairGap(c.completedAt, now) && !passedAt(s, other, input)) {
        return { student: s, finished: which, stationId: st.id };
      }
    }
  }
  return null;
}

export const gapKey = (g: PairGap, pairKey: string) => `${pairKey}:${g.student.id}:${g.finished}`;

/** A unit is free when all its stations are open and nobody is in or heading to any of them. */
export function freeUnits(input: RtdInput): RtdUnit[] {
  const busy = new Set(enRouteList(input).map((e) => e.station.id));
  return dayUnits(input).filter((u) =>
    unitStations(u).every((st) => isRoutable(st) && !studentAtStation(st, input) && !busy.has(st.id))
  );
}

/** Free units with the pair gap applied (a unit in its gap is not free unless dismissed on this screen). */
export function freeUnitsNow(input: RtdInput, now: number, dismissed: Set<string>): { units: RtdUnit[]; gaps: Map<string, PairGap> } {
  const gaps = new Map<string, PairGap>();
  const units = freeUnits(input).filter((u) => {
    if (u.kind !== 'pair') return true;
    const g = pairGap(u, input, now);
    if (g && !dismissed.has(gapKey(g, u.key))) {
      gaps.set(u.key, g);
      return false;
    }
    return true;
  });
  return { units, gaps };
}

/** Spread suggestions over units: each gets its best candidate not already suggested on an earlier card. */
export function spreadUnitSuggestions(units: RtdUnit[], input: RtdInput): { unit: RtdUnit; list: UnitCandidate[]; top: UnitCandidate | null }[] {
  const taken = new Set<string>();
  return units.map((unit) => {
    const list = unit.kind === 'pair' ? pairCandidates(unit, input) : singleCandidates(unit.station, input);
    const top = list.find((c) => !taken.has(c.student.id)) || null;
    if (top) taken.add(top.student.id);
    return { unit, list, top };
  });
}

/** Counts for the overview: a pair is one station. */
export function unitCounts(input: RtdInput, now: number, dismissed: Set<string>): { free: number; total: number } {
  return { free: freeUnitsNow(input, now, dismissed).units.length, total: dayUnits(input).length };
}


// ---------------------------------------------------------------------------------------------
// The hub's table cell menu (card 4225cd1c, 2026-11-24). One small menu per cell of the
// completion table: where the cell stands, and the open stations to send the student to. Pure; the
// table component renders it and the Run the day tab supplies the writes (same ones the cards use).
// ---------------------------------------------------------------------------------------------

export type CellMenuState = 'not_started' | 'en_route' | 'in_progress' | 'pass' | 'fail' | 'done';

export interface SendOption {
  /** Station the Send writes to (for the BVM + O2 pair: the first part the student owes). */
  stationId: string;
  /** Station name, or "BVM + O2 by NRB" once for the pair. */
  title: string;
  proctor: string | null;
  room: string | null;
  /** Student currently at, or heading to, this station; the option is shown greyed. */
  busyWith: string | null;
  /** Retake only: the first attempt's proctor is this station's proctor. */
  sameProctorAsFirstAttempt: boolean;
}

export interface CellMenu {
  state: CellMenuState;
  studentName: string;
  skillName: string;
  /** Skills passed / skills on the day. */
  progress: { done: number; total: number };
  /** Station the cell is at (en route or in progress), when it can be told. */
  at: { stationId: string; title: string; proctor: string | null; minutes: number | null } | null;
  queueId: string | null;
  evaluationId: string | null;
  /** The student is already en route or being graded somewhere else, so nothing is offered to send. */
  busyElsewhere: { title: string; kind: 'en_route' | 'in_progress' } | null;
  /** Fail only: first attempt's evaluator, for the retake line. */
  firstAttemptBy: string | null;
  /** Open stations for this skill (closed and on-break are left out). Pair appears once. */
  options: SendOption[];
}

function nameOfStation(s: RtdStation): string {
  return s.custom_title || s.skill_name || `Station ${s.station_number}`;
}

/** Everything the cell menu shows for one student and skill column. */
export function cellMenuFor(student: RtdStudent, skillName: string, input: RtdInput, now: number): CellMenu {
  const col = input.skillColumns.find((c) => c.skillName === skillName) || null;
  const cell = input.skillCells[`${student.id}_${skillName}`] || null;
  const units = dayUnits(input);
  const unitOf = new Map<string, RtdUnit>();
  for (const u of units) for (const st of unitStations(u)) unitOf.set(st.id, u);
  const titleOf = (st: RtdStation) => {
    const u = unitOf.get(st.id);
    return u ? unitTitle(u, nameOfStation) : nameOfStation(st);
  };
  const proctorOf = (st: RtdStation) => st.proctorName ?? st.instructorName ?? null;

  let state: CellMenuState = 'not_started';
  if (cell?.status === 'queued') state = 'en_route';
  else if (cell?.status === 'in_progress') state = 'in_progress';
  else if (cell?.status === 'completed') state = cell.result === 'pass' ? 'pass' : cell.result === 'fail' ? 'fail' : 'done';

  // Where this cell's queue row sits: a station of this skill with the matching state.
  let at: CellMenu['at'] = null;
  if ((state === 'en_route' || state === 'in_progress') && col) {
    const want = state === 'en_route' ? 'queued' : 'in_progress';
    for (const sid of col.stationIds) {
      const sc = input.cells[`${student.id}_${sid}`];
      const st = input.stations.find((x) => x.id === sid);
      if (sc?.status === want && st) {
        at = {
          stationId: st.id,
          title: titleOf(st),
          proctor: proctorOf(st),
          minutes: minutesSince(want === 'queued' ? sc.queuedAt : sc.startedAt, now),
        };
        break;
      }
    }
  }

  // Already en route / testing anywhere (any skill).
  let busyElsewhere: CellMenu['busyElsewhere'] = null;
  for (const st of input.stations) {
    const s = input.cells[`${student.id}_${st.id}`]?.status;
    if (s === 'in_progress' || s === 'queued') {
      busyElsewhere = { title: titleOf(st), kind: s === 'queued' ? 'en_route' : 'in_progress' };
      if (s === 'in_progress') break;
    }
  }

  // Busy stations: someone in progress or en route there.
  const busyBy = new Map<string, string>();
  for (const st of input.stations) {
    const at2 = studentAtStation(st, input);
    if (at2) busyBy.set(st.id, studentName(at2));
  }
  for (const e of enRouteList(input)) if (!busyBy.has(e.station.id)) busyBy.set(e.station.id, studentName(e.student));

  const firstAttemptBy = state === 'fail' ? cell?.evalSummary?.evaluatorName || null : null;

  const options: SendOption[] = [];
  if (col && (state === 'not_started' || state === 'fail')) {
    const seen = new Set<string>();
    for (const sid of col.stationIds) {
      const u = unitOf.get(sid);
      if (!u || seen.has(u.key)) continue;
      seen.add(u.key);
      const parts = unitStations(u);
      if (!parts.every(isRoutable)) continue; // closed or on break: not listed
      let target: RtdStation;
      if (u.kind === 'pair') {
        const part = firstPart(needOf(student, u, input));
        if (!part) continue; // passed both parts
        target = part === 'o2' ? u.o2 : u.bvm;
      } else {
        target = u.station;
      }
      const busy = parts.map((p) => busyBy.get(p.id)).find(Boolean) || null;
      options.push({
        stationId: target.id,
        title: unitTitle(u, nameOfStation),
        proctor: proctorOf(target),
        room: target.room ?? null,
        busyWith: busy,
        sameProctorAsFirstAttempt: state === 'fail' && sameName(firstAttemptBy, proctorOf(target)),
      });
    }
    options.sort((a, b) => {
      const na = input.stations.find((s) => s.id === a.stationId)?.station_number ?? 0;
      const nb = input.stations.find((s) => s.id === b.stationId)?.station_number ?? 0;
      return na - nb;
    });
  }

  return {
    state,
    studentName: studentName(student),
    skillName,
    progress: { done: doneSkillCount(student, input), total: input.skillColumns.length },
    at,
    queueId: (at ? input.cells[`${student.id}_${at.stationId}`]?.queueId : null) ?? cell?.queueId ?? null,
    evaluationId: (cell as (RtdCell & { evaluationId?: string | null }) | null)?.evaluationId ?? null,
    busyElsewhere,
    firstAttemptBy,
    options,
  };
}
