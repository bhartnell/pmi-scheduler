// Pure logic for the PALS side of CoordinatorTracker (STUDENT... no, PALS P2b/4):
// final-round derivation and per-group status. No I/O, so it's unit-testable
// without a database — mirrors lib/pals-group-result.ts's posture.
//
// Section E's 3 rounds are modeled as 3 "round-slot" lab_stations rows (not 4
// physical stations) — see supabase/migrations/20260715_pals_certification_template_seed.sql.
// Every physical station runs the SAME case per round, so a group's round
// result is whichever Section-E attempt matches that round's scenario_id,
// regardless of which physical station it ran at. The round ORDER comes from
// the stations' own station_number (1=round 1, 2=round 2, 3=round 3) rather
// than a hardcoded scenario id list, so this keeps working if the case
// assignment ever changes.

import { normalizePalsResult, palsGroupResult, type PalsGroupResult, type PalsRoundResult } from './pals-group-result.ts';

export interface PalsCoordStation {
  id: string;
  station_number: number;
  scenario_id: string | null;
}

export interface PalsCoordLabDay {
  id: string;
  date: string;
  is_adv_cert_testing: boolean;
  stations: PalsCoordStation[];
}

export interface PalsCoordAttempt {
  id: string;
  lab_day_id: string;
  lab_group_id: string | null;
  result: string;
  attempted_at: string;
  watch?: boolean | null;
  watch_note?: string | null;
  scenario?: { id: string; title: string; case_code: string | null } | null;
  team_lead?: { id: string; first_name: string; last_name: string } | null;
}

export interface RoundSlot {
  round: number;
  scenarioId: string | null;
  scenarioTitle: string | null;
  caseCode: string | null;
}

/** Section E's round order, derived from its stations' station_number (not a hardcoded scenario list). */
export function finalRoundSlots(testingLabDays: PalsCoordLabDay[]): RoundSlot[] {
  const stations = testingLabDays
    .flatMap((d) => d.stations)
    .filter((s) => s.scenario_id)
    .sort((a, b) => a.station_number - b.station_number);
  const seen = new Set<string>();
  const slots: RoundSlot[] = [];
  for (const s of stations) {
    if (!s.scenario_id || seen.has(s.scenario_id)) continue;
    seen.add(s.scenario_id);
    slots.push({ round: slots.length + 1, scenarioId: s.scenario_id, scenarioTitle: null, caseCode: null });
  }
  return slots;
}

/** Annotates round slots with scenario title/case code once attempts (which carry the join) are known. */
export function labelRoundSlots(slots: RoundSlot[], attempts: PalsCoordAttempt[]): RoundSlot[] {
  const byScenario = new Map(attempts.filter((a) => a.scenario?.id).map((a) => [a.scenario!.id, a.scenario!]));
  return slots.map((s) => {
    const sc = s.scenarioId ? byScenario.get(s.scenarioId) : null;
    return { ...s, scenarioTitle: sc?.title ?? s.scenarioTitle, caseCode: sc?.case_code ?? s.caseCode };
  });
}

export interface RoundOutcome {
  round: number;
  result: PalsRoundResult | null;
  attempt: PalsCoordAttempt | null;
}

/**
 * One group's 3 round outcomes, each the group's LATEST attempt for that
 * round's scenario (a retest overwrites the earlier try for the same round).
 */
export function groupRoundOutcomes(
  groupId: string,
  testingAttempts: PalsCoordAttempt[],
  roundSlots: RoundSlot[],
): RoundOutcome[] {
  const mine = testingAttempts.filter((a) => a.lab_group_id === groupId);
  return roundSlots.map((slot): RoundOutcome => {
    const candidates = mine.filter((a) => a.scenario?.id === slot.scenarioId);
    if (candidates.length === 0) return { round: slot.round, result: null, attempt: null };
    const latest = candidates.reduce((best, a) => (new Date(a.attempted_at) > new Date(best.attempted_at) ? a : best));
    return { round: slot.round, result: normalizePalsResult(latest.result), attempt: latest };
  });
}

export interface GroupFinalStatus {
  outcomes: RoundOutcome[];
  groupResult: PalsGroupResult;
}

export function groupFinalStatus(groupId: string, testingAttempts: PalsCoordAttempt[], roundSlots: RoundSlot[]): GroupFinalStatus {
  const outcomes = groupRoundOutcomes(groupId, testingAttempts, roundSlots);
  const groupResult = palsGroupResult(outcomes.map((o) => o.result));
  return { outcomes, groupResult };
}

/** Cohort-wide: how many of the (synchronized) rounds have at least one graded attempt yet. */
export function roundsRunSoFar(testingAttempts: PalsCoordAttempt[], roundSlots: RoundSlot[]): number {
  const ranScenarioIds = new Set(testingAttempts.filter((a) => a.scenario?.id).map((a) => a.scenario!.id));
  return roundSlots.filter((s) => s.scenarioId && ranScenarioIds.has(s.scenarioId)).length;
}
