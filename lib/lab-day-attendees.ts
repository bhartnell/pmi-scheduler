/**
 * One resolver for "who's coming" on a lab day (TRIM 6/7a-4c). Reads the
 * people on the day from lab_day_roles, station instructors (lab_stations
 * primary plus station_instructors co-instructors) and confirmed shift
 * signups, de-duplicated by email (name when there is no email). "Still open"
 * is the number of stations with no instructor. Pure: callers pass rows in.
 * People on the program's default roster (minus opt-outs) are on the day too,
 * the same membership the home week tile's You're in reads (HOME CAL 5).
 * The lab day page's Who's coming block (card 4005cd1c...882e) reuses this.
 */

export type AttendeeSource = 'role' | 'station' | 'signup' | 'default';

export interface AttendeeInput {
  roles: { role: string; name: string | null; email?: string | null; is_part_time?: boolean | null }[];
  stations: {
    station_number: number;
    instructor_name: string | null;
    instructor_email?: string | null;
    co_instructors?: { name: string | null; email?: string | null }[];
  }[];
  signups: string[];
  /** Default roster for the day's program, already minus anyone who used Remove me. */
  defaults?: { name: string | null; email?: string | null; is_part_time?: boolean | null }[];
}

export interface Attendee {
  name: string;
  email: string | null;
  /** Role on the day (Lead, Roamer, ...), 'Station 3', or 'signed up'. */
  labels: string[];
  employment: 'full-time' | 'part-time' | null;
}

export const ROLE_LABEL: Record<string, string> = {
  lab_lead: 'Lead',
  roamer: 'Roamer',
  observer: 'Observer',
  coordinator: 'Coordinator',
};

export function resolveLabDayAttendees(input: AttendeeInput): { attendees: Attendee[]; open: number } {
  const byKey = new Map<string, Attendee>();
  const add = (
    name: string | null | undefined,
    email: string | null | undefined,
    label: string,
    partTime?: boolean | null,
  ) => {
    const n = (name || email?.split('@')[0] || '').trim();
    if (!n) return;
    const key = (email || n).toLowerCase();
    const existing = byKey.get(key) ?? byKey.get(n.toLowerCase());
    if (existing) {
      if (!existing.labels.includes(label)) existing.labels.push(label);
      if (partTime != null && existing.employment == null) existing.employment = partTime ? 'part-time' : 'full-time';
      return;
    }
    const a: Attendee = {
      name: n,
      email: email || null,
      labels: [label],
      employment: partTime == null ? null : partTime ? 'part-time' : 'full-time',
    };
    byKey.set(key, a);
    // Same person seen later by name only still dedupes.
    byKey.set(n.toLowerCase(), a);
  };

  for (const r of input.roles) add(r.name, r.email, ROLE_LABEL[r.role] || r.role, r.is_part_time);
  for (const s of input.stations) {
    const label = `Station ${s.station_number}`;
    add(s.instructor_name, s.instructor_email, label);
    for (const c of s.co_instructors ?? []) add(c.name, c.email, label);
  }
  for (const n of input.signups) add(n, null, 'signed up');
  for (const d of input.defaults ?? []) add(d.name, d.email, 'default roster', d.is_part_time);

  const attendees = [...new Set(byKey.values())];
  const open = input.stations.filter(s => !s.instructor_name && !s.instructor_email).length;
  return { attendees, open };
}
