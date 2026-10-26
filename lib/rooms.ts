export const NO_ROOM = 'No room set';

/** Group stations by room, in first-seen order, no-room last. */
export function groupByRoom<T extends { room: string | null; station_number: number }>(stations: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const s of stations) {
    const key = s.room?.trim() || NO_ROOM;
    const arr = m.get(key);
    if (arr) arr.push(s); else m.set(key, [s]);
  }
  return [...m.entries()]
    .map(([room, list]): [string, T[]] => [room, [...list].sort((a, b) => a.station_number - b.station_number)])
    .sort((a, b) => (a[0] === NO_ROOM ? 1 : b[0] === NO_ROOM ? -1 : 0));
}
