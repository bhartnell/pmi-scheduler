import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

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

// POST - Sign up for a shift
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params;

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

    // Get shift details
    const { data: shift, error: shiftError } = await supabase
      .from('open_shifts')
      .select('*, signups:shift_signups(id, status)')
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
    }

    if (shift.is_cancelled) {
      return NextResponse.json({ success: false, error: 'This shift has been cancelled' }, { status: 400 });
    }

    // Check if already signed up
    const existingSignup = shift.signups?.find(
      (s: { id: string; status: string }) =>
        s.status !== 'withdrawn' && s.status !== 'declined'
    );

    // Check if user already signed up (would be caught by unique constraint, but check early)
    const { data: userExisting } = await supabase
      .from('shift_signups')
      .select('id, status')
      .eq('shift_id', shiftId)
      .eq('instructor_id', currentUser.id)
      .single();

    if (userExisting && userExisting.status !== 'withdrawn') {
      return NextResponse.json({ success: false, error: 'You have already signed up for this shift' }, { status: 400 });
    }

    // Check if shift is full
    const confirmedCount = shift.signups?.filter((s: { status: string }) => s.status === 'confirmed').length || 0;
    if (shift.max_instructors && confirmedCount >= shift.max_instructors) {
      return NextResponse.json({ success: false, error: 'This shift is full' }, { status: 400 });
    }

    const body = await request.json();
    const { start_time, end_time, notes } = body;

    // Determine if partial
    const isPartial = !!(start_time || end_time) &&
      (start_time !== shift.start_time || end_time !== shift.end_time);

    // If user previously withdrew, update instead of insert
    if (userExisting && userExisting.status === 'withdrawn') {
      const { data: signup, error } = await supabase
        .from('shift_signups')
        .update({
          signup_start_time: start_time || shift.start_time,
          signup_end_time: end_time || shift.end_time,
          is_partial: isPartial,
          status: 'pending',
          notes: notes || null,
          confirmed_by: null,
          confirmed_at: null,
          declined_reason: null,
        })
        .eq('id', userExisting.id)
        .select(`
          *,
          instructor:instructor_id(id, name, email)
        `)
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, signup });
    }

    // Create new signup
    const { data: signup, error } = await supabase
      .from('shift_signups')
      .insert({
        shift_id: shiftId,
        instructor_id: currentUser.id,
        signup_start_time: start_time || shift.start_time,
        signup_end_time: end_time || shift.end_time,
        is_partial: isPartial,
        status: 'pending',
        notes: notes || null,
      })
      .select(`
        *,
        instructor:instructor_id(id, name, email)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'You have already signed up for this shift' }, { status: 400 });
      }
      throw error;
    }

    // TODO: Notify shift creator of new signup

    return NextResponse.json({ success: true, signup });
  } catch (error) {
    console.error('Error signing up for shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to sign up for shift' }, { status: 500 });
  }
}

// DELETE - Withdraw from a shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shiftId } = await params;

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

    // Find user's signup
    const { data: signup, error: fetchError } = await supabase
      .from('shift_signups')
      .select('id, status')
      .eq('shift_id', shiftId)
      .eq('instructor_id', currentUser.id)
      .single();

    if (fetchError || !signup) {
      return NextResponse.json({ success: false, error: 'Signup not found' }, { status: 404 });
    }

    if (signup.status === 'withdrawn') {
      return NextResponse.json({ success: false, error: 'Already withdrawn' }, { status: 400 });
    }

    // Mark as withdrawn
    const { error } = await supabase
      .from('shift_signups')
      .update({ status: 'withdrawn' })
      .eq('id', signup.id);

    if (error) throw error;

    // TODO: Notify shift creator if was confirmed

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error withdrawing from shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to withdraw from shift' }, { status: 500 });
  }
}
