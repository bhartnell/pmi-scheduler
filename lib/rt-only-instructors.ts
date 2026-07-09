/**
 * RT (respiratory therapy) staff who hold `lab_users` instructor rows purely
 * for ACLS-help duty, not paramedic-program teaching. No schema flag
 * distinguishes them (no primary_program tag, no is_rt_only column) — this is
 * a name/email-based exclusion list per Ben's 2026-07-09 request. Their
 * records must NOT be deleted (still needed for ACLS); this only hides them
 * from paramedic instructor-availability lists.
 */
export const RT_ONLY_INSTRUCTOR_EMAILS = new Set([
  'chooshmand@pmi.edu', // Christopher Hooshmand
  'tmate@pmi.edu', // Tiffany M. Mate
  'dridgell@pmi.edu', // Denise Ridgell
]);

export function isRtOnlyInstructor(email: string | null | undefined): boolean {
  return !!email && RT_ONLY_INSTRUCTOR_EMAILS.has(email.toLowerCase());
}
