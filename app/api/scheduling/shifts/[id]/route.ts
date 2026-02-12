import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { isDirector } from '@/lib/endorsements';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Helper to get current user
async function getCurrentUser(email: string) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// GET - Get shift details with signups
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

    const supabase = getSupabase();

    const { data: shift, error } = await supabase
      .from('open_shifts')
      .select(`
        *,
        creator:created_by(id, name, email),
        signups:shift_signups(
          id,
          instructor_id,
          signup_start_time,
          signup_end_time,
          is_partial,
          status,
          confirmed_by,
          confirmed_at,
          declined_reason,
          notes,
          created_at,
          instructor:instructor_id(id, name, email),
          confirmer:confirmed_by(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !shift) {
      return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
    }

    // Add computed fields
    const signups = shift.signups || [];
    const confirmedSignups = signups.filter((s: { status: string }) => s.status === 'confirmed');
    const userSignup = signups.find((s: { instructor_id: string }) => s.instructor_id === currentUser.id);

    const processedShift = {
      ...shift,
      signup_count: signups.length,
      confirmed_count: confirmedSignups.length,
      user_signup: userSignup || null,
      is_filled: shift.max_instructors ? confirmedSignups.length >= shift.max_instructors : false
    };

    return NextResponse.json({ success: true, shift: processedShift });
  } catch (error) {
    console.error('Error fetching shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch shift' }, { status: 500 });
  }
}

// PUT - Update shift (directors only)
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

    // Check if user is a director or admin
    const userIsDirector = await isDirector(currentUser.id);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    if (!userIsDirector && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Only directors can update shifts' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, date, start_time, end_time, location, department, min_instructors, max_instructors } = body;

    const supabase = getSupabase();

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = date;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (location !== undefined) updateData.location = location;
    if (department !== undefined) updateData.department = department;
    if (min_instructors !== undefined) updateData.min_instructors = min_instructors;
    if (max_instructors !== undefined) updateData.max_instructors = max_instructors;

    const { data: shift, error } = await supabase
      .from('open_shifts')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        creator:created_by(id, name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to update shift' }, { status: 500 });
  }
}

// DELETE - Cancel shift (directors only)
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

    // Check if user is a director or admin
    const userIsDirector = await isDirector(currentUser.id);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    if (!userIsDirector && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Only directors can cancel shifts' }, { status: 403 });
    }

    const supabase = getSupabase();

    // Mark as cancelled rather than hard delete
    const { data: shift, error } = await supabase
      .from('open_shifts')
      .update({ is_cancelled: true })
      .eq('id', id)
      .select(`
        *,
        signups:shift_signups(
          instructor:instructor_id(id, name, email)
        )
      `)
      .single();

    if (error) throw error;

    // TODO: Notify all signed up instructors that shift is cancelled

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error('Error cancelling shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel shift' }, { status: 500 });
  }
}
