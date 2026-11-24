// Pure helpers for the NREMT hub station controls (slice "station controls").
// No I/O so they can be unit tested.

export type CoordinatorStatus = 'open' | 'closed' | 'break';

export const isClosed = (status: string | null | undefined): boolean => status === 'closed';

/** Plain-hyphen, trimmed, single-spaced form of a name (skill sheet names contain long dashes). */
const plain = (v: string | null | undefined): string =>
  (v || '').replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim();

/**
 * Next default own name for another station covering the same skill:
 * number = stations already in the group + 1, raised until that name is not already used
 * in the group. Always a plain hyphen, never an em or en dash. Existing names are never changed.
 * `existingNames` = the names of the stations already in the group.
 */
export function nextStationName(skillLabel: string, existingNames: Array<string | null | undefined>): string {
  const base = plain(skillLabel) || 'Station';
  const used = new Set(existingNames.map((n) => plain(n).toLowerCase()).filter(Boolean));
  let n = existingNames.length + 1;
  while (used.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
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

// ---- In-place station edits and proctor choices (card 4225cd1c) ----

/** Copy of the hub data with `patch` applied to the tiles in `ids` (my stations and every group); nothing else changes. */
export function patchTilesIn<T extends { id: string }, D extends { my_stations: T[]; groups: { stations: T[] }[] }>(d: D, ids: string[], patch: Partial<T>): D {
  const hit = (t: T) => (ids.includes(t.id) ? { ...t, ...patch } : t);
  return { ...d, my_stations: d.my_stations.map(hit), groups: d.groups.map((g) => ({ ...g, stations: g.stations.map(hit) })) };
}

export interface ProctorChoice {
  name: string;
  email: string;
}

/**
 * Proctor drop-down order: "Today's proctors" (the day's list) first, then "Staff" (instructor accounts
 * that are not already in today's list). Matching is by email, case-insensitive.
 */
export function proctorChoices(today: ProctorChoice[], staff: ProctorChoice[]): { today: ProctorChoice[]; staff: ProctorChoice[] } {
  const seen = new Set(today.map((p) => p.email.toLowerCase()));
  return { today, staff: staff.filter((p) => !seen.has(p.email.toLowerCase())) };
}

// ---- Second proctor (assistant) on a station (card 4225cd1c) ----

/** "Casey Townsley + Gavin Grogg (assisting)". One person set = exactly as before; assistant alone = "Gavin Grogg (assisting)". */
export function withAssistant(proctor: string | null | undefined, assistant: string | null | undefined): string | null {
  const p = (proctor || '').trim();
  const a = (assistant || '').trim();
  if (!a) return p || null;
  return p ? `${p} + ${a} (assisting)` : `${a} (assisting)`;
}

/** The same person cannot be proctor and assistant on one station (case-insensitive email). */
export function sameStationPerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a || '').trim().toLowerCase();
  return !!x && x === (b || '').trim().toLowerCase();
}

export interface PlacementTile {
  station_number: number;
  title: string;
  instructor_email: string | null;
  instructor_name: string | null;
  assistant_email: string | null;
  assistant_name: string | null;
}

/**
 * Who is where: for each of today's proctors, the stations they are on ("Name - Station" and
 * "Name - Station (assisting)"), or "not placed yet". A person on two stations lists both.
 * Matching is by email, case-insensitive. `today` keeps its own order.
 */
export function whoIsWhere(today: { name: string; email: string }[], tiles: PlacementTile[]): { email: string; name: string; places: string[] }[] {
  const sorted = [...tiles].sort((a, b) => a.station_number - b.station_number);
  return today.map((p) => {
    const places: string[] = [];
    for (const t of sorted) {
      if (sameStationPerson(t.instructor_email, p.email)) places.push(t.title);
      else if (sameStationPerson(t.assistant_email, p.email)) places.push(`${t.title} (assisting)`);
    }
    return { email: p.email, name: p.name, places };
  });
}

/** One display line for a person: "Casey - Spinal; Spinal 2", or "Casey - not placed yet". */
export function placementLine(name: string, places: string[]): string {
  return `${name} - ${places.length ? places.join('; ') : 'not placed yet'}`;
}
