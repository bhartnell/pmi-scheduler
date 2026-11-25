// Retest visibility for the testing hub (student-queue route + grid).
//
// Pure functions, keyed by lab day + skill sheet only (nothing tied to a
// particular day or NREMT code). Read-only: no writes anywhere.
//
// A queue row is "in flight" for a retest when ALL of:
//   - it is the newest queue row for that student + station
//   - status is queued or in_progress
//   - its station is open (coordinator_status 'open')
//   - the student has at least one COMPLETED evaluation for the station's
//     skill sheet, none of them a pass
//   - it was created AFTER the student's latest completed evaluation of that sheet
// Anything else (stale rows at closed stations, older rows, skills already
// passed) is ignored exactly as before.

export interface RetestQueueRow {
  id: string;
  student_id: string;
  station_id: string;
  status: string;
  created_at?: string | null;
  evaluation_id?: string | null;
}

export interface RetestEval {
  id: string;
  student_id: string;
  skill_sheet_id: string | null;
  result: string | null;
  status: string;
  created_at?: string | null;
  attempt_number?: number | null;
}

export interface InFlightRetest {
  queueId: string;
  studentId: string;
  stationId: string;
  sheetId: string;
  status: 'queued' | 'in_progress';
  priorBest: 'fail';
}

export interface SkillAttemptInfo {
  attemptCount: number;
  retest: null | 'en_route' | 'in_progress';
  passedOnAttempt: number | null;
}

const ts = (v?: string | null): number => {
  const n = v ? Date.parse(v) : NaN;
  return Number.isNaN(n) ? 0 : n;
};

export function computeRetestState(args: {
  queueEntries: RetestQueueRow[];
  evaluations: RetestEval[];
  stationSkillMap: Record<string, string>;
  /** station id -> coordinator_status ('open' when unset) */
  stationStatus: Record<string, string>;
}): {
  inFlight: Record<string, InFlightRetest>; // key `${student}_${station}`
  skillInfo: Record<string, SkillAttemptInfo>; // key `${student}__${sheet}`
} {
  const { queueEntries, evaluations, stationSkillMap, stationStatus } = args;

  // Completed evaluations grouped by student + sheet, oldest first.
  const completed: Record<string, RetestEval[]> = {};
  for (const e of evaluations) {
    if (e.status !== 'complete' || !e.skill_sheet_id) continue;
    (completed[`${e.student_id}__${e.skill_sheet_id}`] ||= []).push(e);
  }
  for (const list of Object.values(completed)) {
    list.sort((a, b) => ts(a.created_at) - ts(b.created_at));
  }

  // Newest queue row per student + station.
  const newest: Record<string, RetestQueueRow> = {};
  for (const q of queueEntries) {
    const k = `${q.student_id}_${q.station_id}`;
    const cur = newest[k];
    if (!cur || ts(q.created_at) >= ts(cur.created_at)) newest[k] = q;
  }

  const inFlight: Record<string, InFlightRetest> = {};
  for (const [k, q] of Object.entries(newest)) {
    if (q.status !== 'queued' && q.status !== 'in_progress') continue;
    if ((stationStatus[q.station_id] || 'open') !== 'open') continue;
    const sheetId = stationSkillMap[q.station_id];
    if (!sheetId) continue;
    const prior = completed[`${q.student_id}__${sheetId}`];
    if (!prior || prior.length === 0) continue; // first attempt: unchanged
    if (prior.some((e) => e.result === 'pass')) continue; // already passed
    const latest = ts(prior[prior.length - 1].created_at);
    if (ts(q.created_at) <= latest) continue; // older than latest result
    inFlight[k] = {
      queueId: q.id,
      studentId: q.student_id,
      stationId: q.station_id,
      sheetId,
      status: q.status,
      priorBest: 'fail',
    };
  }

  const skillInfo: Record<string, SkillAttemptInfo> = {};
  for (const [k, list] of Object.entries(completed)) {
    const firstPassIdx = list.findIndex((e) => e.result === 'pass');
    const firstPass = firstPassIdx >= 0 ? list[firstPassIdx] : null;
    skillInfo[k] = {
      attemptCount: list.length,
      retest: null,
      passedOnAttempt: firstPass ? firstPass.attempt_number ?? firstPassIdx + 1 : null,
    };
  }
  for (const f of Object.values(inFlight)) {
    const info = skillInfo[`${f.studentId}__${f.sheetId}`];
    if (!info) continue;
    if (f.status === 'in_progress') info.retest = 'in_progress';
    else if (info.retest !== 'in_progress') info.retest = 'en_route';
  }
  return { inFlight, skillInfo };
}

const ordinal = (n: number): string =>
  n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

/** Label for a hub table cell, or null to keep today's wording. */
export function retestCellLabel(cell: {
  status?: string;
  result?: string | null;
  attemptCount?: number;
  retest?: null | 'en_route' | 'in_progress';
  passedOnAttempt?: number | null;
}): string | null {
  if (cell.status !== 'completed') return null;
  if (cell.result === 'fail') {
    if (cell.retest === 'in_progress') return 'Fail - retest in progress';
    if (cell.retest === 'en_route') return 'Fail - retest en route';
    if ((cell.attemptCount ?? 0) >= 2) return `Fail x${cell.attemptCount}`;
    return null;
  }
  if (cell.result === 'pass' && (cell.passedOnAttempt ?? 1) >= 2) {
    return `Pass - ${ordinal(cell.passedOnAttempt as number)} attempt`;
  }
  return null;
}
