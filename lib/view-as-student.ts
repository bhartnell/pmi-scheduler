import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, isStudent } from '@/lib/permissions';

/**
 * "View as a student" (card STUDENT VIEW 3/4, extended in STUDENT VIEW 4/4):
 * an admin+ only impersonation of a single student, scoped to the
 * /api/student/* routes (and, via the lower-level helpers below, the
 * preinternship and exam-signup routes). The cookie only ever carries a
 * student id; it is meaningless unless the signed-in session itself resolves
 * to an admin+ role, checked server-side on every request below. Leaving
 * View as clears the cookie only — it never touches the NextAuth session.
 *
 * Writes while viewing as a student are read-only EXCEPT for a test student
 * (`students.is_test`) — a test student can never be a real person's record,
 * so writing against it while viewing-as is safe and is how test students
 * get exercised end to end (STUDENT VIEW 4/4 item a).
 */
export const VIEW_AS_STUDENT_COOKIE = 'view_as_student_id';

export interface EffectiveStudent {
  found: true;
  /** The effective student's own row id/email — use these for the usual .ilike('email', ...) lookups. */
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  cohortId: string | null;
  isTest: boolean;
  /** The real signed-in user (always an admin+ when viewingAs is true). */
  viewerLabUserId: string;
  viewerEmail: string;
  viewingAs: boolean;
}

/**
 * A real, authenticated student with no linked `students` row yet (not an
 * error — several routes render a friendly "contact your instructor" empty
 * state for this instead of a hard failure; this case can't happen on the
 * view-as path, since /api/admin/view-as/set already confirmed the row).
 */
export interface StudentNotLinked {
  found: false;
  /** The real signed-in student's own email, for a route's own lab_users lookup if it needs one. */
  viewerEmail: string;
}

export type StudentContext = EffectiveStudent | StudentNotLinked;

async function lookupLabUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, email, role')
    .ilike('email', email)
    .single();
  return data as { id: string; email: string; role: string } | null;
}

/**
 * Reads the view-as cookie and, if it names an active student in a
 * non-archived cohort, returns that student. Does not check the caller's
 * role — callers must confirm admin+ first.
 */
async function resolveCookieStudent(request: NextRequest): Promise<{
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  cohort_id: string | null;
  is_test: boolean;
} | null> {
  const studentId = request.cookies.get(VIEW_AS_STUDENT_COOKIE)?.value;
  if (!studentId) return null;

  const supabase = getSupabaseAdmin();
  const { data: student } = await supabase
    .from('students')
    .select(
      'id, email, first_name, last_name, cohort_id, is_test, status, cohort:cohorts!students_cohort_id_fkey(is_archived)'
    )
    .eq('id', studentId)
    .maybeSingle();
  if (!student || student.status !== 'active' || !student.email) return null;

  const cohort = Array.isArray(student.cohort) ? student.cohort[0] : student.cohort;
  if (cohort?.is_archived) return null;

  return {
    id: student.id,
    email: student.email,
    first_name: student.first_name,
    last_name: student.last_name,
    cohort_id: student.cohort_id,
    is_test: !!student.is_test,
  };
}

/**
 * All-in-one guard for the simple /api/student/* routes: a real student
 * gets their own identity with full read/write; an admin+ with a valid
 * view-as cookie gets the picked student's identity for GET always, and for
 * any other method only when the picked student is a test student — a real
 * student stays read-only (403) under view-as. Returns a NextResponse to
 * short-circuit the route on failure.
 */
export async function requireStudentContext(request: NextRequest): Promise<StudentContext | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const labUser = await lookupLabUser(session.user.email);
  if (!labUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  if (isStudent(labUser.role)) {
    const supabase = getSupabaseAdmin();
    const { data: student } = await supabase
      .from('students')
      .select('id, email, first_name, last_name, cohort_id, is_test')
      .ilike('email', labUser.email)
      .single();
    if (!student) {
      // Not an error — callers render their own "contact your instructor" empty state.
      return { found: false, viewerEmail: labUser.email };
    }
    return {
      found: true,
      id: student.id,
      email: student.email,
      firstName: student.first_name,
      lastName: student.last_name,
      cohortId: student.cohort_id,
      isTest: !!student.is_test,
      viewerLabUserId: labUser.id,
      viewerEmail: labUser.email,
      viewingAs: false,
    };
  }

  if (hasMinRole(labUser.role, 'admin')) {
    const student = await resolveCookieStudent(request);
    if (student) {
      if (request.method !== 'GET' && !student.is_test) {
        return NextResponse.json(
          { success: false, error: 'Read-only while viewing as a student' },
          { status: 403 }
        );
      }
      return {
        found: true,
        id: student.id,
        email: student.email,
        firstName: student.first_name,
        lastName: student.last_name,
        cohortId: student.cohort_id,
        isTest: student.is_test,
        viewerLabUserId: labUser.id,
        viewerEmail: labUser.email,
        viewingAs: true,
      };
    }
  }

  return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
}

/**
 * Lower-level lookup for routes (e.g. skill-evaluations) that already have
 * their own branching for a real instructor's explicit ?student_id= access
 * and only need the view-as id layered on top of their own labUser lookup.
 * Returns null when the caller isn't a validly-viewing-as admin+. Does NOT
 * gate by method — callers that allow writes must check `isTest` themselves
 * (see requireStudentContext's write gate for the shape to mirror).
 */
export async function resolveViewAsStudentId(
  request: NextRequest,
  labUser: { role: string }
): Promise<{ id: string; email: string; cohortId: string | null; isTest: boolean } | null> {
  if (!hasMinRole(labUser.role, 'admin')) return null;
  const student = await resolveCookieStudent(request);
  if (!student) return null;
  return { id: student.id, email: student.email, cohortId: student.cohort_id, isTest: student.is_test };
}

/**
 * Resolves the acting student's email for routes (e.g. exam-scheduling
 * signups) that already do their own getServerSession + email-keyed
 * lookup and just need the view-as substitution layered on top: a real
 * student's own session email, or — for an admin+ with a view-as cookie —
 * the picked student's email, read-only (403) unless that student is a
 * test student. Returns a NextResponse to short-circuit on 401 or on a
 * blocked write.
 */
export async function resolveActingStudentEmail(
  request: NextRequest
): Promise<{ email: string; viewingAs: boolean; isTest: boolean } | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const labUser = await lookupLabUser(session.user.email);
  if (labUser && hasMinRole(labUser.role, 'admin')) {
    const student = await resolveCookieStudent(request);
    if (student) {
      if (request.method !== 'GET' && !student.is_test) {
        return NextResponse.json(
          { success: false, error: 'Read-only while viewing as a student' },
          { status: 403 }
        );
      }
      return { email: student.email, viewingAs: true, isTest: student.is_test };
    }
  }

  return { email: session.user.email, viewingAs: false, isTest: false };
}
