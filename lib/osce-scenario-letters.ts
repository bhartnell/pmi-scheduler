// OSCE case letters are no longer limited to A-F (Dr. Kat approved G-J, 2026-11-18).
// The real gate is "is an ACTIVE row in osce_scenarios"; this is only the shape check.

export const isScenarioLetter = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]$/.test(v);

// Fallback list for UIs that cannot load the active scenarios.
export const DEFAULT_SCENARIO_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Solid badge (white text) used on the scoring page.
const SOLID: Record<string, string> = {
  A: 'bg-red-500', B: 'bg-blue-500', C: 'bg-green-500',
  D: 'bg-purple-500', E: 'bg-amber-500', F: 'bg-pink-500',
  G: 'bg-teal-500', H: 'bg-orange-500', I: 'bg-indigo-500', J: 'bg-cyan-600',
};

// Soft badge used on the dashboard.
const SOFT: Record<string, string> = {
  A: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  C: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  D: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  E: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  F: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  G: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  H: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  I: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  J: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
};

export const scenarioSolidColor = (letter: string | null | undefined): string =>
  (letter && SOLID[letter]) || 'bg-slate-500';

export const scenarioSoftColor = (letter: string | null | undefined): string =>
  (letter && SOFT[letter]) || 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';

// ---------------------------------------------------------------------------
// Case names (display only). osce_scenarios.short_name is a one-word label
// (Asthma, CHF, Bradycardia). The letter stays the stored key everywhere; the
// name is only what staff SEE. Never shown to students (it gives away the case).
// ---------------------------------------------------------------------------

/** Name when present and non-blank, else the letter. */
export const caseLabel = (letter: string | null | undefined, shortName?: string | null): string => {
  const name = typeof shortName === 'string' ? shortName.trim() : '';
  return name || letter || '';
};

export type CaseNames = Record<string, string>;

/** Label for a letter from a letter -> name map (missing / blank falls back to the letter). */
export const caseLabelFrom = (letter: string | null | undefined, names?: CaseNames | null): string =>
  caseLabel(letter, letter && names ? names[letter] : null);

/** Build a letter -> name map, dropping null / blank names. */
export const buildCaseNames = (rows: Array<{ scenario_letter: string; short_name?: string | null }> | null | undefined): CaseNames => {
  const out: CaseNames = {};
  for (const r of rows || []) {
    const n = typeof r.short_name === 'string' ? r.short_name.trim() : '';
    if (r.scenario_letter && n) out[r.scenario_letter] = n;
  }
  return out;
};

/** Active first, then by name A-Z (letter when there is no name). */
export const sortCases = <T extends { scenario_letter: string; short_name?: string | null; is_active?: boolean | null }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => {
    const act = Number(b.is_active !== false) - Number(a.is_active !== false);
    if (act) return act;
    const byName = caseLabel(a.scenario_letter, a.short_name).localeCompare(caseLabel(b.scenario_letter, b.short_name), undefined, { sensitivity: 'base' });
    return byName || a.scenario_letter.localeCompare(b.scenario_letter);
  });
