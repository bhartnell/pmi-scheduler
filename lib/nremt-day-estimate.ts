// Estimated finish for the NREMT hub "Run the day" tab (card 4225cd1c, 2026-11-24).
// Pure function, no I/O, no writes. Input = the RtdInput the tab already holds.
//
// Each skill is a line of students waiting for that skill's open stations; the BVM + O2 by NRB
// pair is ONE line. The day ends when the slowest line ends, or when the busiest single student
// runs out of visits (STUDENT FLOOR), whichever is larger. It is an estimate: rounded to 5
// minutes, shown as "about". No queueing simulation.
//
// "Testing left" only steps down when a student PASSES (a Fail while a retake is allowed still
// counts as left, same as the table's cell menu which always offers a retake send).

import { findInstructionEntryByCode } from './nremt-instructions.ts';
import { PAIR_TITLE, pairCodeFor } from './nremt-pairs.ts';
import { shortSkillLabel } from './nremt-skill-labels.ts';
import { isCountedOpen, isRoutable, minutesSince, skillForStation, type RtdInput, type RtdStation, type RtdStudent } from './nremt-run-the-day.ts';

/** Walk from the classroom, brief, questions and set-up, per visit. */
export const WALK_BRIEF_MIN = 5;
/** One break per line (two stations of a skill break at different times, the line keeps moving). */
export const BREAK_MIN = 30;
/** Finished attempts today needed before today's own average replaces the typical figure. */
export const MIN_SAMPLE = 3;
/** Durations outside this range (minutes) are ignored when working out today's pace. */
export const PACE_MIN_VALID = 1;
export const PACE_MAX_VALID = 45;
/** Display rounding. */
export const ROUND_MIN = 5;
/** Typical minutes AT the station per visit (no walk time). medians from the 2026-04-15 and 2026-08-05 NREMT days; replace with a live query of past NREMT days after Nov 25 */
export const TYPICAL_MIN: Record<string, number> = {
  E202: 12, // Medical
  E201: 13, // Trauma
  E215: 6, // Cardiac arrest / AED
  E212: 7, // Supine spinal
  E203: 4, // BVM
  E204: 2.5, // O2 by NRB
  E213: 3, // Bleeding / shock
};

export type EstimateSource = 'pace' | 'past' | 'limits';

export interface EstimateLine {
  key: string;
  title: string;
  isPair: boolean;
  stationIds: string[];
  /** Students who still owe this skill (a pair: either part). */
  left: number;
  /** Of those, how many are owed as a retake (failed once). */
  retests: number;
  /** Stations of this line open right now (a pair counts once, both parts open). */
  open: number;
  /** Minutes the line needs, no break. null = no open station, or no time known. */
  minutes: number | null;
  /** Same with the break added (only when something is left). */
  minutesWithBreak: number | null;
  perVisit: number | null;
  source: EstimateSource | null;
  noTime: boolean;
}

export interface DayEstimate {
  lines: EstimateLine[];
  /** Minutes of testing left (steps down on a Pass). null when nothing is known / no open station. */
  testingLeftMin: number | null;
  /** Rounded finish time (ms) or null. */
  finishMs: number | null;
  /** True when counted from the day's start time (it has not started yet). */
  fromStart: boolean;
  allDone: boolean;
  source: EstimateSource | null;
  /** "slowest: Medical (16 left, 1 station)" or "waiting on: ..." */
  settingBy: string | null;
  floorSetsDay: boolean;
  /** "a second Medical station would bring this to about 2:34 PM" or null. */
  secondStationHint: string | null;
  /** "Bleeding is done - Casey is free. Longest line now: Trauma (9 left)". */
  doneHints: string[];
  /** Lines with students left but no open station. */
  noOpenLines: string[];
}

export interface EstimateOptions {
  now: number;
  /** Day start (ms) when known. */
  startMs?: number | null;
  includeBreak: boolean;
}

export function roundUp5(min: number): number {
  return Math.ceil(min / ROUND_MIN - 1e-9) * ROUND_MIN;
}

