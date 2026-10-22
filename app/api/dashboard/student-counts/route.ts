import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/dashboard/student-counts
 *
 * Read-only. Active students (excluding graduated / inactive cohorts) grouped by their cohort's program and
 * cohorts.current_semester (the same field the cohort pages use; semester is
 * never inferred from dates). Powers "students by program" in the home stat bar.
 *
 * Response: { success, total, programs: [{ abbreviation, name, total, semesters: [{ semester, count }] }] }
 */
export async function GET() {
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('students')
      .select('id, cohort:cohorts!students_cohort_id_fkey(current_semester, status, is_active, is_test, program:programs(name, abbreviation))')
      .eq('status', 'active')
      .eq('is_test', false)
      .limit(5000);
    if (error) throw error;

    const byProgram = new Map<string, { name: string; total: number; semesters: Map<number | null, number> }>();
    type Program = { name: string | null; abbreviation: string | null };
    type Cohort = { current_semester: number | null; status: string | null; is_active: boolean | null; is_test: boolean | null; program: Program | Program[] | null };
    const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);
    let total = 0;
    for (const row of data ?? []) {
      const cohort = one(row.cohort as Cohort | Cohort[] | null);
      // A graduated or inactive cohort is not in the current count, even if
      // some of its students are still marked active.
      if (cohort && (cohort.status === 'graduated' || cohort.is_active === false || cohort.is_test)) continue;
      total += 1;
      const program = one(cohort?.program);
      const abbr: string = program?.abbreviation || 'Unassigned';
      const entry = byProgram.get(abbr) ?? { name: program?.name || abbr, total: 0, semesters: new Map() };
      entry.total += 1;
      const sem: number | null = cohort?.current_semester ?? null;
      entry.semesters.set(sem, (entry.semesters.get(sem) ?? 0) + 1);
      byProgram.set(abbr, entry);
    }

    const programs = [...byProgram.entries()]
      .map(([abbreviation, v]) => ({
        abbreviation,
        name: v.name,
        total: v.total,
        semesters: [...v.semesters.entries()]
          .map(([semester, count]) => ({ semester, count }))
          .sort((a, b) => (a.semester ?? 99) - (b.semester ?? 99)),
      }))
      .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

    return NextResponse.json({ success: true, total, programs });
  } catch (error) {
    console.error('Error fetching student counts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch student counts' }, { status: 500 });
  }
}
