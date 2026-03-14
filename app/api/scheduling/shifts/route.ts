import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isDirector } from '@/lib/endorsements';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createNotification, getEligibleShiftRecipients } from '@/lib/notifications';
import { sendShiftAvailableEmail } from '@/lib/email';

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

// GET - List shifts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const department = searchParams.get('department');
    const includeFilled = searchParams.get('include_filled') !== 'false';
    const includeCancelled = searchParams.get('include_cancelled') === 'true';

    const supabase = getSupabaseAdmin();

    let query = supabase
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
          notes,
          instructor:instructor_id(id, name, email)
        )
      `)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    // Date range filter
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    // Department filter
    if (department) {
      query = query.eq('department', department);
    }

    // Exclude cancelled by default
    if (!includeCancelled) {
      query = query.eq('is_cancelled', false);
    }

    const { data: shifts, error } = await query;

    if (error) throw error;

    // Process shifts to add counts and user-specific info
    const processedShifts = (shifts || []).map(shift => {
      const signups = shift.signups || [];
      const confirmedSignups = signups.filter((s: { status: string }) => s.status === 'confirmed');
      const userSignup = signups.find((s: { instructor_id: string }) => s.instructor_id === currentUser.id);

      return {
        ...shift,
        signup_count: signups.length,
        confirmed_count: confirmedSignups.length,
        user_signup: userSignup || null,
        is_filled: shift.max_instructors ? confirmedSignups.length >= shift.max_instructors : false
      };
    });

    // Filter out filled shifts if requested
    const filteredShifts = includeFilled
      ? processedShifts
      : processedShifts.filter(s => !s.is_filled);

    return NextResponse.json({ success: true, shifts: filteredShifts });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

// Helper function to calculate recurring dates
function calculateRecurringDates(
  startDate: string,
  repeatType: 'weekly' | 'biweekly' | 'monthly',
  repeatUntil: string
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00'); // Use noon to avoid timezone issues
  const end = new Date(repeatUntil + 'T12:00:00');
  let current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);

    if (repeatType === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (repeatType === 'biweekly') {
      current.setDate(current.getDate() + 14);
    } else if (repeatType === 'monthly') {
      const originalDay = start.getDate();
      current.setMonth(current.getMonth() + 1);
      // Handle months with fewer days (e.g., Jan 31 -> Feb 28)
      const maxDays = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      current.setDate(Math.min(originalDay, maxDays));
    }
  }

  return dates;
}

// POST - Create shift (directors only)
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

    // Check if user is a director or admin
    const userIsDirector = await isDirector(currentUser.id);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

    if (!userIsDirector && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Only directors can create shifts' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, date, start_time, end_time, location, department, min_instructors, max_instructors, repeat, repeat_until, dates } = body;

    if (!title || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, error: 'Title, start time, and end time are required' },
        { status: 400 }
      );
    }

    // If an explicit dates array is provided, use it directly
    if (!date && (!dates || !Array.isArray(dates) || dates.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Either date or dates array is required' },
        { status: 400 }
      );
    }

    // Validate recurring shift parameters (when using the legacy repeat approach)
    if (!dates && repeat && !repeat_until) {
      return NextResponse.json(
        { success: false, error: 'repeat_until is required for recurring shifts' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Determine all dates to create shifts for:
    // 1. Explicit dates array (from client-side repeat preview with possible removals)
    // 2. Legacy repeat/repeat_until approach
    // 3. Single date
    const shiftDates: string[] = dates && Array.isArray(dates) && dates.length > 0
      ? dates
      : repeat && repeat_until
        ? calculateRecurringDates(date, repeat, repeat_until)
        : [date];

    // Safety limit: max 26 weeks worth of shifts
    const MAX_REPEAT_WEEKS = 26;
    if (shiftDates.length > MAX_REPEAT_WEEKS + 1) {
      return NextResponse.json(
        { success: false, error: `Cannot create more than ${MAX_REPEAT_WEEKS + 1} shifts at once (${MAX_REPEAT_WEEKS} weeks)` },
        { status: 400 }
      );
    }

    // Validate that the date span doesn't exceed 26 weeks
    if (shiftDates.length > 1) {
      const firstDate = new Date(shiftDates[0] + 'T12:00:00');
      const lastDate = new Date(shiftDates[shiftDates.length - 1] + 'T12:00:00');
      const daySpan = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daySpan > MAX_REPEAT_WEEKS * 7) {
        return NextResponse.json(
          { success: false, error: `Date range cannot exceed ${MAX_REPEAT_WEEKS} weeks (${Math.round(MAX_REPEAT_WEEKS / 4.33)} months)` },
          { status: 400 }
        );
      }
    }

    // Create shift records for all dates
    const shiftRecords = shiftDates.map(shiftDate => ({
      title,
      description: description || null,
      date: shiftDate,
      start_time,
      end_time,
      location: location || null,
      department: department || null,
      created_by: currentUser.id,
      min_instructors: min_instructors || 1,
      max_instructors: max_instructors || null,
    }));

    const { data: shifts, error } = await supabase
      .from('open_shifts')
      .insert(shiftRecords)
      .select(`
        *,
        creator:created_by(id, name, email)
      `);

    if (error) throw error;

    // Notify eligible part-time/volunteer instructors about new shift(s)
    try {
      const recipients = await getEligibleShiftRecipients(session.user.email);

      if (recipients.length > 0 && shifts && shifts.length > 0) {
        const firstShift = shifts[0];
        const shiftDate = new Date(firstShift.date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const shiftLabel = shifts.length > 1
          ? `${firstShift.title} (${shifts.length} dates starting ${shiftDate})`
          : `${firstShift.title} on ${shiftDate}`;

        await Promise.all(
          recipients.map(async (recipient) => {
            // In-app notification
            await createNotification({
              userEmail: recipient.email,
              title: 'New shift available',
              message: `A new shift has been posted: ${shiftLabel}`,
              type: 'shift_available',
              linkUrl: '/scheduling/shifts',
              referenceType: 'open_shift',
              referenceId: firstShift.id,
            });

            // Email notification (respects user preferences via the email system)
            await sendShiftAvailableEmail(recipient.email, {
              title: firstShift.title,
              date: shiftDate,
              startTime: firstShift.start_time,
              endTime: firstShift.end_time,
              location: firstShift.location,
            });
          })
        );
      }
    } catch (notifError) {
      // Non-fatal: don't fail shift creation if notifications fail
      console.error('Error sending shift available notifications:', notifError);
    }

    return NextResponse.json({
      success: true,
      shift: shifts?.[0] || null, // Return first shift for backwards compatibility
      shifts, // Also return all shifts for recurring
      count: shifts?.length || 0
    });
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json({ success: false, error: 'Failed to create shift' }, { status: 500 });
  }
}
