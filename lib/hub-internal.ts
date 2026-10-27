/**
 * Hub-internal course rows (PALS P6 item 7).
 *
 * The ACLS and PALS hubs are the only pathway for those courses: the section
 * lab_days (cert_course set) and the course agenda blocks
 * (content_notes 'agenda-line:<course>:<line>') live inside the hub. Calendar
 * views, the lab schedule list and Google carry ONE entry per course day (the
 * "PALS (Day 1 of 2)" planner block) that opens the hub. Decided by data,
 * never by date or cohort.
 */

export type HubCourse = 'acls' | 'pals';

export const AGENDA_LINE_PREFIX = 'agenda-line:';

export function hubCourseOf(certCourse: string | null | undefined): HubCourse | null {
  const c = (certCourse ?? '').toLowerCase();
  return c === 'acls' || c === 'pals' ? c : null;
}

export function isHubInternalLabDay(ld: { cert_course?: string | null }): boolean {
  return hubCourseOf(ld.cert_course) !== null;
}

export function isAgendaBlock(contentNotes: string | null | undefined): boolean {
  return typeof contentNotes === 'string' && contentNotes.startsWith(AGENDA_LINE_PREFIX);
}

/** The hub page for a course day, with that cohort and day selected. */
export function hubUrlFor(course: HubCourse, cohortId: string | null | undefined, date: string): string {
  const qs = new URLSearchParams();
  if (cohortId) qs.set('cohortId', cohortId);
  qs.set('date', date);
  return `${course === 'pals' ? '/labs/pals-hub' : '/labs/acls-hub/board'}?${qs}`;
}
