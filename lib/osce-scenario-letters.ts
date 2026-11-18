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
