import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * PUT /api/admin/attendance-appeals/[id]
 * Approve or deny an attendance appeal.
 * Body: { action: 'approve' | 'deny', review_notes?: string }
 *
 * When approved the appeal status is set to 'approved'.
 * Downstream attendance record updates would happen here if an attendance
 * table exists; for now the approval is the authoritative record.
 */

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

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
        reviewed_by: currentUser.email,
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
