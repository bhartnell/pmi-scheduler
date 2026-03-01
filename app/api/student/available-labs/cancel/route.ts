import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/** Cancellations are blocked within this many hours of the lab start */
const CANCEL_DEADLINE_HOURS = 24;

/**
 * POST /api/student/available-labs/cancel
 * Cancel a student's signup for a lab day.
 * - Enforces 24-hour cancellation deadline
 * - Sets status to 'cancelled', records reason and timestamp
 * - Promotes the next waitlisted student when a confirmed spot is freed
 *
 * Body: { signup_id: string; cancel_reason?: string }
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
    const { signup_id, cancel_reason } = body;

    if (!signup_id) {
      return NextResponse.json(
        { success: false, error: 'signup_id is required' },
        { status: 400 }
      );
    }

    // Fetch the signup and verify it belongs to this student
    const { data: signup, error: signupError } = await supabase
      .from('student_lab_signups')
      .select(`
        id,
        lab_day_id,
        student_id,
        status,
        waitlist_position,
        lab_day:lab_day_id(id, date, title, start_time)
      `)
      .eq('id', signup_id)
      .eq('student_id', student.id)
      .single();

    if (signupError || !signup) {
      return NextResponse.json(
        { success: false, error: 'Signup not found or does not belong to you' },
        { status: 404 }
      );
    }

    if (signup.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'This signup is already cancelled' },
        { status: 400 }
      );
    }

    // Enforce cancellation deadline
    const labDay = signup.lab_day as unknown as { date: string; start_time: string | null } | null;
    if (labDay) {
      const labDateStr = labDay.date;
      const labTimeStr = labDay.start_time || '08:00';
      const labDateTime = new Date(`${labDateStr}T${labTimeStr}`);
      const hoursUntilLab = (labDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilLab < CANCEL_DEADLINE_HOURS && hoursUntilLab >= 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cancellations must be made at least ${CANCEL_DEADLINE_HOURS} hours before the lab. Please contact your instructor directly.`,
          },
          { status: 400 }
        );
      }
    }

    const wasConfirmed = signup.status === 'confirmed';

    // Cancel the signup
    const { error: cancelError } = await supabase
      .from('student_lab_signups')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancel_reason?.trim() || null,
        waitlist_position: null,
      })
      .eq('id', signup_id);

    if (cancelError) throw cancelError;

    // If the cancelled signup was confirmed, promote the first waitlisted student
    if (wasConfirmed) {
      const { data: nextWaitlisted } = await supabase
        .from('student_lab_signups')
        .select('id, waitlist_position')
        .eq('lab_day_id', signup.lab_day_id)
        .eq('status', 'waitlisted')
        .order('waitlist_position', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextWaitlisted) {
        await supabase
          .from('student_lab_signups')
          .update({
            status: 'confirmed',
            waitlist_position: null,
          })
          .eq('id', nextWaitlisted.id);

        // Shift remaining waitlist positions down by 1
        // Fetch all remaining waitlisted signups for this lab day
        const { data: remainingWaitlist } = await supabase
          .from('student_lab_signups')
          .select('id, waitlist_position')
          .eq('lab_day_id', signup.lab_day_id)
          .eq('status', 'waitlisted')
          .order('waitlist_position', { ascending: true });

        if (remainingWaitlist && remainingWaitlist.length > 0) {
          for (let i = 0; i < remainingWaitlist.length; i++) {
            await supabase
              .from('student_lab_signups')
              .update({ waitlist_position: i + 1 })
              .eq('id', remainingWaitlist[i].id);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Signup cancelled successfully.',
    });
  } catch (error) {
    console.error('Error cancelling lab signup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel signup' },
      { status: 500 }
    );
  }
}
