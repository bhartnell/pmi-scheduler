import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

// GET - List students, optionally filtered by cohort
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohortId');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    let query = getSupabaseAdmin()
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        cohort_id,
        status,
        cohort:cohorts!students_cohort_id_fkey(id, cohort_number, is_external_program, program:programs(abbreviation))
      `)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (activeOnly) {
      query = query.in('status', ['active', 'enrolled']);
    }

    if (search) {
      const safeSearch = search.replace(/[%_,.()\\/]/g, '');
      query = query.or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Exclude students in external-program cohorts (e.g. LVFR) from the
    // PMI-facing roster so they don't clutter PMI lists/pickers. Students
    // with no cohort (cohort is null) are kept. LVFR students are managed
    // through the LVFR skills tools, which use their own cohort selectors.
    const students = (data || []).filter(
      (s) => !(s.cohort as { is_external_program?: boolean } | null)?.is_external_program
    );

    // FERPA audit: log student list access
    logAuditEvent({
      user: { email: session.user.email },
      action: 'student_record_viewed',
      resourceType: 'student_list',
      resourceDescription: `Viewed student list${cohortId ? ` for cohort ${cohortId}` : ''} (${students.length} students)`,
      metadata: { cohortId, search: search || null, activeOnly, resultCount: students.length },
    }).catch(console.error);

    return NextResponse.json({ success: true, students });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 });
  }
}
