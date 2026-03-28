import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// DELETE - Admin: reset all scoring data for a TEST event only
// Deletes evaluator scores, resets assessment status, removes observer registrations
// Refuses to operate on non-test events
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // 1. Verify this is a test event
    const { data: event, error: eventError } = await supabase
      .from('osce_events')
      .select('id, title, event_pin')
      .eq('id', id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const isTestEvent =
      (event.event_pin && event.event_pin.toUpperCase().includes('TEST')) ||
      (event.title && (event.title.includes('TEST') || event.title.includes('DRY RUN')));

    if (!isTestEvent) {
      return NextResponse.json(
        { success: false, error: 'This action is only allowed on test events. The event title or PIN must contain "TEST" or "DRY RUN".' },
        { status: 403 }
      );
    }

    // 2. Get all assessment IDs for this event
    const { data: assessments } = await supabase
      .from('osce_assessments')
      .select('id')
      .eq('event_id', id);

    const assessmentIds = assessments?.map(a => a.id) || [];
    let deletedScores = 0;
    let resetAssessments = 0;
    let deletedObservers = 0;

    // 3. Delete evaluator scores for these assessments
    if (assessmentIds.length > 0) {
      const { count } = await supabase
        .from('osce_evaluator_scores')
        .delete({ count: 'exact' })
        .in('assessment_id', assessmentIds);
      deletedScores = count || 0;
      resetAssessments = assessmentIds.length;
    }

    // 4. Delete observer registrations for this event
    const { count: obsCount } = await supabase
      .from('osce_observers')
      .delete({ count: 'exact' })
      .eq('event_id', id);
    deletedObservers = obsCount || 0;

    return NextResponse.json({
      success: true,
      deleted: {
        evaluator_scores: deletedScores,
        assessments_reset: resetAssessments,
        observers: deletedObservers,
      },
      message: `Test data cleared: ${deletedScores} scores deleted, ${resetAssessments} assessments reset, ${deletedObservers} observers removed.`,
    });
  } catch (error) {
    console.error('Error deleting test data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
