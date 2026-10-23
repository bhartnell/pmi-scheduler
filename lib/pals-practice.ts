// PALS practice-case attempts: one row per student acting as team lead, graded
// pass/fail with an optional "watch" flag and typed note (Ben 2026-10-19).
// Pure validation, no I/O, so the rules are testable without a database.
import { normalizePalsResult, type PalsRoundResult } from './pals-group-result.ts';

export interface PalsPracticeInput {
  student_id?: string | null;
  lab_day_id?: string | null;
  scenario_id?: string | null;
  result?: string | null;
  watch?: boolean | null;
  watch_note?: string | null;
}

export interface PalsPracticeClean {
  student_id: string;
  lab_day_id: string;
  scenario_id: string;
  result: PalsRoundResult;
  watch: boolean | null;
  watch_note: string | null;
}

export type PalsPracticeValidation =
  | { ok: true; value: PalsPracticeClean }
  | { ok: false; error: string };

/**
 * Normalises PASS/pass and NR/fail, requires the student, lab day and case,
 * and keeps watch tri-state (null = not assessed). A watch note is only kept
 * when watch is true; an NR attempt is not "pass but watch", so watch is
 * dropped to null for it.
 */
export function validatePalsPractice(input: PalsPracticeInput): PalsPracticeValidation {
  if (!input.student_id) return { ok: false, error: 'student_id (team lead) is required' };
  if (!input.lab_day_id) return { ok: false, error: 'lab_day_id is required' };
  if (!input.scenario_id) return { ok: false, error: 'scenario_id is required' };
  const result = normalizePalsResult(input.result);
  if (!result) return { ok: false, error: 'result must be pass or fail' };
  if (input.watch != null && typeof input.watch !== 'boolean') {
    return { ok: false, error: 'watch must be true, false or omitted' };
  }
  const watch = result === 'PASS' ? (input.watch ?? null) : null;
  const note = (input.watch_note ?? '').trim();
  return {
    ok: true,
    value: {
      student_id: input.student_id,
      lab_day_id: input.lab_day_id,
      scenario_id: input.scenario_id,
      result,
      watch,
      watch_note: watch === true && note ? note : null,
    },
  };
}
