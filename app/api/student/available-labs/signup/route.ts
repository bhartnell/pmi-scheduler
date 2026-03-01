import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const DEFAULT_CAPACITY = 20;

/**
 * POST /api/student/available-labs/signup
 * Sign a student up for a lab day.
 * - If spots are available: status = 'confirmed'
 * - If lab is full:         status = 'waitlisted' with next waitlist_position
 * - Prevents duplicate signups
 *
 * Body: { lab_day_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify student account
    const { data: labUser } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (!labUser || labUser.role !== 'student') {
      return NextResponse.json({ success: false, error: 'Student access only' }, { status: 403 });
    }

    // Resolve student record
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .ilike('email', session.user.email)
      .single();

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student record not found. Contact your instructor.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { lab_day_id } = body;

    if (!lab_day_id) {
      return NextResponse.json(
        { success: false, error: 'lab_day_id is required' },
        { status: 400 }
      );
    }

    // Verify the lab day exists and is in the future
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select('id, date, title')
      .eq('id', lab_day_id)
      .single();

    if (labDayError || !labDay) {
      return NextResponse.json({ success: false, error: 'Lab day not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];
    if (labDay.date < today) {
      return NextResponse.json(
        { success: false, error: 'Cannot sign up for a past lab day' },
        { status: 400 }
      );
    }

    // Check for an existing non-cancelled signup for this student + lab day
    const { data: existingSignup } = await supabase
      .from('student_lab_signups')
      .select('id, status')
      .eq('lab_day_id', lab_day_id)
      .eq('student_id', student.id)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existingSignup) {
      const statusLabel = existingSignup.status === 'confirmed' ? 'confirmed' : 'on the waitlist';
      return NextResponse.json(
        { success: false, error: `You are already ${statusLabel} for this lab day` },
        { status: 400 }
      );
    }

    // Count current confirmed signups to check capacity
    const { count: confirmedCount } = await supabase
      .from('student_lab_signups')
      .select('id', { count: 'exact', head: true })
      .eq('lab_day_id', lab_day_id)
      .eq('status', 'confirmed');

    const isFull = (confirmedCount || 0) >= DEFAULT_CAPACITY;

    let newStatus: 'confirmed' | 'waitlisted' = 'confirmed';
    let waitlistPosition: number | null = null;

    if (isFull) {
      newStatus = 'waitlisted';
      // Determine next waitlist position
      const { data: lastWaitlisted } = await supabase
        .from('student_lab_signups')
        .select('waitlist_position')
        .eq('lab_day_id', lab_day_id)
        .eq('status', 'waitlisted')
        .order('waitlist_position', { ascending: false })
        .limit(1)
        .maybeSingle();

      waitlistPosition = lastWaitlisted?.waitlist_position
        ? lastWaitlisted.waitlist_position + 1
        : 1;
    }

    // Insert the signup
    const { data: signup, error: insertError } = await supabase
      .from('student_lab_signups')
      .insert({
        lab_day_id,
        student_id: student.id,
        status: newStatus,
        waitlist_position: waitlistPosition,
      })
      .select('id, lab_day_id, student_id, status, waitlist_position, signed_up_at')
      .single();

    if (insertError) throw insertError;

    const message =
      newStatus === 'confirmed'
        ? 'Successfully signed up for this lab day.'
        : `Added to waitlist at position ${waitlistPosition}. You will be notified if a spot opens.`;

    return NextResponse.json({ success: true, signup, message });
  } catch (error) {
    console.error('Error signing up for lab:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sign up for lab day' },
      { status: 500 }
    );
  }
}
