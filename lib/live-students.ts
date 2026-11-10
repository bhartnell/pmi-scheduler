// One shared "live student" rule (Withdrawn Students, PR 1).
// A withdrawal done in the UI sets students.status = 'withdrawn' and deletes nothing. Every WORKING
// surface (rosters, group lists, pickers, attendance, counts) uses this rule so a withdrawn student
// disappears by rule, not by hand-editing rows. HISTORICAL surfaces (a past record, results, exports,
// the student's own page) do not use it and keep showing the student.
//
// Statuses (students_status_check): active | graduated | withdrawn | on_hold.
//  - isNotWithdrawn: the working-surface rule for rosters/groups/pickers. Hides ONLY 'withdrawn';
//    on_hold and graduated stay visible (nothing about them changed).
//  - isLiveStudent: the stricter existing PALS rule (active only), kept unchanged for PALS.

/** Existing PALS rule: live = active (or no status). */
export function isLiveStudent(status: string | null | undefined): boolean {
  if (!status) return true;
  return status === 'active';
}

/** Working-surface rule: everyone except withdrawn students. */
export function isNotWithdrawn(status: string | null | undefined): boolean {
  return status !== 'withdrawn';
}

/** Post-fetch filter for rows that carry an embedded student: drops null and withdrawn students. */
export function liveEmbeddedStudents<S extends { status?: string | null }>(
  rows: Array<{ student?: S | null }> | null | undefined,
): S[] {
  const out: S[] = [];
  for (const r of rows || []) {
    if (r.student && isNotWithdrawn(r.student.status)) out.push(r.student);
  }
  return out;
}
