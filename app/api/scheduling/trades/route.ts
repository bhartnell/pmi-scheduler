import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isDirector } from '@/lib/endorsements';
import { createNotification } from '@/lib/notifications';

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

// Check if user can approve trades (director or admin)
async function canApproveTrades(userId: string, role: string): Promise<boolean> {
  if (role === 'admin' || role === 'superadmin') return true;
  return isDirector(userId);
}

// GET - List trade requests
// Query params: status, mine (boolean - only show my requests/incoming)
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const mineOnly = searchParams.get('mine') === 'true';

    const isApprover = await canApproveTrades(currentUser.id, currentUser.role);

    let query = supabase
      .from('shift_trade_requests')
      .select(`
        id,
        status,
        reason,
        response_note,
        approved_at,
        created_at,
        updated_at,
        requester:requester_id(id, name, email),
        requester_shift:requester_shift_id(id, title, date, start_time, end_time, location, department),
        target_user:target_user_id(id, name, email),
        target_shift:target_shift_id(id, title, date, start_time, end_time, location, department),
        approver:approved_by(id, name)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    // Non-approvers only see their own requests (outgoing or incoming)
    if (!isApprover || mineOnly) {
      query = query.or(`requester_id.eq.${currentUser.id},target_user_id.eq.${currentUser.id}`);
    }

    const { data: trades, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, trades: trades || [] });
  } catch (error) {
    console.error('Error fetching trade requests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch trade requests' }, { status: 500 });
  }
}

// POST - Create a new trade request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { requester_shift_id, reason } = body;

    if (!requester_shift_id) {
      return NextResponse.json({ success: false, error: 'requester_shift_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the shift exists and the user has a confirmed signup
    const { data: signup } = await supabase
      .from('shift_signups')
      .select('id, status, shift:shift_id(id, title, date, start_time, end_time)')
      .eq('shift_id', requester_shift_id)
      .eq('instructor_id', currentUser.id)
      .eq('status', 'confirmed')
      .single();

    if (!signup) {
      return NextResponse.json(
        { success: false, error: 'You do not have a confirmed signup for this shift' },
        { status: 400 }
      );
    }

    // Check for an existing open trade request for this shift
    const { data: existingTrade } = await supabase
      .from('shift_trade_requests')
      .select('id, status')
      .eq('requester_id', currentUser.id)
      .eq('requester_shift_id', requester_shift_id)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existingTrade) {
      return NextResponse.json(
        { success: false, error: 'You already have an active trade request for this shift' },
        { status: 400 }
      );
    }

    // Create the trade request
    const { data: trade, error } = await supabase
      .from('shift_trade_requests')
      .insert({
        requester_id: currentUser.id,
        requester_shift_id,
        reason: reason || null,
        status: 'pending',
      })
      .select(`
        id,
        status,
        reason,
        created_at,
        requester:requester_id(id, name, email),
        requester_shift:requester_shift_id(id, title, date, start_time, end_time, location, department)
      `)
      .single();

    if (error) throw error;

    // Notify admins/directors of the new trade request
    try {
      const { data: admins } = await supabase
        .from('lab_users')
        .select('email')
        .in('role', ['admin', 'superadmin'])
        .eq('is_active', true);

      if (admins && admins.length > 0) {
        const shiftData = signup.shift as { title?: string; date?: string } | null;
        const shiftTitle = shiftData?.title || 'a shift';
        await Promise.all(
          admins.map(admin =>
            createNotification({
              userEmail: admin.email,
              title: 'New shift trade request',
              message: `${currentUser.name} requested a trade for: ${shiftTitle}`,
              type: 'shift_available',
              linkUrl: '/scheduling/shifts?tab=trades',
              referenceType: 'shift_trade_request',
              referenceId: trade.id,
            })
          )
        );
      }
    } catch (notifError) {
      console.error('Error sending trade request notifications:', notifError);
    }

    return NextResponse.json({ success: true, trade });
  } catch (error) {
    console.error('Error creating trade request:', error);
    return NextResponse.json({ success: false, error: 'Failed to create trade request' }, { status: 500 });
  }
}

// PUT - Update a trade request (accept, decline, approve, cancel)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, action, response_note } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, error: 'id and action are required' }, { status: 400 });
    }

    if (!['accept', 'decline', 'approve', 'cancel'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the trade request
    const { data: trade, error: fetchError } = await supabase
      .from('shift_trade_requests')
      .select(`
        id,
        status,
        requester_id,
        requester_shift_id,
        target_user_id,
        target_shift_id,
        requester:requester_id(id, name, email),
        requester_shift:requester_shift_id(id, title, date, start_time, end_time)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !trade) {
      return NextResponse.json({ success: false, error: 'Trade request not found' }, { status: 404 });
    }

    const isApprover = await canApproveTrades(currentUser.id, currentUser.role);

    // Validate who can perform each action
    if (action === 'cancel') {
      // Only the requester can cancel their own request
      if (trade.requester_id !== currentUser.id) {
        return NextResponse.json({ success: false, error: 'Only the requester can cancel this request' }, { status: 403 });
      }
      if (!['pending', 'accepted'].includes(trade.status)) {
        return NextResponse.json({ success: false, error: 'Cannot cancel a request that is already resolved' }, { status: 400 });
      }
    } else if (action === 'approve') {
      // Only directors/admins can approve
      if (!isApprover) {
        return NextResponse.json({ success: false, error: 'Only directors and admins can approve trade requests' }, { status: 403 });
      }
      if (trade.status !== 'accepted') {
        return NextResponse.json({ success: false, error: 'Can only approve requests that have been accepted' }, { status: 400 });
      }
    } else if (action === 'accept' || action === 'decline') {
      // Any instructor can accept/decline an open trade (the requester posts a request, others can accept)
      // Or the requester can also decline their own pending request (treat as cancel)
      if (trade.requester_id === currentUser.id && action === 'accept') {
        return NextResponse.json({ success: false, error: 'You cannot accept your own trade request' }, { status: 400 });
      }
      if (trade.status !== 'pending') {
        return NextResponse.json({ success: false, error: 'Can only accept/decline pending requests' }, { status: 400 });
      }
    }

    // Process the action
    if (action === 'cancel') {
      const { data: updated, error } = await supabase
        .from('shift_trade_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, trade: updated });
    }

    if (action === 'decline') {
      const { data: updated, error } = await supabase
        .from('shift_trade_requests')
        .update({
          status: 'declined',
          target_user_id: currentUser.id,
          response_note: response_note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Notify the requester
      try {
        const requesterData = trade.requester as { email?: string; name?: string } | null;
        const shiftData = trade.requester_shift as { title?: string } | null;
        if (requesterData?.email) {
          await createNotification({
            userEmail: requesterData.email,
            title: 'Trade request declined',
            message: `Your trade request for "${shiftData?.title || 'shift'}" was declined`,
            type: 'shift_confirmed',
            linkUrl: '/scheduling/shifts?tab=trades',
            referenceType: 'shift_trade_request',
            referenceId: id,
          });
        }
      } catch (notifError) {
        console.error('Error sending decline notification:', notifError);
      }

      return NextResponse.json({ success: true, trade: updated });
    }

    if (action === 'accept') {
      const { data: updated, error } = await supabase
        .from('shift_trade_requests')
        .update({
          status: 'accepted',
          target_user_id: currentUser.id,
          response_note: response_note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Notify the requester that someone accepted
      try {
        const requesterData = trade.requester as { email?: string; name?: string } | null;
        const shiftData = trade.requester_shift as { title?: string } | null;
        if (requesterData?.email) {
          await createNotification({
            userEmail: requesterData.email,
            title: 'Trade request accepted',
            message: `${currentUser.name} accepted your trade request for "${shiftData?.title || 'shift'}" — awaiting director approval`,
            type: 'shift_confirmed',
            linkUrl: '/scheduling/shifts?tab=trades',
            referenceType: 'shift_trade_request',
            referenceId: id,
          });
        }

        // Notify admins/directors for approval
        const { data: admins } = await supabase
          .from('lab_users')
          .select('email')
          .in('role', ['admin', 'superadmin'])
          .eq('is_active', true);

        if (admins && admins.length > 0) {
          await Promise.all(
            admins.map(admin =>
              createNotification({
                userEmail: admin.email,
                title: 'Shift trade needs approval',
                message: `${currentUser.name} accepted a trade from ${requesterData?.name || 'an instructor'} — pending your approval`,
                type: 'shift_available',
                linkUrl: '/scheduling/shifts?tab=trades',
                referenceType: 'shift_trade_request',
                referenceId: id,
              })
            )
          );
        }
      } catch (notifError) {
        console.error('Error sending accept notifications:', notifError);
      }

      return NextResponse.json({ success: true, trade: updated });
    }

    if (action === 'approve') {
      // Execute the swap:
      // 1. Withdraw the requester from their shift
      // 2. The acceptor (target_user) takes over the signup (or withdraws from their own if they had one)
      // 3. Mark the trade as approved

      const requesterShiftId = trade.requester_shift_id;
      const requesterId = trade.requester_id;
      const targetUserId = trade.target_user_id;

      if (!targetUserId) {
        return NextResponse.json({ success: false, error: 'No user has accepted this trade yet' }, { status: 400 });
      }

      // Withdraw the requester from their shift (mark signup as withdrawn)
      const { error: withdrawError } = await supabase
        .from('shift_signups')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('shift_id', requesterShiftId)
        .eq('instructor_id', requesterId)
        .eq('status', 'confirmed');

      if (withdrawError) throw withdrawError;

      // Create a new confirmed signup for the target user on the requester's shift
      // First check if the target user already had any existing signup
      const { data: existingSignup } = await supabase
        .from('shift_signups')
        .select('id, status')
        .eq('shift_id', requesterShiftId)
        .eq('instructor_id', targetUserId)
        .maybeSingle();

      if (existingSignup) {
        // Update existing (could be withdrawn)
        await supabase
          .from('shift_signups')
          .update({
            status: 'confirmed',
            confirmed_by: currentUser.id,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSignup.id);
      } else {
        // Get shift times to fill in signup times
        const { data: shiftData } = await supabase
          .from('open_shifts')
          .select('start_time, end_time')
          .eq('id', requesterShiftId)
          .single();

        await supabase
          .from('shift_signups')
          .insert({
            shift_id: requesterShiftId,
            instructor_id: targetUserId,
            signup_start_time: shiftData?.start_time || null,
            signup_end_time: shiftData?.end_time || null,
            is_partial: false,
            status: 'confirmed',
            confirmed_by: currentUser.id,
            confirmed_at: new Date().toISOString(),
            notes: `Trade approved by ${currentUser.name}`,
          });
      }

      // Mark the trade as approved
      const { data: updated, error: approveError } = await supabase
        .from('shift_trade_requests')
        .update({
          status: 'approved',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (approveError) throw approveError;

      // Notify both parties
      try {
        const requesterData = trade.requester as { email?: string; name?: string } | null;
        const shiftData = trade.requester_shift as { title?: string } | null;

        if (requesterData?.email) {
          await createNotification({
            userEmail: requesterData.email,
            title: 'Trade approved',
            message: `Your trade request for "${shiftData?.title || 'shift'}" was approved. You are no longer scheduled.`,
            type: 'shift_confirmed',
            linkUrl: '/scheduling/shifts?filter=mine',
            referenceType: 'shift_trade_request',
            referenceId: id,
          });
        }

        // Notify the accepting instructor
        const { data: targetUser } = await supabase
          .from('lab_users')
          .select('email, name')
          .eq('id', targetUserId)
          .single();

        if (targetUser?.email) {
          await createNotification({
            userEmail: targetUser.email,
            title: 'Trade approved — you are now scheduled',
            message: `Your acceptance of the trade for "${shiftData?.title || 'shift'}" was approved. You are now confirmed for this shift.`,
            type: 'shift_confirmed',
            linkUrl: '/scheduling/shifts?filter=mine',
            referenceType: 'shift_trade_request',
            referenceId: id,
          });
        }
      } catch (notifError) {
        console.error('Error sending approval notifications:', notifError);
      }

      return NextResponse.json({ success: true, trade: updated });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating trade request:', error);
    return NextResponse.json({ success: false, error: 'Failed to update trade request' }, { status: 500 });
  }
}
