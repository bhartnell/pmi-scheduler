import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
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

// GET - List all interested instructors for a swap request
export async function GET(
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

    const supabase = getSupabaseAdmin();

    // Verify the swap request exists
    const { data: swapRequest, error: swapError } = await supabase
      .from('shift_trade_requests')
      .select('id, status, requester_id, requester:requester_id(id, name, email)')
      .eq('id', id)
      .single();

    if (swapError || !swapRequest) {
      return NextResponse.json({ success: false, error: 'Swap request not found' }, { status: 404 });
    }

    // Fetch all interest records for this swap
    const { data: interests, error } = await supabase
      .from('shift_swap_interest')
      .select('id, swap_request_id, interested_by, status, notes, created_at')
      .eq('swap_request_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Enrich with user details from lab_users
    const enrichedInterests = await Promise.all(
      (interests || []).map(async (interest) => {
        const { data: user } = await supabase
          .from('lab_users')
          .select('id, name, email')
          .ilike('email', interest.interested_by)
          .single();
        return { ...interest, user: user || null };
      })
    );

    // Flag whether the current user has already expressed interest
    const myInterest = enrichedInterests.find(
      (i) => i.interested_by.toLowerCase() === currentUser.email.toLowerCase()
    );

    return NextResponse.json({
      success: true,
      interests: enrichedInterests,
      my_interest: myInterest || null,
      count: enrichedInterests.length,
    });
  } catch (error) {
    console.error('Error fetching swap interests:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch swap interests' }, { status: 500 });
  }
}

// POST - Express interest in covering this swap { notes? }
export async function POST(
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

    const supabase = getSupabaseAdmin();

    // Verify the swap request exists and is still open
    const { data: swapRequest, error: swapError } = await supabase
      .from('shift_trade_requests')
      .select(`
        id,
        status,
        requester_id,
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
        { success: false, error: 'This swap request is no longer accepting volunteers' },
        { status: 400 }
      );
    }

    // Prevent requester from expressing interest in their own swap
    if (swapRequest.requester_id === currentUser.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot express interest in your own swap request' },
        { status: 400 }
      );
    }

    // Check for existing interest record
    const { data: existing } = await supabase
      .from('shift_swap_interest')
      .select('id, status')
      .eq('swap_request_id', id)
      .ilike('interested_by', currentUser.email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'You have already expressed interest in this swap' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const notes = body?.notes || null;

    // Create the interest record
    const { data: interest, error: insertError } = await supabase
      .from('shift_swap_interest')
      .insert({
        swap_request_id: id,
        interested_by: currentUser.email,
        status: 'interested',
        notes,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Notify the swap requester that someone is interested
    try {
      const requesterData = swapRequest.requester as { email?: string; name?: string } | null;
      const shiftData = swapRequest.requester_shift as { title?: string; date?: string } | null;

      if (requesterData?.email) {
        await createNotification({
          userEmail: requesterData.email,
          title: 'Instructor interested in your swap',
          message: `${currentUser.name} is interested in covering your shift${shiftData?.title ? ` "${shiftData.title}"` : ''}`,
          type: 'shift_available',
          linkUrl: '/scheduling/shifts?tab=trades',
          referenceType: 'shift_swap_interest',
          referenceId: interest.id,
        });
      }

      // Also notify admins so they can assign a replacement when ready
      const { data: admins } = await supabase
        .from('lab_users')
        .select('email')
        .in('role', ['admin', 'superadmin'])
        .eq('is_active', true);

      if (admins && admins.length > 0) {
        await Promise.all(
          admins.map((admin) =>
            createNotification({
              userEmail: admin.email,
              title: 'New swap volunteer',
              message: `${currentUser.name} volunteered to cover${shiftData?.title ? ` "${shiftData.title}"` : ' a shift'}`,
              type: 'shift_available',
              linkUrl: '/scheduling/shifts?tab=trades',
              referenceType: 'shift_swap_interest',
              referenceId: interest.id,
            })
          )
        );
      }
    } catch (notifError) {
      console.error('Error sending interest notification:', notifError);
    }

    return NextResponse.json({ success: true, interest });
  } catch (error) {
    console.error('Error expressing swap interest:', error);
    return NextResponse.json({ success: false, error: 'Failed to express interest' }, { status: 500 });
  }
}

// DELETE - Withdraw interest
export async function DELETE(
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

    const supabase = getSupabaseAdmin();

    // Find the interest record owned by this user
    const { data: interest, error: findError } = await supabase
      .from('shift_swap_interest')
      .select('id, status')
      .eq('swap_request_id', id)
      .ilike('interested_by', currentUser.email)
      .maybeSingle();

    if (findError || !interest) {
      return NextResponse.json({ success: false, error: 'Interest record not found' }, { status: 404 });
    }

    // Cannot withdraw after being selected
    if (interest.status === 'selected') {
      return NextResponse.json(
        { success: false, error: 'You have already been selected — contact an admin to make changes' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('shift_swap_interest')
      .delete()
      .eq('id', interest.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error withdrawing swap interest:', error);
    return NextResponse.json({ success: false, error: 'Failed to withdraw interest' }, { status: 500 });
  }
}
