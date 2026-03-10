// ---------------------------------------------------------------------------
// Shared question-type normalisation utility
//
// Case JSON produced by AI generators or external imports may use varied
// type strings for questions (e.g. "multiple-choice", "mc", "free-text",
// "short_answer", "select_all", etc.).  This module maps them all to the
// five canonical types the app understands.
// ---------------------------------------------------------------------------

/** The five canonical question types used throughout the app. */
export type CanonicalQuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'ordered_list'
  | 'free_text'
  | 'numeric';

/**
 * Map every known alias → canonical type.
 * Keys must be lowercase, hyphens/underscores stripped.
 */
const ALIAS_MAP: Record<string, CanonicalQuestionType> = {
  // multiple_choice
  multiplechoice: 'multiple_choice',
  multiple_choice: 'multiple_choice',
  mc: 'multiple_choice',
  singlechoice: 'multiple_choice',
  single_choice: 'multiple_choice',
  radio: 'multiple_choice',

  // multi_select
  multiselect: 'multi_select',
  multi_select: 'multi_select',
  selectall: 'multi_select',
  select_all: 'multi_select',
  checkbox: 'multi_select',
  checkboxes: 'multi_select',
  multipleselect: 'multi_select',
  multiple_select: 'multi_select',

  // ordered_list
  orderedlist: 'ordered_list',
  ordered_list: 'ordered_list',
  ordering: 'ordered_list',
  sequence: 'ordered_list',
  ranking: 'ordered_list',
  rank: 'ordered_list',
  sortorder: 'ordered_list',

  // free_text
  freetext: 'free_text',
  free_text: 'free_text',
  text: 'free_text',
  shortanswer: 'free_text',
  short_answer: 'free_text',
  openended: 'free_text',
  open_ended: 'free_text',
  essay: 'free_text',
  longtext: 'free_text',

  // numeric
  numeric: 'numeric',
  number: 'numeric',
  numerical: 'numeric',
  integer: 'numeric',
};

/**
 * Normalise an arbitrary question-type string to one of the five canonical
 * types.  Returns the canonical type or `null` if no match is found.
 *
 * Normalisation steps:
 *   1. Lowercase
 *   2. Strip hyphens (e.g. "multiple-choice" → "multiplechoice")
 *   3. Look up in alias map (with underscores intact too)
 *   4. Also try stripping underscores for a second pass
 */
export function normalizeQuestionType(raw: string): CanonicalQuestionType | null {
  if (!raw || typeof raw !== 'string') return null;

  const lower = raw.trim().toLowerCase();

  // Direct hit (handles "multiple_choice", "free_text", etc.)
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];

  // Strip hyphens  ("multiple-choice" → "multiplechoice")
  const noHyphens = lower.replace(/-/g, '');
  if (ALIAS_MAP[noHyphens]) return ALIAS_MAP[noHyphens];

  // Strip underscores too ("multi_select" already handled above, but just in case)
  const noSeparators = lower.replace(/[-_]/g, '');
  if (ALIAS_MAP[noSeparators]) return ALIAS_MAP[noSeparators];

  return null;
}

/**
 * Convenience: normalise or fall back to the original string.
 * Useful in the UI where we still want to render *something* even for
 * unknown types.
 */
export function normalizeOrPassthrough(raw: string): CanonicalQuestionType | string {
  return normalizeQuestionType(raw) ?? raw;
}

/** All canonical type values, useful for validation lists. */
export const CANONICAL_QUESTION_TYPES: CanonicalQuestionType[] = [
  'multiple_choice',
  'multi_select',
  'ordered_list',
  'free_text',
  'numeric',
];
