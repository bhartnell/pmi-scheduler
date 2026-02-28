import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperadmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/database-tools/cohorts
//
// Returns cohorts that have an end_date in the past and are not yet archived.
// Also includes a student count per cohort.
// Requires superadmin role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    // Fetch past cohorts that aren't archived
    // We check both is_archived=false and archived=false to be safe
    const { data: cohorts, error } = await supabase
      .from('cohorts')
      .select('id, name, program, start_date, end_date, is_archived, archived')
      .lt('end_date', today)
      .order('end_date', { ascending: false });

    if (error) throw error;

    // Filter to only non-archived cohorts (handle both column name variants)
    const unarchivedCohorts = (cohorts ?? []).filter(
      (c) => !c.is_archived && !c.archived
    );

    // Get student counts for each cohort
    const cohortIds = unarchivedCohorts.map((c) => c.id);
    let studentCounts: Record<string, number> = {};

    if (cohortIds.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('cohort_id')
        .in('cohort_id', cohortIds);

      for (const s of students ?? []) {
        studentCounts[s.cohort_id] = (studentCounts[s.cohort_id] || 0) + 1;
      }
    }

    const cohortsWithCounts = unarchivedCohorts.map((c) => ({
      ...c,
      studentCount: studentCounts[c.id] ?? 0,
    }));

    return NextResponse.json({
      success: true,
      cohorts: cohortsWithCounts,
    });
  } catch (error) {
    console.error('Error fetching archivable cohorts:', error);
    return NextResponse.json({ error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/database-tools/cohorts
//
// Body: { cohort_ids: string[] }
//
// Archives the specified cohorts by setting is_archived = true.
// Requires superadmin role.
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const body = (await request.json()) as { cohort_ids: string[] };
    const { cohort_ids } = body;

    if (!cohort_ids || !Array.isArray(cohort_ids) || cohort_ids.length === 0) {
      return NextResponse.json({ error: 'cohort_ids array is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Try is_archived first (most likely column name)
    const { data, error } = await supabase
      .from('cohorts')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .in('id', cohort_ids)
      .select('id, name');

    if (error) {
      // If is_archived column doesn't exist, try archived
      const { data: data2, error: error2 } = await supabase
        .from('cohorts')
        .update({ archived: true })
        .in('id', cohort_ids)
        .select('id, name');
      if (error2) throw error2;
      return NextResponse.json({
        success: true,
        archived: data2 ?? [],
        count: (data2 ?? []).length,
      });
    }

    return NextResponse.json({
      success: true,
      archived: data ?? [],
      count: (data ?? []).length,
    });
  } catch (error) {
    console.error('Error archiving cohorts:', error);
    return NextResponse.json({ error: 'Failed to archive cohorts' }, { status: 500 });
  }
}
