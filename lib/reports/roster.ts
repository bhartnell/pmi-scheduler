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
