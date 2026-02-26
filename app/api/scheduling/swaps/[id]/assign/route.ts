import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification, createBulkNotifications } from '@/lib/notifications';
import type { NotificationType } from '@/lib/notifications';

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// PUT - Director assigns a replacement from the interested pool
// Body: { interest_id: string }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Require admin+ role to assign
    const isAdmin =
      currentUser.role === 'admin' || currentUser.role === 'superadmin';
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only admins can assign replacements' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { interest_id } = body;

    if (!interest_id) {
      return NextResponse.json(
        { success: false, error: 'interest_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the swap request exists
    const { data: swapRequest, error: swapError } = await supabase
      .from('shift_trade_requests')
      .select(`
        id,
        status,
        requester_id,
        requester_shift_id,
        requester:requester_id(id, name, email),
        requester_shift:requester_shift_id(id, title, date, start_time, end_time)
      `)
      .eq('id', id)
      .single();

    if (swapError || !swapRequest) {
      return NextResponse.json({ success: false, error: 'Swap request not found' }, { status: 404 });
    }

    if (!['pending', 'accepted'].includes(swapRequest.status)) {
      return NextResponse.json(
        { success: false, error: 'This swap request is no longer open for assignment' },
        { status: 400 }
      );
    }

    // Verify the selected interest record belongs to this swap
    const { data: selectedInterest, error: interestError } = await supabase
      .from('shift_swap_interest')
      .select('id, interested_by, status')
      .eq('id', interest_id)
      .eq('swap_request_id', id)
      .single();

    if (interestError || !selectedInterest) {
      return NextResponse.json(
        { success: false, error: 'Interest record not found for this swap' },
        { status: 404 }
      );
    }

    // Fetch all other interest records so we can decline them
    const { data: otherInterests } = await supabase
      .from('shift_swap_interest')
      .select('id, interested_by')
      .eq('swap_request_id', id)
      .neq('id', interest_id)
      .eq('status', 'interested');

    // Mark selected interest as 'selected'
    const { error: selectError } = await supabase
      .from('shift_swap_interest')
      .update({ status: 'selected' })
      .eq('id', interest_id);

    if (selectError) throw selectError;

    // Mark all other interest records as 'declined'
    if (otherInterests && otherInterests.length > 0) {
      const { error: declineError } = await supabase
        .from('shift_swap_interest')
        .update({ status: 'declined' })
        .in('id', otherInterests.map((i) => i.id));

      if (declineError) throw declineError;
    }

    // Update the swap request status to 'approved' and record the approved_by
    const { error: approveError } = await supabase
      .from('shift_trade_requests')
      .update({
        status: 'approved',
        approved_by: currentUser.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (approveError) throw approveError;

    // ---- Notifications ----
    const requesterData = swapRequest.requester as { email?: string; name?: string } | null;
    const shiftData = swapRequest.requester_shift as {
      title?: string;
      date?: string;
      start_time?: string;
      end_time?: string;
    } | null;
    const shiftLabel = shiftData?.title || 'your shift';

    // 1. Notify the selected instructor
    try {
      await createNotification({
        userEmail: selectedInterest.interested_by,
        title: 'You have been assigned to cover a shift',
        message: `You have been assigned to cover "${shiftLabel}". Check your schedule for details.`,
        type: 'shift_confirmed' as NotificationType,
        linkUrl: '/scheduling/shifts?filter=mine',
        referenceType: 'shift_trade_request',
        referenceId: id,
      });
    } catch (notifError) {
      console.error('Error notifying selected instructor:', notifError);
    }

    // 2. Notify the requester that their swap has been filled
    try {
      if (requesterData?.email) {
        const selectedName =
          selectedInterest.interested_by.split('@')[0] || selectedInterest.interested_by;

        await createNotification({
          userEmail: requesterData.email,
          title: 'Your shift swap has been filled',
          message: `"${shiftLabel}" will be covered by ${selectedName}. You are no longer scheduled.`,
          type: 'shift_confirmed' as NotificationType,
          linkUrl: '/scheduling/shifts?tab=trades',
          referenceType: 'shift_trade_request',
          referenceId: id,
        });
      }
    } catch (notifError) {
      console.error('Error notifying requester:', notifError);
    }

    // 3. Notify declined instructors
    try {
      if (otherInterests && otherInterests.length > 0) {
        const declineNotifications = otherInterests.map((i) => ({
          userEmail: i.interested_by,
          title: 'Shift has been filled',
          message: `The shift "${shiftLabel}" has been covered. Thank you for your interest.`,
          type: 'shift_confirmed' as NotificationType,
          linkUrl: '/scheduling/shifts',
          referenceType: 'shift_trade_request',
          referenceId: id,
        }));

        await createBulkNotifications(declineNotifications);
      }
    } catch (notifError) {
      console.error('Error notifying declined instructors:', notifError);
    }

    return NextResponse.json({
      success: true,
      assigned_to: selectedInterest.interested_by,
      declined_count: otherInterests?.length ?? 0,
    });
  } catch (error) {
    console.error('Error assigning swap replacement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign replacement' },
      { status: 500 }
    );
  }
}
