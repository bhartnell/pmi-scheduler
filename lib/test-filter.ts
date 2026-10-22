/**
 * The one shared not_test filter. Test cohorts/students (is_test = true) are a
 * QA/QI lane: they never count toward anything real (stat bar, rosters, readiness,
 * reports, exports, team-lead counts). Setup pickers (lab templates, planner,
 * grader, NREMT tracker) intentionally do NOT apply this and show a Test label.
 */

// Minimal structural type so this works with any supabase-js filter builder.
type Eqable<T> = { eq: (column: string, value: boolean) => T };

/** Exclude test students: `notTestStudents(supabase.from('students').select(...))`. */
export function notTestStudents<T extends Eqable<T>>(query: T): T {
  return query.eq('is_test', false);
}

/** Exclude students of test cohorts via an embedded cohort alias (e.g. `cohort:cohorts!...!inner(...)`). */
export function notTestCohortEmbed<T extends Eqable<T>>(query: T, alias = 'cohort'): T {
  return query.eq(`${alias}.is_test`, false);
}

/** Exclude test cohorts: `notTestCohorts(supabase.from('cohorts').select(...))`. */
export function notTestCohorts<T extends Eqable<T>>(query: T): T {
  return query.eq('is_test', false);
}

/** In-memory form for rows already fetched (embedded cohort may be an array). */
export function isTestRow(row: { is_test?: boolean | null; cohort?: unknown } | null | undefined): boolean {
  if (!row) return false;
  if (row.is_test) return true;
  const c = Array.isArray(row.cohort) ? row.cohort[0] : row.cohort;
  return !!(c && typeof c === 'object' && (c as { is_test?: boolean | null }).is_test);
}

export const TEST_STUDENT_EMAIL_DOMAIN = 'test-student.invalid';
