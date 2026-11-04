import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/lab-management/cohorts/[id]/clear-test-data
 * Body: { dry_run?: boolean }
 *
 * Admin action for an is_test cohort: removes its students, lab days, stations and every row hanging off
 * them, then the cohort, in ONE database transaction (clear_test_cohort). Every removed row is first copied
 * into deleted_records_archive (batch_id returned) so the removal is restorable. dry_run returns the exact
 * counts for the confirm dialog without changing anything. Refuses non-test cohorts and cohorts that hold
 * any non-test student. Does not touch Google Calendar.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const { id } = await params;

  let dry = false;
  try { const b = await request.json(); dry = b?.dry_run === true; } catch { /* no body = real run */ }

  try {
    const supabase = getSupabaseAdmin();
    const { data: cohort } = await supabase.from('cohorts').select('id, name, cohort_number, is_test').eq('id', id).maybeSingle();
    if (!cohort) return NextResponse.json({ success: false, error: 'Cohort not found' }, { status: 404 });
    if (!cohort.is_test) {
      return NextResponse.json({ success: false, error: 'Clear test data is for test cohorts only.' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('clear_test_cohort', { p_cohort_id: id, p_by: user.email, p_dry: dry });
    if (error) {
      console.error('clear_test_cohort failed:', error);
      return NextResponse.json({ success: false, error: `Nothing was deleted. ${error.message}` }, { status: 400 });
    }

    if (!dry) {
      await logAuditEvent({
        user: { id: user.id, email: user.email, role: user.role },
        action: 'delete',
        resourceType: 'cohort',
        resourceId: id,
        resourceDescription: `Cleared test cohort ${cohort.name ?? cohort.cohort_number ?? id}`,
        metadata: { batch_id: data?.batch_id, counts: data?.counts },
      }).catch(() => {});
    }
    return NextResponse.json({ success: true, dry_run: dry, batch_id: data?.batch_id, counts: data?.counts ?? {} });
  } catch (error) {
    console.error('Error clearing test cohort:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear test data' }, { status: 500 });
  }
}