/** "about 5 h 50 min" / "about 45 min". */
export function formatAbout(min: number): string {
  const r = Math.max(0, Math.round(min / ROUND_MIN) * ROUND_MIN);
  const h = Math.floor(r / 60);
  const m = r % 60;
  if (h === 0) return `about ${m} min`;
  if (m === 0) return `about ${h} h`;
  return `about ${h} h ${m} min`;
}

const PACIFIC = 'America/Los_Angeles';
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: PACIFIC });
}

function roundMsTo5(ms: number): number {
  const step = ROUND_MIN * 60000;
  return Math.round(ms / step) * step;
}

interface Part {
  code: string | null;
  columnSkill: string;
  stationIds: string[];
}

function passed(student: RtdStudent, skillName: string, input: RtdInput): boolean {
  const c = input.skillCells[`${student.id}_${skillName}`];
  return c?.status === 'completed' && c.result === 'pass';
}
function failed(student: RtdStudent, skillName: string, input: RtdInput): boolean {
  const c = input.skillCells[`${student.id}_${skillName}`];
  return c?.status === 'completed' && c.result === 'fail';
}

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Minutes at the station for one part: today's average, else typical, else limit + prep. null = unknown. */
function partMinutes(part: Part, input: RtdInput): { min: number; source: EstimateSource } | null {
  const durations: number[] = [];
  for (const sid of part.stationIds) {
    for (const s of input.students) {
      const c = input.cells[`${s.id}_${sid}`];
      if (c?.status !== 'completed' || !c.startedAt || !c.completedAt) continue;
      const d = (Date.parse(c.completedAt) - Date.parse(c.startedAt)) / 60000;
      // One grade left open over lunch must not throw the pace: ignore under 1 or over 45 minutes.
      if (Number.isFinite(d) && d >= PACE_MIN_VALID && d <= PACE_MAX_VALID) durations.push(d);
    }
  }
  if (durations.length >= MIN_SAMPLE) {
    return { min: median(durations), source: 'pace' };
  }
  const code = (part.code || '').trim().toUpperCase();
  if (code && TYPICAL_MIN[code] !== undefined) return { min: TYPICAL_MIN[code], source: 'past' };
  const entry = findInstructionEntryByCode(code);
  if (entry) {
    const ci = entry.candidateInstruction as { prepDurationSeconds?: number };
    const prep = ci.prepDurationSeconds ? ci.prepDurationSeconds / 60 : 0;
    return { min: entry.timeLimitMinutes + prep, source: 'limits' };
  }
  return null;
}

interface LineDef {
  key: string;
  title: string;
  isPair: boolean;
  parts: Part[];
  stationIds: string[];
}

function shortTitle(col: { skillName: string; nremtCode?: string | null }): string {
  return shortSkillLabel(col.skillName, col.nremtCode);
}

function buildLineDefs(input: RtdInput): LineDef[] {
  const defs: LineDef[] = [];
  const pairParts: Part[] = [];
  for (const col of input.skillColumns) {
    if (col.stationIds.length === 0) continue;
    const pc = pairCodeFor(col.nremtCode, col.skillName);
    const part: Part = { code: col.nremtCode || null, columnSkill: col.skillName, stationIds: col.stationIds };
    if (pc) {
      pairParts.push({ ...part, code: pc });
      continue;
    }
    defs.push({ key: col.skillName, title: shortTitle(col), isPair: false, parts: [part], stationIds: col.stationIds });
  }
  if (pairParts.length > 0) {
    defs.push({
      key: 'pair',
      title: PAIR_TITLE,
      isPair: true,
      parts: pairParts,
      stationIds: pairParts.flatMap((p) => p.stationIds),
    });
  }
  return defs;
}

