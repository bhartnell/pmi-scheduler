// One place for "back to the course hub" targets and crumbs on AHA pages
// (PALS P5 items 8 and 10): every grader, learning station and attempt record
// under a course reads Testing and certification > <course> Hub > <page> and
// Back returns to that hub with the cohort and day selected.

type Course = 'acls' | 'pals' | string | null | undefined;

export function courseHubPath(course: Course): string {
  return course === 'pals' ? '/labs/pals-hub' : '/labs/acls-hub/board';
}

export function courseHubLabel(course: Course): string {
  return course === 'pals' ? 'PALS Hub' : 'ACLS Hub';
}

export function courseHubHref(course: Course, cohortId?: string | null, date?: string | null): string {
  const qs = new URLSearchParams();
  if (cohortId) qs.set('cohortId', cohortId);
  if (date) qs.set('date', date.slice(0, 10));
  const q = qs.toString();
  return q ? `${courseHubPath(course)}?${q}` : courseHubPath(course);
}

/** BreadcrumbNames props for a page at labs/adv-cert/<leaf>. */
export function advCertCrumbs(course: Course, leaf: string, pageLabel: string, hubHref: string) {
  return {
    customSegments: {
      labs: 'Testing and certification',
      'labs/adv-cert': courseHubLabel(course),
      [`labs/adv-cert/${leaf}`]: pageLabel,
    },
    customHrefs: {
      labs: '/labs/aha-hub',
      'labs/adv-cert': hubHref,
    },
  };
}
