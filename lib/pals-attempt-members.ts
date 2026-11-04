// Who carried a PALS final round: the whole group, not just the team lead.
// pals_test_attempts is saved against the team lead only and pals_attempt_students
// is often empty, so membership is derived when it was not recorded.
// Pure functions, no I/O.
import { palsGroupResult, normalizePalsResult, type PalsGroupResult } from './pals-group-result.ts';

export interface ResolveMembersInput {
  leadId?: string | null;
  /** pals_attempt_students rows for the attempt (authoritative when present). */
  recordedIds?: string[] | null;
  /** Effective members of the attempt's lab group (regroups applied, withdrawn hidden). */
  groupMemberIds?: string[] | null;
  /** Students marked absent on the attempt's lab day. */
  absentIds?: Iterable<string> | null;
}

/**
 * Recorded roster wins (lead always included). Otherwise the group's effective
 * members minus those absent that day. The lead is always a member: they were
 * there to lead the round.
 */
export function resolveAttemptMembers(input: ResolveMembersInput): string[] {
  const recorded = (input.recordedIds || []).filter(Boolean);
  const out = new Set<string>();
  if (input.leadId) out.add(input.leadId);
  if (recorded.length > 0) {
    recorded.forEach((id) => out.add(id));
    return [...out];
  }
  const absent = new Set(input.absentIds || []);
  (input.groupMemberIds || []).forEach((id) => { if (!absent.has(id)) out.add(id); });
  return [...out];
}

export interface FinalRoundLike {
  id: string;
  lab_group_id: string | null;
  scenario_id?: string | null;
  result: string;
  attempted_at?: string | null;
}

/** Latest attempt per scenario within one group's finals (a retest replaces the earlier round). */
export function groupFinalRounds<T extends FinalRoundLike>(attempts: T[]): T[] {
  const latest = new Map<string, T>();
  for (const a of attempts) {
    const key = a.scenario_id || a.id;
    const prev = latest.get(key);
    if (!prev || String(a.attempted_at || '') > String(prev.attempted_at || '')) latest.set(key, a);
  }
  return [...latest.values()].sort((x, y) => String(x.attempted_at || '').localeCompare(String(y.attempted_at || '')));
}

export function groupResultFor(rounds: FinalRoundLike[]): PalsGroupResult {
  return palsGroupResult(groupFinalRounds(rounds).map((r) => normalizePalsResult(r.result)));
}
