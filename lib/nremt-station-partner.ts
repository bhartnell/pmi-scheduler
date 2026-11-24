// Pure helper: choose the partner station (e.g. the BVM station an O2 by NRB station hands off to)
// when a lab day may have more than one station for the same NREMT skill code. No I/O.

export interface PartnerCandidate {
  id: string;
  station_number: number;
  proctor?: string | null;
  room?: string | null;
  coordinatorStatus?: string | null;
}

const norm = (v: string | null | undefined): string => (v || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Order: same proctor as the asking station, then same room, then open over closed,
 * then lowest station number. Never errors on more than one match. Returns null when empty.
 * `asking` is the station the handoff starts from (null when the caller did not say).
 */
export function choosePartnerStation<T extends PartnerCandidate>(
  candidates: T[],
  asking: { id: string; proctor?: string | null; room?: string | null } | null
): T | null {
  const pool = asking ? candidates.filter((c) => c.id !== asking.id) : candidates;
  if (pool.length === 0) return null;
  const askProctor = norm(asking?.proctor);
  const askRoom = norm(asking?.room);
  const score = (c: T): [number, number, number, number] => [
    askProctor && norm(c.proctor) === askProctor ? 0 : 1,
    askRoom && norm(c.room) === askRoom ? 0 : 1,
    c.coordinatorStatus === 'closed' ? 1 : 0,
    c.station_number,
  ];
  return [...pool].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] - sb[i];
    return 0;
  })[0];
}
