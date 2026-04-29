/**
 * Color assignment for the coordinator calendar (Scheduling Overhaul #2).
 *
 * Each part-timer renders in a consistent color across the week/month
 * grid, the hours sidebar, and any future drill-down views. The named
 * mapping covers people the user explicitly called out in the spec
 * (Jimi=blue, Trevor=green, Gannon=purple, Matt=orange) and falls back
 * to a deterministic hash → palette pick for everyone else, so a new
 * hire's color stays stable across page loads without a database row.
 *
 * Each entry returns paired light + dark mode classes so the UI can
 * compose them directly into Tailwind className strings without
 * computing variants at render time.
 */

export type PersonColor = {
  /** Solid background — confirmed lab assignments / shifts. */
  block: string;
  /** Ring + transparent fill — availability windows and recurring slots. */
  outline: string;
  /** Striped background — manual hour logs (self-reported). */
  stripe: string;
  /** Text color for "person name" labels and sidebar chips. */
  text: string;
  /** Solid mini-chip used in the sidebar legend. */
  chip: string;
};

const PALETTE: Record<string, PersonColor> = {
  blue: {
    block:   'bg-blue-500 dark:bg-blue-600 text-white',
    outline: 'border border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
    // The diagonal stripes use a CSS gradient so the pattern reads at
    // tiny sizes (the day-cell variant is ~80px wide). The base color
    // matches the block tint so the hue stays consistent.
    stripe:  'text-blue-900 dark:text-blue-100 bg-[repeating-linear-gradient(45deg,rgba(59,130,246,0.35)_0_6px,rgba(59,130,246,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(96,165,250,0.5)_0_6px,rgba(96,165,250,0.2)_6px_12px)]',
    text:    'text-blue-700 dark:text-blue-300',
    chip:    'bg-blue-500',
  },
  green: {
    block:   'bg-green-500 dark:bg-green-600 text-white',
    outline: 'border border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200',
    stripe:  'text-green-900 dark:text-green-100 bg-[repeating-linear-gradient(45deg,rgba(34,197,94,0.35)_0_6px,rgba(34,197,94,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(74,222,128,0.5)_0_6px,rgba(74,222,128,0.2)_6px_12px)]',
    text:    'text-green-700 dark:text-green-300',
    chip:    'bg-green-500',
  },
  purple: {
    block:   'bg-purple-500 dark:bg-purple-600 text-white',
    outline: 'border border-purple-400 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
    stripe:  'text-purple-900 dark:text-purple-100 bg-[repeating-linear-gradient(45deg,rgba(168,85,247,0.35)_0_6px,rgba(168,85,247,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(192,132,252,0.5)_0_6px,rgba(192,132,252,0.2)_6px_12px)]',
    text:    'text-purple-700 dark:text-purple-300',
    chip:    'bg-purple-500',
  },
  orange: {
    block:   'bg-orange-500 dark:bg-orange-600 text-white',
    outline: 'border border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200',
    stripe:  'text-orange-900 dark:text-orange-100 bg-[repeating-linear-gradient(45deg,rgba(249,115,22,0.35)_0_6px,rgba(249,115,22,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(251,146,60,0.5)_0_6px,rgba(251,146,60,0.2)_6px_12px)]',
    text:    'text-orange-700 dark:text-orange-300',
    chip:    'bg-orange-500',
  },
  pink: {
    block:   'bg-pink-500 dark:bg-pink-600 text-white',
    outline: 'border border-pink-400 dark:border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-800 dark:text-pink-200',
    stripe:  'text-pink-900 dark:text-pink-100 bg-[repeating-linear-gradient(45deg,rgba(236,72,153,0.35)_0_6px,rgba(236,72,153,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(244,114,182,0.5)_0_6px,rgba(244,114,182,0.2)_6px_12px)]',
    text:    'text-pink-700 dark:text-pink-300',
    chip:    'bg-pink-500',
  },
  teal: {
    block:   'bg-teal-500 dark:bg-teal-600 text-white',
    outline: 'border border-teal-400 dark:border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200',
    stripe:  'text-teal-900 dark:text-teal-100 bg-[repeating-linear-gradient(45deg,rgba(20,184,166,0.35)_0_6px,rgba(20,184,166,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(45,212,191,0.5)_0_6px,rgba(45,212,191,0.2)_6px_12px)]',
    text:    'text-teal-700 dark:text-teal-300',
    chip:    'bg-teal-500',
  },
  rose: {
    block:   'bg-rose-500 dark:bg-rose-600 text-white',
    outline: 'border border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200',
    stripe:  'text-rose-900 dark:text-rose-100 bg-[repeating-linear-gradient(45deg,rgba(244,63,94,0.35)_0_6px,rgba(244,63,94,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(251,113,133,0.5)_0_6px,rgba(251,113,133,0.2)_6px_12px)]',
    text:    'text-rose-700 dark:text-rose-300',
    chip:    'bg-rose-500',
  },
  cyan: {
    block:   'bg-cyan-500 dark:bg-cyan-600 text-white',
    outline: 'border border-cyan-400 dark:border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-800 dark:text-cyan-200',
    stripe:  'text-cyan-900 dark:text-cyan-100 bg-[repeating-linear-gradient(45deg,rgba(6,182,212,0.35)_0_6px,rgba(6,182,212,0.15)_6px_12px)] dark:bg-[repeating-linear-gradient(45deg,rgba(34,211,238,0.5)_0_6px,rgba(34,211,238,0.2)_6px_12px)]',
    text:    'text-cyan-700 dark:text-cyan-300',
    chip:    'bg-cyan-500',
  },
};

