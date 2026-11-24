// Pure helpers for the NREMT hub station controls (slice "station controls").
// No I/O so they can be unit tested.

export type CoordinatorStatus = 'open' | 'closed' | 'break';

export const isClosed = (status: string | null | undefined): boolean => status === 'closed';

/**
 * Next default own name for another station covering the same skill:
 * "Patient Assessment - Medical" -> "Patient Assessment - Medical 2", then 3.
 * Looks at the names already used in the group (custom titles / skill labels).
 */
export function nextStationName(skillLabel: string, existingNames: Array<string | null | undefined>): string {
  const base = skillLabel.trim() || 'Station';
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(?:\\s+(\\d+))?$`, 'i');
  let max = 0;
  for (const n of existingNames) {
    const m = (n || '').trim().match(re);
    if (!m) continue;
    max = Math.max(max, m[1] ? parseInt(m[1], 10) : 1);
  }
  // The skill's own plain name counts as number 1, so the first extra station is "2".
  return `${base} ${Math.max(max, 1) + 1}`;
}

/** Closed stations stay visible but sort after open ones; otherwise keep station order. */
export function sortGroupStations<T extends { station_number: number; coordinator_status?: string | null }>(stations: T[]): T[] {
  return [...stations].sort((a, b) => {
    const ac = isClosed(a.coordinator_status) ? 1 : 0;
    const bc = isClosed(b.coordinator_status) ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return a.station_number - b.station_number;
  });
}

/**
 * Location picker lists. Standard = active lab locations. NREMT-only = free-text rooms
 * already used on NREMT testing-day stations that are not a standard location.
 * Nothing is written anywhere: an NREMT-only location is just the room text a station
 * on an NREMT day carries, so it can never leak into the standard lists.
 */
export function buildLocationLists(standardNames: string[], nremtDayRooms: Array<string | null | undefined>) {
  const standard = Array.from(new Set(standardNames.map((s) => s.trim()).filter(Boolean)));
  const lower = new Set(standard.map((s) => s.toLowerCase()));
  const seen = new Set<string>();
  const nremtOnly: string[] = [];
  for (const r of nremtDayRooms) {
    const t = (r || '').trim();
    if (!t || lower.has(t.toLowerCase()) || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    nremtOnly.push(t);
  }
  nremtOnly.sort((a, b) => a.localeCompare(b));
  return { standard, nremtOnly };
}

/** Next free station number on a lab day. */
export function nextStationNumber(existing: number[]): number {
  return existing.length ? Math.max(...existing) + 1 : 1;
}
