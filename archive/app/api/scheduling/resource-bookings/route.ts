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

// GET - List bookings with optional filters: resource_id, date_from, date_to, status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resource_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('resource_bookings')
      .select(`
        id,
        resource_id,
        booked_by,
        title,
        start_time,
        end_time,
        status,
        is_recurring,
        recurrence_rule,
        notes,
        approved_by,
        created_at,
        resource:resource_id(id, name, type, location, capacity, requires_approval)
      `)
      .neq('status', 'cancelled')
      .order('start_time');

    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }

    if (dateFrom) {
      query = query.gte('start_time', dateFrom);
    }

    if (dateTo) {
      query = query.lte('start_time', dateTo);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: bookings, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, bookings: bookings || [] });
  } catch (error) {
    console.error('Error fetching resource bookings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

// POST - Create a new booking with conflict detection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Must be at least an instructor to book resources
    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { resource_id, title, start_time, end_time, notes } = body;

    if (!resource_id || !title || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, error: 'resource_id, title, start_time, and end_time are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

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

    const supabase = getSupabaseAdmin();

    // Fetch the resource to check if it exists and requires approval
    const { data: resource, error: resourceError } = await supabase
      .from('bookable_resources')
      .select('id, name, requires_approval, is_active')
      .eq('id', resource_id)
      .single();

    if (resourceError || !resource) {
      return NextResponse.json(
        { success: false, error: 'Resource not found' },
        { status: 404 }
      );
    }

    if (!resource.is_active) {
      return NextResponse.json(
        { success: false, error: 'This resource is not currently available for booking' },
        { status: 400 }
      );
    }

    // Conflict detection: check for overlapping confirmed/pending bookings
    const { data: conflicts, error: conflictError } = await supabase
      .from('resource_bookings')
      .select('id, title, start_time, end_time, booked_by')
      .eq('resource_id', resource_id)
      .in('status', ['confirmed', 'pending'])
      .lt('start_time', end_time)
      .gt('end_time', start_time);

    if (conflictError) throw conflictError;

    if (conflicts && conflicts.length > 0) {
      const conflict = conflicts[0];
      const conflictStart = new Date(conflict.start_time).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      const conflictEnd = new Date(conflict.end_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Time conflict: "${conflict.title}" is booked from ${conflictStart} to ${conflictEnd}`,
          conflict,
        },
        { status: 409 }
      );
    }

    // Determine initial status based on whether resource requires approval
    const initialStatus = resource.requires_approval ? 'pending' : 'confirmed';

    const { data: booking, error: insertError } = await supabase
      .from('resource_bookings')
      .insert({
        resource_id,
        booked_by: currentUser.email,
        title,
        start_time,
        end_time,
        status: initialStatus,
        notes: notes || null,
      })
      .select(`
        id,
        resource_id,
        booked_by,
        title,
        start_time,
        end_time,
        status,
        notes,
        created_at,
        resource:resource_id(id, name, type, location)
      `)
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Error creating resource booking:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