const FALLBACK_PALETTE = ['pink', 'teal', 'rose', 'cyan'] as const;

// Spec-named overrides — match against name first, then email handle as
// a fallback so e.g. "jimi.vargas@pmi.edu" still maps even if the
// display name is recorded as "James Vargas". Everything is lowercased
// for the comparison.
const NAMED_OVERRIDES: Array<{ match: RegExp; key: keyof typeof PALETTE }> = [
  { match: /jimi/i,             key: 'blue' },
  { match: /trevor/i,           key: 'green' },
  { match: /gannon/i,           key: 'purple' },
  { match: /matt(hew)?\s*dryden|matt dryden|dryden/i, key: 'orange' },
];

function hashPickPalette(seed: string): keyof typeof PALETTE {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}

/**
 * Resolve the palette key for a person. Used so we can show the same
 * color in the legend chip and the day-block — both call into this
 * helper so they never disagree.
 */
export function paletteKeyFor(person: { id: string; name?: string | null; email?: string | null }): keyof typeof PALETTE {
  const name = (person.name ?? '').toLowerCase();
  const email = (person.email ?? '').toLowerCase();
  for (const o of NAMED_OVERRIDES) {
    if (o.match.test(name) || o.match.test(email)) return o.key;
  }
  return hashPickPalette(person.id);
}

export function colorFor(person: { id: string; name?: string | null; email?: string | null }): PersonColor {
  return PALETTE[paletteKeyFor(person)];
}

/**
 * Build a stable id → color map for everyone in scope. The caller
 * passes the `people` array from the API response; the returned map
 * has the same lookup contract everywhere downstream:
 *
 *   const colors = buildColorMap(people);
 *   colors.get(block.person_id)?.block
 */
export function buildColorMap(
  people: Array<{ id: string; name?: string | null; email?: string | null }>
): Map<string, PersonColor> {
  // Detect collisions where two different people would land on the
  // same fallback palette slot — bump later names to the next slot so
  // the legend stays distinguishable. Named overrides are reserved
  // first and never collide.
  const reserved = new Set<keyof typeof PALETTE>();
  const map = new Map<string, PersonColor>();

  // First pass: named overrides (Jimi/Trevor/Gannon/Matt) get their
  // assigned key without competition.
  for (const p of people) {
    const matched = NAMED_OVERRIDES.find(
      o => o.match.test((p.name ?? '').toLowerCase()) || o.match.test((p.email ?? '').toLowerCase())
    );
    if (matched) {
      reserved.add(matched.key);
      map.set(p.id, PALETTE[matched.key]);
    }
  }

  // Second pass: hash-pick from the fallback palette, skipping any key
  // that's already reserved and any key that's already been handed out
  // in this pass (so we don't double up on, e.g., 'pink').
  const handedOut = new Set<keyof typeof PALETTE>(reserved);
  for (const p of people) {
    if (map.has(p.id)) continue;
    let key = hashPickPalette(p.id);
    let attempt = 0;
    while (handedOut.has(key) && attempt < FALLBACK_PALETTE.length) {
      // Walk forward in the fallback palette to find a free slot.
      const idx = (FALLBACK_PALETTE.indexOf(key as typeof FALLBACK_PALETTE[number]) + 1)
        % FALLBACK_PALETTE.length;
      key = FALLBACK_PALETTE[idx];
      attempt += 1;
    }
    handedOut.add(key);
    map.set(p.id, PALETTE[key]);
  }

  return map;
}

export const PALETTE_KEYS = Object.keys(PALETTE) as Array<keyof typeof PALETTE>;