export function estimateDay(input: RtdInput, opts: EstimateOptions): DayEstimate {
  const defs = buildLineDefs(input);
  const stationById = new Map(input.stations.map((s) => [s.id, s]));

  // Per-part minutes once (pace is per part).
  const partMin = new Map<string, { min: number; source: EstimateSource } | null>();
  for (const d of defs) for (const p of d.parts) partMin.set(`${d.key}|${p.columnSkill}`, partMinutes(p, input));

  // Visits each student still owes: lineKey -> minutes for this student (incl. walk).
  const owed = new Map<string, Map<string, number>>(); // studentId -> lineKey -> minutes
  const lines: EstimateLine[] = [];
  const sources = new Set<EstimateSource>();

  for (const d of defs) {
    let left = 0;
    let retests = 0;
    let totalMin = 0;
    let noTime = false;
    const src = new Set<EstimateSource>();
    for (const s of input.students) {
      let studentMin = 0;
      let owes = false;
      let hasFail = false;
      for (const p of d.parts) {
        if (passed(s, p.columnSkill, input)) continue;
        owes = true;
        if (failed(s, p.columnSkill, input)) hasFail = true;
        const pm = partMin.get(`${d.key}|${p.columnSkill}`);
        if (!pm) noTime = true;
        else {
          studentMin += pm.min;
          src.add(pm.source);
        }
      }
      if (!owes) continue;
      left++;
      if (hasFail) retests++;
      studentMin += WALK_BRIEF_MIN;
      totalMin += studentMin;
      const m = owed.get(s.id) ?? new Map<string, number>();
      m.set(d.key, studentMin);
      owed.set(s.id, m);
    }
    // Open stations of this line (a pair counts once, only when both parts are open).
    let open: number;
    if (d.isPair) {
      const o2 = d.parts.find((p) => p.code === 'E204');
      const bvm = d.parts.find((p) => p.code === 'E203');
      const o2Open = (o2?.stationIds || []).map((id) => stationById.get(id)).filter((s): s is RtdStation => !!s && isCountedOpen(s)).length;
      const bvmOpen = (bvm?.stationIds || []).map((id) => stationById.get(id)).filter((s): s is RtdStation => !!s && isCountedOpen(s)).length;
      open = Math.min(o2Open, bvmOpen);
    } else {
      open = d.stationIds.map((id) => stationById.get(id)).filter((s): s is RtdStation => !!s && isCountedOpen(s)).length;
    }
    const perVisit = left > 0 ? totalMin / left : null;
    const known = !noTime && left > 0 && open > 0;
    const minutes = known ? totalMin / open : null;
    const lineSource: EstimateSource | null = src.has('pace') ? 'pace' : src.has('past') ? 'past' : src.has('limits') ? 'limits' : null;
    if (lineSource && left > 0) sources.add(lineSource);
    lines.push({
      key: d.key,
      title: d.title,
      isPair: d.isPair,
      stationIds: d.stationIds,
      left,
      retests,
      open,
      minutes,
      minutesWithBreak: minutes === null ? null : minutes + BREAK_MIN,
      perVisit,
      source: lineSource,
      noTime: left > 0 && noTime,
    });
  }

  const figure = (l: EstimateLine) => (opts.includeBreak ? l.minutesWithBreak : l.minutes);
  const active = lines.filter((l) => l.left > 0);
  const allDone = active.length === 0 && input.students.length > 0;
  const noOpenLines = active.filter((l) => l.open === 0).map((l) => l.title);

  // Slowest line and student floor.
  let slowest: EstimateLine | null = null;
  for (const l of active) {
    const f = figure(l);
    if (f === null) continue;
    if (!slowest || f > (figure(slowest) as number)) slowest = l;
  }
  const slowestMin = slowest ? (figure(slowest) as number) : 0;

  let floorMin = 0;
  const floors: { id: string; min: number; n: number }[] = [];
  for (const [id, m] of owed) {
    let tot = 0;
    for (const v of m.values()) tot += v;
    floors.push({ id, min: tot, n: m.size });
    if (tot > floorMin) floorMin = tot;
  }
  const floorSetsDay = floorMin > slowestMin;
  let settingBy: string | null = null;
  if (floorSetsDay) {
    const near = floors.filter((f) => f.min >= floorMin - 10);
    const top = floors.find((f) => f.min === floorMin)!;
    settingBy = `waiting on: ${near.length} student${near.length === 1 ? '' : 's'} who ${near.length === 1 ? 'still owes' : 'each still owe'} ${top.n} skill${top.n === 1 ? '' : 's'}`;
  } else if (slowest) {
    settingBy = `slowest: ${slowest.title} (${slowest.left} left, ${slowest.open} station${slowest.open === 1 ? '' : 's'})`;
  }

  // Testing left (steps down on a Pass). null when no figure is known.
  const anyKnown = slowest !== null || floorMin > 0;
  const testingLeftMin = allDone || !anyKnown ? null : Math.max(slowestMin, floorMin);

  // Finish: now + testing left, minus credit for students in progress on the line that sets the day.
  const startMs = opts.startMs ?? null;
  const fromStart = startMs !== null && opts.now < startMs;
  const baseMs = fromStart ? (startMs as number) : opts.now;
  let credit = 0;
  if (!floorSetsDay && slowest && !fromStart) {
    for (const s of input.students) {
      for (const sid of slowest.stationIds) {
        const c = input.cells[`${s.id}_${sid}`];
        if (c?.status !== 'in_progress') continue;
        const since = minutesSince(c.startedAt, opts.now);
        if (since === null) continue;
        credit += Math.min(since, slowest.perVisit ?? 0) / Math.max(1, slowest.open);
      }
    }
  }
  const finishMs = testingLeftMin === null ? null : roundMsTo5(baseMs + Math.max(0, testingLeftMin - credit) * 60000);

  // Second-station hint: slowest line more than 45 min longer than the next, one open station.
  let secondStationHint: string | null = null;
  if (slowest && !floorSetsDay && slowest.open === 1 && finishMs !== null && slowest.minutes !== null) {
    const others = active.filter((l) => l !== slowest).map(figure).filter((x): x is number => x !== null);
    const next = others.length ? Math.max(...others) : 0;
    if (slowestMin - next > 45) {
      const total = slowest.minutes; // one open station: whole line
      const withTwo = total / 2 + (opts.includeBreak ? BREAK_MIN : 0);
      const dayMin = Math.max(withTwo, next, floorMin);
      secondStationHint = `a second ${slowest.title} station would bring this to ${formatClock(roundMsTo5(baseMs + dayMin * 60000))}`;
    }
  }

  // A line that is done while its station is still open: that proctor is free.
  const doneHints: string[] = [];
  const longest = [...active].sort((a, b) => (figure(b) ?? -1) - (figure(a) ?? -1))[0];
  for (const l of lines) {
    if (l.left > 0 || l.stationIds.length === 0) continue;
    const st = l.stationIds.map((id) => stationById.get(id)).find((s): s is RtdStation => !!s && isRoutable(s));
    if (!st || !longest) continue;
    const who = st.proctorName || st.instructorName;
    doneHints.push(`${l.title} is done - ${who ? who : 'its proctor'} is free. Longest line now: ${longest.title} (${longest.left} left)`);
  }

  const source: EstimateSource | null = sources.has('pace') ? 'pace' : sources.has('past') ? 'past' : sources.has('limits') ? 'limits' : null;

  return { lines, testingLeftMin, finishMs, fromStart, allDone, source, settingBy, floorSetsDay, secondStationHint, doneHints, noOpenLines };
}

export function sourceLabel(s: EstimateSource | null): string {
  if (s === 'pace') return "from today's pace";
  if (s === 'past') return 'from past NREMT days';
  if (s === 'limits') return 'from time limits';
  return '';
}

/** The line for one station card, or null. */
export function lineForStation(est: DayEstimate, stationId: string): EstimateLine | null {
  return est.lines.find((l) => l.stationIds.includes(stationId)) || null;
}

/** "16 left - about 5 h 20 min (2 retests)" for a station card. */
export function cardLine(l: EstimateLine): string {
  const retest = l.retests > 0 ? ` (${l.retests} ${l.retests === 1 ? 'retest' : 'retests'})` : '';
  if (l.left === 0) return 'Nobody left for this skill';
  if (l.noTime) return `${l.left} left${retest}`;
  if (l.minutes === null) return `${l.left} left - no open station${retest}`;
  return `${l.left} left - ${formatAbout(l.minutes)}${retest}`;
}

// skillForStation is re-exported for callers that map a station to its column.
export { skillForStation };
