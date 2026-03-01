import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin, hasMinRole } from '@/lib/permissions';

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

/**
 * PUT /api/instructor/time-clock/[id]
 * Admin: approve or reject a time entry.
 * Body: { action: 'approve' | 'reject' }
 * Instructors: edit notes on their own entry (if still pending).
 * Body: { notes: string }
 */
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
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Instructor access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the entry
    const { data: entry, error: fetchError } = await supabase
      .from('instructor_time_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !entry) {
      return NextResponse.json({ success: false, error: 'Time entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const isAdmin = canAccessAdmin(currentUser.role);
    const isOwner = entry.instructor_email.toLowerCase() === currentUser.email.toLowerCase();

    // Admin approve/reject flow
    if (body.action) {
      if (!isAdmin) {
        return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
      }

      const { action } = body;
      if (!['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { success: false, error: 'action must be "approve" or "reject"' },
          { status: 400 }
        );
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const { data: updated, error: updateError } = await supabase
        .from('instructor_time_entries')
        .update({
          status: newStatus,
          approved_by: currentUser.email,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, entry: updated });
    }

    // Instructor note-editing flow (only own pending entries)
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;

    const { data: updated, error: updateError } = await supabase
      .from('instructor_time_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    console.error('Error updating time entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update time entry' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/instructor/time-clock/[id]
 * Admin only: delete a time entry.
 */
export async function DELETE(
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

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('instructor_time_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete time entry' },
      { status: 500 }
    );
  }
}
