// The two-part NREMT station (O2 by NRB E204, then BVM E203) treated as ONE station on the hub.
// Pure helpers, no I/O. The rule mirrors the Coordinator View's getOccupancyGroups (same non-empty
// proctor), which is left exactly as it is; the hub also falls back to the same room when both
// proctors are empty. Existing station rows are never renamed or changed.

export type PairCode = 'E203' | 'E204';

export interface PairItem {
  id: string;
  station_number: number;
  code: PairCode | null;
  proctor?: string | null;
  room?: string | null;
}

const norm = (v: string | null | undefined): string => (v || '').replace(/\s+/g, ' ').trim().toLowerCase();

/** E203 / E204 by NREMT code first, the skill-name pattern only as a fallback. */
export function pairCodeFor(nremtCode: string | null | undefined, skillName: string | null | undefined): PairCode | null {
  const c = (nremtCode || '').trim().toUpperCase();
  if (c === 'E203' || c === 'E204') return c;
  if (c) return null; // a different known code: never guess from the name
  const n = (skillName || '').toLowerCase();
  if (/\bbvm\b|bag.?valve/.test(n)) return 'E203';
  if (/\bnrb\b|non-?rebreather|\bo2\b|oxygen/.test(n)) return 'E204';
  return null;
}

export interface StationPair<T extends PairItem> {
  o2: T;
  bvm: T;
}

/**
 * Pair each O2 by NRB station with a BVM station: same non-empty proctor, else (both proctors
 * empty) same non-empty room. Each station is used once; lowest station numbers pair first.
 */
export function buildStationPairs<T extends PairItem>(items: T[]): StationPair<T>[] {
  const o2s = items.filter((i) => i.code === 'E204').sort((a, b) => a.station_number - b.station_number);
  const bvms = items.filter((i) => i.code === 'E203').sort((a, b) => a.station_number - b.station_number);
  const used = new Set<string>();
  const out: StationPair<T>[] = [];
  for (const o of o2s) {
    const op = norm(o.proctor);
    const or = norm(o.room);
    const match = bvms.find((b) => {
      if (used.has(b.id)) return false;
      const bp = norm(b.proctor);
      if (op && bp) return op === bp;
      if (!op && !bp) return !!or && or === norm(b.room);
      return false;
    });
    if (match) {
      used.add(match.id);
      out.push({ o2: o, bvm: match });
    }
  }
  return out.sort((a, b) => Math.min(a.o2.station_number, a.bvm.station_number) - Math.min(b.o2.station_number, b.bvm.station_number));
}

export const PAIR_TITLE = 'BVM + O2 by NRB';
/** Minutes after finishing one part during which the pair card shows "next part" instead of Send. */
export const PAIR_GAP_MIN = 5;

export type PairNeed = 'both' | 'o2' | 'bvm' | null;

export function needsLabel(n: PairNeed): string {
  if (n === 'both') return 'needs both';
  if (n === 'o2') return 'O2 by NRB only';
  if (n === 'bvm') return 'BVM only';
  return '';
}

export function pairNeed(passedO2: boolean, passedBvm: boolean): PairNeed {
  if (!passedO2 && !passedBvm) return 'both';
  if (!passedO2) return 'o2';
  if (!passedBvm) return 'bvm';
  return null;
}

/** First part to send the student to: O2 by NRB if owed (the grading page runs it first), else BVM. */
export function firstPart(n: PairNeed): 'o2' | 'bvm' | null {
  if (n === 'both' || n === 'o2') return 'o2';
  if (n === 'bvm') return 'bvm';
  return null;
}

/** True while the "finished one part, next part follows" gap is showing. */
export function inPairGap(completedAtIso: string | null | undefined, now: number): boolean {
  if (!completedAtIso) return false;
  const t = Date.parse(completedAtIso);
  if (Number.isNaN(t)) return false;
  const mins = (now - t) / 60000;
  return mins >= 0 && mins < PAIR_GAP_MIN;
}

/**
 * Default name for an extra station opened from the hub: the lowest-numbered station's own name in
 * the skill group, trailing number removed, plus the next free number (2, 3, ...). Plain hyphen only.
 * `group` = the stations already in the group (name = own name, else the skill name).
 */
export function nextExtraStationName(group: Array<{ station_number: number; name: string | null | undefined }>, fallbackSkillName: string): string {
  const plain = (v: string | null | undefined) => (v || '').replace(/[‒–—―−]/g, '-').replace(/\s+/g, ' ').trim();
  const sorted = [...group].sort((a, b) => a.station_number - b.station_number);
  const first = plain(sorted[0]?.name) || plain(fallbackSkillName) || 'Station';
  const base = first.replace(/\s+\d+$/, '') || first;
  const used = new Set(group.map((g) => plain(g.name).toLowerCase()));
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

/**
 * "Open another ..." reopens a closed station of that skill before it creates a new one
 * (card 4225cd1c). Returns the lowest-numbered CLOSED station (status exactly 'closed', never
 * 'break'), or null when the skill has none and a new station should be created.
 */
export function pickReopenStation<T extends { station_number: number; closed: boolean }>(stations: T[]): T | null {
  const closed = stations.filter((s) => s.closed).sort((a, b) => a.station_number - b.station_number);
  return closed[0] || null;
}

/** Lowest-numbered pair whose two parts are BOTH closed, or null. Pair order = lowest part number. */
export function pickReopenPair<T extends PairItem & { closed: boolean }>(pairs: StationPair<T>[]): StationPair<T> | null {
  const closed = pairs.filter((p) => p.o2.closed && p.bvm.closed);
  closed.sort((a, b) => Math.min(a.o2.station_number, a.bvm.station_number) - Math.min(b.o2.station_number, b.bvm.station_number));
  return closed[0] || null;
}
