// PALS final testing is graded BY GROUP: the group passes when it passes 2 of
// the 3 synchronized final rounds, and every member gets the group result.
// Pure functions, no I/O, so the rule is testable without a database.

export type PalsRoundResult = 'PASS' | 'NR';
export type PalsGroupStatus = 'pass' | 'fail' | 'pending';

export const PALS_FINAL_ROUNDS = 3;
export const PALS_ROUNDS_TO_PASS = 2;

/** Normalises 'PASS' / 'pass' / ' Pass ' to 'PASS'; 'NR' / 'nr' / 'fail' to 'NR'; anything else to null (not graded). */
export function normalizePalsResult(raw: string | null | undefined): PalsRoundResult | null {
  const v = (raw ?? '').trim().toUpperCase();
  if (v === 'PASS') return 'PASS';
  if (v === 'NR' || v === 'FAIL') return 'NR';
  return null;
}

export interface PalsGroupResult {
  status: PalsGroupStatus;
  passedRounds: number;
  failedRounds: number;
  /** Rounds not yet graded. */
  remainingRounds: number;
}

/**
 * `rounds` holds one result per final round graded so far (raw strings are
 * normalised; ungraded or unrecognised values count as not yet graded).
 * Decided early: pass as soon as 2 rounds pass, fail as soon as the pass
 * threshold can no longer be reached (2 of 3 failed).
 */
export function palsGroupResult(
  rounds: Array<string | null | undefined>,
  totalRounds: number = PALS_FINAL_ROUNDS,
  roundsToPass: number = PALS_ROUNDS_TO_PASS,
): PalsGroupResult {
  const graded = rounds.map(normalizePalsResult).filter((r): r is PalsRoundResult => r !== null);
  const passedRounds = graded.filter(r => r === 'PASS').length;
  const failedRounds = graded.length - passedRounds;
  const remainingRounds = Math.max(totalRounds - graded.length, 0);
  let status: PalsGroupStatus = 'pending';
  if (passedRounds >= roundsToPass) status = 'pass';
  else if (passedRounds + remainingRounds < roundsToPass) status = 'fail';
  return { status, passedRounds, failedRounds, remainingRounds };
}

/** Every member of the group gets the group result. */
export function palsMemberResults(
  memberIds: string[],
  rounds: Array<string | null | undefined>,
): Record<string, PalsGroupResult> {
  const group = palsGroupResult(rounds);
  return Object.fromEntries(memberIds.map(id => [id, group]));
}
