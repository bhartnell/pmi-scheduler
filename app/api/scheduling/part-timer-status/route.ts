import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get current user
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Date calculations
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Current week boundaries (Sunday to Saturday)
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Current month boundaries
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // 1. Get all part-time instructors
    const { data: partTimers, error: ptError } = await supabase
      .from('lab_users')
      .select('id, name, email, role, is_part_time')
      .eq('is_part_time', true)
      .order('name', { ascending: true });

    if (ptError) throw ptError;

    if (!partTimers || partTimers.length === 0) {
      return NextResponse.json({
        success: true,
        partTimers: [],
        summary: {
          totalPartTimers: 0,
          availableThisWeek: 0,
          unfilledShifts: 0,
          pendingSignups: 0,
        },
      });
    }

    const ptIds = partTimers.map(p => p.id);

    // 2. Get availability this week for all part-timers
    const { data: weekAvailability, error: avError } = await supabase
      .from('instructor_availability')
      .select('id, instructor_id, date, start_time, end_time, is_all_day')
      .in('instructor_id', ptIds)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);

    if (avError) throw avError;

    // 3. Get confirmed shift signups for part-timers
    const { data: confirmedSignups, error: csError } = await supabase
      .from('shift_signups')
      .select(`
        id,
        instructor_id,
        status,
        shift:shift_id(id, date, start_time, end_time, title)
      `)
      .in('instructor_id', ptIds)
      .eq('status', 'confirmed');

    if (csError) throw csError;

    // 4. Get pending shift signups for part-timers
    const { data: pendingSignups, error: psError } = await supabase
      .from('shift_signups')
      .select(`
        id,
        instructor_id,
        status,
        shift:shift_id(id, date, start_time, end_time, title)
      `)
      .in('instructor_id', ptIds)
      .eq('status', 'pending');

    if (psError) throw psError;

    // 5. Get unfilled shifts count this week
    const { data: weekShifts, error: wsError } = await supabase
      .from('open_shifts')
      .select(`
        id,
        max_instructors,
        signups:shift_signups(id, status)
      `)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr)
      .eq('is_cancelled', false);

    if (wsError) throw wsError;

    const unfilledShifts = (weekShifts || []).filter(s => {
      const confirmed = (s.signups || []).filter((su: { status: string }) => su.status === 'confirmed').length;
      return s.max_instructors ? confirmed < s.max_instructors : true; // open-ended shifts always count as unfilled
    }).length;

    // Build per-instructor data
    const availabilityByInstructor: Record<string, typeof weekAvailability> = {};
    for (const av of (weekAvailability || [])) {
      if (!availabilityByInstructor[av.instructor_id]) availabilityByInstructor[av.instructor_id] = [];
      availabilityByInstructor[av.instructor_id].push(av);
    }

    const confirmedByInstructor: Record<string, typeof confirmedSignups> = {};
    for (const cs of (confirmedSignups || [])) {
      if (!confirmedByInstructor[cs.instructor_id]) confirmedByInstructor[cs.instructor_id] = [];
      confirmedByInstructor[cs.instructor_id].push(cs);
    }

    const pendingByInstructor: Record<string, typeof pendingSignups> = {};
    for (const ps of (pendingSignups || [])) {
      if (!pendingByInstructor[ps.instructor_id]) pendingByInstructor[ps.instructor_id] = [];
      pendingByInstructor[ps.instructor_id].push(ps);
    }

    // Calculate monthly hours from confirmed signups
    const enrichedPartTimers = partTimers.map(pt => {
      const availability = availabilityByInstructor[pt.id] || [];
      const confirmed = confirmedByInstructor[pt.id] || [];
      const pending = pendingByInstructor[pt.id] || [];

      // Monthly hours: sum confirmed shift durations for this month
      let monthlyHours = 0;
      let lastShiftDate: string | null = null;

      for (const signup of confirmed) {
        const shift = signup.shift as unknown as { id: string; date: string; start_time: string; end_time: string; title: string } | null;
        if (!shift) continue;

        // Track last shift date
        if (!lastShiftDate || shift.date > lastShiftDate) {
          lastShiftDate = shift.date;
        }

        // Sum hours if within this month
        if (shift.date >= monthStart && shift.date <= monthEnd) {
          const [sH, sM] = shift.start_time.split(':').map(Number);
          const [eH, eM] = shift.end_time.split(':').map(Number);
          const hours = (eH + eM / 60) - (sH + sM / 60);
          if (hours > 0) monthlyHours += hours;
        }
      }

      return {
        id: pt.id,
        name: pt.name,
        email: pt.email,
        role: pt.role,
        availableThisWeek: availability.length,
        availabilityDates: availability.map(a => a.date),
        confirmedShifts: confirmed.length,
        pendingShifts: pending.length,
        monthlyHours: Math.round(monthlyHours * 10) / 10,
        lastShiftDate,
      };
    });

    // Instructors available this week (at least 1 availability entry)
    const availableThisWeek = enrichedPartTimers.filter(pt => pt.availableThisWeek > 0).length;
    const totalPendingSignups = enrichedPartTimers.reduce((sum, pt) => sum + pt.pendingShifts, 0);

    return NextResponse.json({
      success: true,
      partTimers: enrichedPartTimers,
      summary: {
        totalPartTimers: partTimers.length,
        availableThisWeek,
        unfilledShifts,
        pendingSignups: totalPendingSignups,
      },
    });
  } catch (error) {
    console.error('Error fetching part-timer status:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch part-timer status' }, { status: 500 });
  }
}
