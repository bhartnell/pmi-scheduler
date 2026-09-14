import type { SupabaseClient } from '@supabase/supabase-js';

const VALID_PROGRAMS = new Set(['emt', 'aemt', 'paramedic']);
const VALID_ENROLLMENT_STATUSES = new Set(['active', 'withdrawn', 'graduated']);

interface CreateEnrollmentForNewStudentParams {
  studentId: string;
  cohortId: string;
  /** The students.status value for the new row, if known. Defaults to 'active'. */
  status?: string | null;
  startDate?: string | null;
  notes?: string | null;
}

/**
 * Creates the student_program_enrollments row that belongs alongside every
 * new student assigned to a cohort.
 *
 * Every path that inserts a new `students` row with a `cohort_id` (bulk
 * import, single add, admin data-import) must call this so the student
 * shows up for program-level enrollment queries. Before this helper
 * existed, the bulk importer wrote `students` but skipped
 * `student_program_enrollments`, and the gap silently recurred every time
 * a new cohort was imported (see G14 in 2026, then G15 four months later).
 *
 * Mirrors the program-derivation and status rules used by the 2026-04-27
 * Phase 1 backfill and by promote_student_to_program, so students created
 * here land in the same shape as students who arrived via a lifecycle
 * transition.
 */
export async function createEnrollmentForNewStudent(
  supabase: SupabaseClient,
  { studentId, cohortId, status, startDate, notes }: CreateEnrollmentForNewStudentParams
): Promise<void> {
  if (!studentId || !cohortId) return;

  // Matches the Phase 1 backfill rule: on_hold students don't get an
  // enrollment row (not on any confirmed active-enrollment stance yet).
  const normalizedStatus = (status || 'active').toLowerCase();
  if (normalizedStatus === 'on_hold') return;

  const enrollmentStatus = VALID_ENROLLMENT_STATUSES.has(normalizedStatus)
    ? normalizedStatus
    : 'active';

  const { data: cohort } = await supabase
    .from('cohorts')
    .select('id, program:programs(abbreviation)')
    .eq('id', cohortId)
    .single();

  const abbreviation = (cohort as { program?: { abbreviation?: string } } | null)?.program
    ?.abbreviation;
  if (!abbreviation) return; // Cohort has no resolvable program — don't guess.

  const program =
    abbreviation === 'PM' || abbreviation === 'PMD' ? 'paramedic' : abbreviation.toLowerCase();
  if (!VALID_PROGRAMS.has(program)) return;

  // A brand-new student shouldn't already have an active enrollment, but
  // guard the one_active_enrollment_per_student invariant so this helper
  // stays safe if it's ever reused on an existing student.
  if (enrollmentStatus === 'active') {
    const { data: existingActive } = await supabase
      .from('student_program_enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle();
    if (existingActive) return;
  }

  await supabase.from('student_program_enrollments').insert({
    student_id: studentId,
    cohort_id: cohortId,
    program,
    status: enrollmentStatus,
    start_date: startDate || null,
    notes: notes || null,
  });
}
