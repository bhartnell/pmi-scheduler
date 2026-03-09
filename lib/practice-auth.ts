/**
 * Shared helper for case practice endpoints.
 *
 * Resolves the current user to either a student or an instructor (lab_user).
 * Instructors don't have a row in the students table, so practice tables use
 * a nullable student_id + a practitioner_email column for identification.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Practitioner {
  /** student.id when the user IS a student, null for instructors */
  id: string | null;
  email: string;
  firstName: string;
  lastName: string;
  initials: string;
  fullName: string;
  /** Only set for students */
  cohortId: string | null;
  isStudent: boolean;
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * Find the current user as either a student or instructor.
 * Checks the students table first, then falls back to lab_users.
 */
export async function findPractitioner(
  supabase: SupabaseClient,
  email: string
): Promise<Practitioner | null> {
  // 1. Check students table
  const { data: student } = await supabase
    .from('students')
    .select('id, email, first_name, last_name, cohort_id')
    .ilike('email', email)
    .single();

  if (student) {
    const first = student.first_name || '';
    const last = student.last_name || '';
    return {
      id: student.id,
      email: student.email || email,
      firstName: first,
      lastName: last,
      initials: `${first[0] || ''}${last[0] || ''}`.toUpperCase(),
      fullName: `${first} ${last}`.trim(),
      cohortId: student.cohort_id,
      isStudent: true,
    };
  }

  // 2. Fall back to lab_users (instructors / admins)
  const { data: labUser } = await supabase
    .from('lab_users')
    .select('id, email, name')
    .ilike('email', email)
    .eq('is_active', true)
    .single();

  if (labUser) {
    const nameParts = (labUser.name || '').split(' ');
    const first = nameParts[0] || '';
    const last = nameParts.slice(1).join(' ') || '';
    return {
      id: null,
      email: labUser.email,
      firstName: first,
      lastName: last,
      initials: `${first[0] || ''}${last[0] || ''}`.toUpperCase(),
      fullName: (labUser.name || email.split('@')[0]).trim(),
      cohortId: null,
      isStudent: false,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Apply the correct filter to a supabase query builder so it matches
 * records belonging to the given practitioner.
 *
 * - Students   → filter by student_id
 * - Instructors → filter by practitioner_email (student_id IS NULL)
 */
export function filterByPractitioner<T>(
  query: T & { eq: Function; is: Function },
  practitioner: Practitioner
): T {
  if (practitioner.isStudent && practitioner.id) {
    return (query as any).eq('student_id', practitioner.id);
  }
  return (query as any)
    .is('student_id', null)
    .eq('practitioner_email', practitioner.email);
}
