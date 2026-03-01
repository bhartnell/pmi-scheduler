import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin, hasMinRole } from '@/lib/permissions';

async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

/**
 * GET /api/instructor/time-clock
 * For the current user: returns their time entries with summary stats.
 * For admins: pass ?all=true to get all instructors' entries.
 * Supports ?start=YYYY-MM-DD&end=YYYY-MM-DD date range filtering.
 * Supports ?instructor=email for admin filtering by specific instructor.
 */
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

    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Instructor access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const viewAll = searchParams.get('all') === 'true';
    const filterInstructor = searchParams.get('instructor');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Only admins can view all entries
    if (viewAll && !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    let query = supabase
      .from('instructor_time_entries')
      .select(`
        id,
        instructor_email,
        clock_in,
        clock_out,
        hours_worked,
        lab_day_id,
        notes,
        status,
        approved_by,
        approved_at,
        created_at
      `)
      .order('clock_in', { ascending: false });

    // Scope to current user unless admin requesting all
    if (!viewAll || !canAccessAdmin(currentUser.role)) {
      query = query.ilike('instructor_email', currentUser.email);
    } else if (filterInstructor) {
      query = query.ilike('instructor_email', filterInstructor);
    }

    if (startDate) {
      query = query.gte('clock_in', `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      query = query.lte('clock_in', `${endDate}T23:59:59Z`);
    }

    const { data: entries, error } = await query;

    if (error) throw error;

    const allEntries = entries || [];

    // Find any open (clocked-in) session for the current user
    const activeEntry = allEntries.find(
      (e) =>
        e.instructor_email.toLowerCase() === currentUser.email.toLowerCase() &&
        e.clock_in &&
        !e.clock_out
    ) || null;

    // Calculate summary stats for the current user's entries
    const now = new Date();

    // Week boundaries (Sunday–Saturday)
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Only compute stats for the current user's completed entries
    const myCompleted = allEntries.filter(
      (e) =>
        e.instructor_email.toLowerCase() === currentUser.email.toLowerCase() &&
        e.clock_out !== null &&
        e.hours_worked !== null
    );

    const todayEntries = myCompleted.filter((e) => {
      const d = new Date(e.clock_in);
      return d >= today && d < tomorrow;
    });

    const weekEntries = myCompleted.filter((e) => new Date(e.clock_in) >= startOfWeek);
    const monthEntries = myCompleted.filter((e) => new Date(e.clock_in) >= startOfMonth);

    const sumHours = (arr: typeof myCompleted) =>
      arr.reduce((sum, e) => sum + (Number(e.hours_worked) || 0), 0);

    // Average hours per week over the last 8 weeks
    const eightWeeksAgo = new Date(startOfWeek);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const last8WeeksEntries = myCompleted.filter((e) => new Date(e.clock_in) >= eightWeeksAgo);
    const avgWeeklyHours = last8WeeksEntries.length > 0 ? sumHours(last8WeeksEntries) / 8 : 0;

    const weeklyHours = sumHours(weekEntries);
    const isOvertime = weeklyHours > 40;

    const stats = {
      today: parseFloat(sumHours(todayEntries).toFixed(2)),
      week: parseFloat(weeklyHours.toFixed(2)),
      month: parseFloat(sumHours(monthEntries).toFixed(2)),
      avgWeekly: parseFloat(avgWeeklyHours.toFixed(2)),
      isOvertime,
    };

    return NextResponse.json({
      success: true,
      entries: allEntries,
      activeEntry,
      stats,
    });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch time entries' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/instructor/time-clock
 * Clock in: creates a new open time entry for the current user.
 * Body: { notes?: string, lab_day_id?: string }
 * Fails if the user already has an open session.
 */
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

    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Instructor access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Prevent double clock-in: check for an existing open session
    const { data: existing } = await supabase
      .from('instructor_time_entries')
      .select('id')
      .ilike('instructor_email', currentUser.email)
      .is('clock_out', null)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'You already have an active clock-in session. Please clock out first.' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { notes, lab_day_id } = body;

    // Auto-detect today's lab day if none supplied
    let resolvedLabDayId = lab_day_id || null;
    if (!resolvedLabDayId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: labDay } = await supabase
        .from('lab_days')
        .select('id')
        .eq('date', todayStr)
        .limit(1)
        .single();
      if (labDay) {
        resolvedLabDayId = labDay.id;
      }
    }

    const { data: entry, error } = await supabase
      .from('instructor_time_entries')
      .insert({
        instructor_email: currentUser.email,
        clock_in: new Date().toISOString(),
        lab_day_id: resolvedLabDayId,
        notes: notes?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('Error clocking in:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clock in' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/instructor/time-clock
 * Clock out: sets clock_out and computes hours_worked for the active session.
 * Body: { notes?: string }
 */
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

    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Instructor access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Find the open session
    const { data: openEntry, error: findError } = await supabase
      .from('instructor_time_entries')
      .select('id, clock_in')
      .ilike('instructor_email', currentUser.email)
      .is('clock_out', null)
      .limit(1)
      .single();

    if (findError || !openEntry) {
      return NextResponse.json(
        { success: false, error: 'No active clock-in session found.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const clockOut = new Date();
    const clockIn = new Date(openEntry.clock_in);
    const hoursWorked = parseFloat(
      ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
    );

    const { data: entry, error } = await supabase
      .from('instructor_time_entries')
      .update({
        clock_out: clockOut.toISOString(),
        hours_worked: hoursWorked,
        notes: body.notes?.trim() || undefined,
      })
      .eq('id', openEntry.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('Error clocking out:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clock out' },
      { status: 500 }
    );
  }
}
