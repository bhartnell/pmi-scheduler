/**
 * Shared scope → students resolver for the report engine. Read-only.
 */
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ReportScope } from '@/lib/reports/engine';

export interface RosterStudent { id: string; firstName: string; lastName: string; }

export async function fetchScopeStudents(scope: ReportScope): Promise<RosterStudent[]> {
  const supabase = getSupabaseAdmin();
  if (scope.kind === 'student') {
    const { data } = await supabase.from('students').select('id, first_name, last_name').eq('id', scope.studentId).single();
    return data ? [{ id: data.id, firstName: data.first_name, lastName: data.last_name }] : [];
  }
  const { data } = await supabase.from('students')
    .select('id, first_name, last_name').eq('cohort_id', scope.cohortId).eq('status', 'active').order('last_name');
  return (data ?? []).map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name }));
}

/**
 * The cohort's course date for a cert course = the EARLIEST lab-day of that
 * course (Day 1 — when the skills stations were verified). Stamped on the skills
 * sheets (Date of Test + sign-off). Returns null if none found.
 */
export async function fetchCourseDate(scope: ReportScope, course: 'acls' | 'pals'): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  let cohortId: string | null = null;
  if (scope.kind === 'cohort') cohortId = scope.cohortId;
  else {
    const { data } = await supabase.from('students').select('cohort_id').eq('id', scope.studentId).single();
    cohortId = data?.cohort_id ?? null;
  }
  if (!cohortId) return null;
  const { data } = await supabase.from('lab_days')
    .select('date').eq('cohort_id', cohortId).eq('cert_course', course)
    .order('date', { ascending: true }).limit(1);
  return data?.[0]?.date ?? null;
}
