import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';

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

// PUT - Update availability entry
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

    const supabase = getSupabase();

    // Check if entry exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('instructor_availability')
      .select('instructor_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'Availability entry not found' }, { status: 404 });
    }

    if (existing.instructor_id !== currentUser.id) {
      return NextResponse.json({ success: false, error: 'You can only update your own availability' }, { status: 403 });
    }

    const body = await request.json();
    const { date, start_time, end_time, is_all_day, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (date !== undefined) updateData.date = date;
    if (is_all_day !== undefined) {
      updateData.is_all_day = is_all_day;
      if (is_all_day) {
        updateData.start_time = null;
        updateData.end_time = null;
      }
    }
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (notes !== undefined) updateData.notes = notes;

    const { data: entry, error } = await supabase
      .from('instructor_availability')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, availability: entry });
  } catch (error) {
    console.error('Error updating availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to update availability' }, { status: 500 });
  }
}

// DELETE - Delete availability entry
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

    const supabase = getSupabase();

    // Check if entry exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('instructor_availability')
      .select('instructor_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'Availability entry not found' }, { status: 404 });
    }

    if (existing.instructor_id !== currentUser.id) {
      return NextResponse.json({ success: false, error: 'You can only delete your own availability' }, { status: 403 });
    }

    const { error } = await supabase
      .from('instructor_availability')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting availability:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete availability' }, { status: 500 });
  }
}
