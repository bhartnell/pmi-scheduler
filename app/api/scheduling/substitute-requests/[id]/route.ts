import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';

// Helper to get current user from lab_users
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// PUT - Approve or deny a substitute request (lead_instructor+ only)
//       OR cancel a request (requester only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, review_notes, covered_by } = body;
    const { id } = await params;

    if (!action || !['approve', 'deny', 'cancel'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be one of: approve, deny, cancel' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the existing request
    const { data: existingRequest, error: fetchError } = await supabase
      .from('substitute_requests')
      .select(`
        id,
        status,
        requester_email,
        reason,
        lab_day:lab_day_id(id, date, title)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Substitute request not found' },
        { status: 404 }
      );
    }

    // Authorization checks
    if (action === 'cancel') {
      // Only the requesting instructor can cancel
      if (existingRequest.requester_email !== currentUser.email) {
        return NextResponse.json(
          { success: false, error: 'Only the requesting instructor can cancel this request' },
          { status: 403 }
        );
      }
      if (existingRequest.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Only pending requests can be cancelled' },
          { status: 400 }
        );
      }
    } else {
      // approve or deny - requires lead_instructor+
      if (!hasMinRole(currentUser.role, 'lead_instructor')) {
        return NextResponse.json(
          { success: false, error: 'Only lead instructors and above can approve or deny requests' },
          { status: 403 }
        );
      }
      if (existingRequest.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Only pending requests can be approved or denied' },
          { status: 400 }
        );
      }
    }

    // Build the update payload
    const newStatus = action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'covered';

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
    };

    if (action === 'approve' || action === 'deny') {
      updatePayload.reviewed_by = currentUser.email;
      updatePayload.reviewed_at = new Date().toISOString();
      updatePayload.review_notes = review_notes || null;
      if (action === 'approve' && covered_by) {
        updatePayload.covered_by = covered_by;
        updatePayload.covered_at = new Date().toISOString();
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('substitute_requests')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Send notifications
    try {
      const requesterEmail = existingRequest.requester_email as string | null;
      const labDayData = existingRequest.lab_day as { date?: string; title?: string } | null;

      const labLabel = labDayData?.date
        ? new Date(labDayData.date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : 'your lab day';

      if (action === 'approve' && requesterEmail) {
        await createNotification({
          userEmail: requesterEmail,
          title: 'Substitute request approved',
          message: `Your substitute request for ${labLabel} was approved${review_notes ? `: ${review_notes}` : ''}`,
          type: 'shift_confirmed',
          linkUrl: '/scheduling/substitute-requests',
          referenceType: 'substitute_request',
          referenceId: id,
        });

        // If a specific substitute was assigned (covered_by is now an email), notify them
        if (covered_by) {
          await createNotification({
            userEmail: covered_by,
            title: 'You have been assigned as substitute',
            message: `${currentUser.name} assigned you to cover a lab on ${labLabel}`,
            type: 'lab_assignment',
            linkUrl: '/scheduling/substitute-requests',
            referenceType: 'substitute_request',
            referenceId: id,
          });
        } else {
          // Notify all available instructors that coverage is needed
          const { data: instructors } = await supabase
            .from('lab_users')
            .select('email')
            .in('role', ['instructor', 'lead_instructor', 'volunteer_instructor'])
            .eq('is_active', true)
            .neq('email', existingRequest.requester_email);

          if (instructors && instructors.length > 0) {
            await Promise.all(
              instructors.map(instructor =>
                createNotification({
                  userEmail: instructor.email,
                  title: 'Coverage needed',
                  message: `A substitute is needed to cover ${labLabel} — ${existingRequest.reason}`,
                  type: 'shift_available',
                  linkUrl: '/scheduling/substitute-requests',
                  referenceType: 'substitute_request',
                  referenceId: id,
                })
              )
            );
          }
        }
      }

      if (action === 'deny' && requesterEmail) {
        await createNotification({
          userEmail: requesterEmail,
          title: 'Substitute request denied',
          message: `Your substitute request for ${labLabel} was denied${review_notes ? `: ${review_notes}` : ''}`,
          type: 'shift_confirmed',
          linkUrl: '/scheduling/substitute-requests',
          referenceType: 'substitute_request',
          referenceId: id,
        });
      }
    } catch (notifError) {
      console.error('Error sending substitute request update notifications:', notifError);
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error('Error updating substitute request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update substitute request' },
      { status: 500 }
    );
  }
}

// DELETE - Hard-delete a request (requester only, pending only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { id } = await params;

    // Fetch the request to verify ownership
    const { data: existingRequest, error: fetchError } = await supabase
      .from('substitute_requests')
      .select('id, status, requester_email')
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Substitute request not found' },
        { status: 404 }
      );
    }

    // Only the requester or an admin can delete
    const isAdmin = hasMinRole(currentUser.role, 'admin');
    if (existingRequest.requester_email !== currentUser.email && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own requests' },
        { status: 403 }
      );
    }

    if (existingRequest.status !== 'pending' && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only pending requests can be deleted' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('substitute_requests')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting substitute request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete substitute request' },
      { status: 500 }
    );
  }
}
