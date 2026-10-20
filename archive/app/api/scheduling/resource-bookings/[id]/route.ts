import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

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

// PUT - Update booking (approve, cancel, modify)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, title, start_time, end_time, notes } = body;

    const supabase = getSupabaseAdmin();

    // Fetch the existing booking
    const { data: booking, error: fetchError } = await supabase
      .from('resource_bookings')
      .select('id, booked_by, status, resource_id, start_time, end_time, title')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const isAdmin = hasMinRole(currentUser.role, 'admin');
    const isOwner = booking.booked_by === currentUser.email;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    if (action === 'approve') {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only admins can approve bookings' },
          { status: 403 }
        );
      }
      updates.status = 'confirmed';
      updates.approved_by = currentUser.email;
    } else if (action === 'cancel') {
      updates.status = 'cancelled';
    } else {
      // Modify booking details
      if (title !== undefined) updates.title = title;
      if (notes !== undefined) updates.notes = notes || null;

      if (start_time !== undefined || end_time !== undefined) {
        const newStart = start_time || booking.start_time;
        const newEnd = end_time || booking.end_time;

        const startDate = new Date(newStart);
        const endDate = new Date(newEnd);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return NextResponse.json(
            { success: false, error: 'Invalid start_time or end_time' },
            { status: 400 }
          );
        }

        if (endDate <= startDate) {
          return NextResponse.json(
            { success: false, error: 'end_time must be after start_time' },
            { status: 400 }
          );
        }

        // Re-check for conflicts excluding the current booking
        const { data: conflicts } = await supabase
          .from('resource_bookings')
          .select('id, title, start_time, end_time')
          .eq('resource_id', booking.resource_id)
          .in('status', ['confirmed', 'pending'])
          .neq('id', id)
          .lt('start_time', newEnd)
          .gt('end_time', newStart);

        if (conflicts && conflicts.length > 0) {
          const conflict = conflicts[0];
          const conflictStart = new Date(conflict.start_time).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          return NextResponse.json(
            {
              success: false,
              error: `Time conflict: "${conflict.title}" is already booked starting ${conflictStart}`,
              conflict,
            },
            { status: 409 }
          );
        }

        updates.start_time = newStart;
        updates.end_time = newEnd;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('resource_bookings')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        resource_id,
        booked_by,
        title,
        start_time,
        end_time,
        status,
        notes,
        approved_by,
        created_at,
        resource:resource_id(id, name, type, location)
      `)
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, booking: updatedBooking });
  } catch (error) {
    console.error('Error updating resource booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Fetch the booking to verify ownership
    const { data: booking, error: fetchError } = await supabase
      .from('resource_bookings')
      .select('id, booked_by, status')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const isAdmin = hasMinRole(currentUser.role, 'admin');
    const isOwner = booking.booked_by === currentUser.email;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Booking is already cancelled' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('resource_bookings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling resource booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
