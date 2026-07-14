// Shared helpers for consuming GET /api/lab-management/instructor-availability
// across the lab-day instructor pickers (EditStationModal, LabDayRolesSection)
// and the "Available Today" summary panel. Kept small and dependency-free so
// each consumer can build its own map/useMemo around a single fetched array.
import type { InstructorAvailabilityEntry } from './types';

/** Index availability entries by both id and lowercased email for lookup by
 * either an Instructor{id,email} record or a raw email string. */
export function buildAvailabilityMap(
  entries: InstructorAvailabilityEntry[]
): Map<string, InstructorAvailabilityEntry> {
  const map = new Map<string, InstructorAvailabilityEntry>();
  for (const e of entries) {
    if (e.id) map.set(e.id, e);
    if (e.email) map.set(e.email.toLowerCase(), e);
  }
  return map;
}

export function getAvailInfo(
  map: Map<string, InstructorAvailabilityEntry>,
  instructor: { id?: string; email?: string | null }
): InstructorAvailabilityEntry | undefined {
  if (instructor.id && map.has(instructor.id)) return map.get(instructor.id);
  if (instructor.email) return map.get(instructor.email.toLowerCase());
  return undefined;
}

/** True when the given availability group should show by default (before
 * the operator opts into "Show all instructors"). */
export function isDefaultVisibleGroup(group: InstructorAvailabilityEntry['group']): boolean {
  return group === 'available' || group === 'volunteer';
}

// Color/label convention per the endpoint's own doc comment:
// available=green, volunteer=blue, conflict=amber, no_availability=gray.
export const AVAILABILITY_GROUP_META: Record<
  InstructorAvailabilityEntry['group'],
  { label: string; dot: string; badge: string }
> = {
  available: {
    label: 'Available',
    dot: '\u{1F7E2}',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  volunteer: {
    label: 'Volunteer',
    dot: '\u{1F535}',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  conflict: {
    label: 'Conflict',
    dot: '\u{1F7E0}',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  no_availability: {
    label: 'No availability submitted',
    dot: '⚪',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
};

/** Short " (Volunteer)" / " (Conflict: ...)" style suffix for <option> text
 * in native selects, where colored dots aren't practical. Returns '' for
 * the default "available" group (no need to call it out) and for missing
 * data (instructor not yet classified). */
export function availabilitySuffix(avail: InstructorAvailabilityEntry | undefined): string {
  if (!avail) return '';
  switch (avail.group) {
    case 'volunteer':
      return ' (Volunteer signup)';
    case 'conflict':
      return ` (Conflict${avail.conflicts?.[0]?.title ? `: ${avail.conflicts[0].title}` : ''})`;
    case 'no_availability':
      return ' (No availability submitted)';
    default:
      return '';
  }
}
