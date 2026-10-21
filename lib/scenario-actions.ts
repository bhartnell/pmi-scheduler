// Splits scenario expected-action text into per-level lists.
// Data carries [EMT] / [AEMT] / [Paramedic] prefixes, either one item per
// array entry / line, or run together in one string. Nothing in the data
// changes; this only decides how it is displayed.

export type ActionLevel = 'EMT' | 'AEMT' | 'Paramedic';

export const ACTION_LEVELS: ActionLevel[] = ['EMT', 'AEMT', 'Paramedic'];

export interface LeveledActions {
  EMT: string[];
  AEMT: string[];
  Paramedic: string[];
  /** Lines with no level prefix. */
  plain: string[];
}

const LEVEL_PREFIX = /^\s*\[(EMT|AEMT|Paramedic)\]\s*/i;
const LEVEL_SPLIT = /(?=\[(?:EMT|AEMT|Paramedic)\])/i;

function normalizeLevel(raw: string): ActionLevel {
  const l = raw.toLowerCase();
  if (l === 'aemt') return 'AEMT';
  if (l === 'paramedic') return 'Paramedic';
  return 'EMT';
}

/** Accepts string, string[] or anything else (stringified, never dropped). */
export function parseLeveledActions(input: unknown): LeveledActions {
  const out: LeveledActions = { EMT: [], AEMT: [], Paramedic: [], plain: [] };
  const rawItems: unknown[] = Array.isArray(input) ? input : input == null ? [] : [input];

  for (const raw of rawItems) {
    const text = typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw);
    for (const line of text.split(/\r?\n/)) {
      for (const piece of line.split(LEVEL_SPLIT)) {
        const trimmed = piece.trim();
        if (!trimmed) continue;
        const m = trimmed.match(LEVEL_PREFIX);
        if (m) {
          const body = trimmed.slice(m[0].length).trim();
          if (body) out[normalizeLevel(m[1])].push(body);
        } else {
          out.plain.push(trimmed);
        }
      }
    }
  }
  return out;
}

export function hasLeveledActions(a: LeveledActions): boolean {
  return a.EMT.length + a.AEMT.length + a.Paramedic.length + a.plain.length > 0;
}
