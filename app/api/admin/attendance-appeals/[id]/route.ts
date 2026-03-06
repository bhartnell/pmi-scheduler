import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * PUT /api/admin/attendance-appeals/[id]
 * Approve or deny an attendance appeal.
 * Body: { action: 'approve' | 'deny', review_notes?: string }
 *
 * When approved the appeal status is set to 'approved'.
 * Downstream attendance record updates would happen here if an attendance
 * table exists; for now the approval is the authoritative record.
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = await request.json();
    const { action, review_notes } = body;

    if (!action || !['approve', 'deny'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "approve" or "deny"' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the appeal to verify it exists and is still pending
    const { data: appeal, error: fetchError } = await supabase
      .from('attendance_appeals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !appeal) {
      return NextResponse.json({ success: false, error: 'Appeal not found' }, { status: 404 });
    }

    if (appeal.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'This appeal has already been reviewed' },
        { status: 409 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'denied';

    const { error: updateError } = await supabase
      .from('attendance_appeals')
      .update({
        status: newStatus,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes?.trim() || null,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Appeal ${newStatus}.`,
      status: newStatus,
    });
  } catch (error) {
    console.error('Error processing attendance appeal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process appeal' },
      { status: 500 }
    );
  }
}
