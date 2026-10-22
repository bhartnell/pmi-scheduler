// Test-data flag (Student view 2/4). cohorts.is_test and students.is_test are set only by the
// cohort form checkbox and the 'Add test student' action; nothing is pre-flagged.
// Every real-data read (stat bar, rosters, rollups, reports, exports) applies this one filter
// instead of repeating `.eq('is_test', false)`, so a new read path has one thing to import.

// Structural type: works for any PostgREST select/filter builder without importing its generics.
interface EqFilterable<T> {
  eq(column: string, value: boolean): T;
}

/** Exclude test rows from a students or cohorts query. */
export function notTest<T extends EqFilterable<T>>(query: T): T {
  return query.eq('is_test', false);
}

/** Embedded-table form, e.g. notTestEmbedded(query, 'cohort') for `.eq('cohort.is_test', false)`. */
export function notTestEmbedded<T extends EqFilterable<T>>(query: T, embed: string): T {
  return query.eq(`${embed}.is_test`, false);
}
