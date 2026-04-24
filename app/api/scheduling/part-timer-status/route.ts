import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
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

    // Last-3-months window for the trend line. Month M = current month,
    // M-1 + M-2 are the two preceding full months. Keys are YYYY-MM so the
    // client can render them in order.
    const monthKeys: string[] = [];
    const monthRanges: Array<{ key: string; start: string; end: string }> = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const last = new Date(y, d.getMonth() + 1, 0).getDate();
      const key = `${y}-${m}`;
      monthKeys.push(key);
      monthRanges.push({
        key,
        start: `${key}-01`,
        end: `${key}-${String(last).padStart(2, '0')}`,
      });
    }
    const trendWindowStart = monthRanges[0].start;
    const trendWindowEnd = monthRanges[monthRanges.length - 1].end;

    // Semester boundary heuristic — no semester table exists for lab_users,
    // so we approximate using 6-month buckets: Jan-Jun = spring, Jul-Dec =
    // fall. Close enough for the aggregate hours goal and doesn't require
    // a cohort lookup per part-timer.
    const semesterStart =
      now.getMonth() < 6
        ? `${now.getFullYear()}-01-01`
        : `${now.getFullYear()}-07-01`;
    const semesterEnd =
      now.getMonth() < 6
        ? `${now.getFullYear()}-06-30`
        : `${now.getFullYear()}-12-31`;

    // Upcoming window = today through 60 days out. Captures scheduled but
    // not-yet-worked shifts so managers can see committed forward hours.
    const upcomingEnd = new Date(now);
    upcomingEnd.setDate(now.getDate() + 60);
    const upcomingEndStr = upcomingEnd.toISOString().split('T')[0];

    // 1. Get all part-time instructors (plus monthly_hours_target for the
    //    progress-bar column and unavailable_weekdays for the conflict badge).
    const { data: partTimers, error: ptError } = await supabase
      .from('lab_users')
      .select('id, name, email, role, is_part_time, monthly_hours_target, unavailable_weekdays, notify_lab_availability')
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

    // 6. Manual hour logs spanning the full semester window. One query
    //    covers both semester totals and the last-3-months trend.
    const { data: manualLogs } = await supabase
      .from('manual_hour_logs')
      .select('user_id, date, duration_minutes')
      .in('user_id', ptIds)
      .gte('date', semesterStart)
      .lte('date', semesterEnd);

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

    // Bucket manual hours per user × month key (YYYY-MM).
    const manualByUserMonth = new Map<string, Map<string, number>>(); // userId → month → minutes
    for (const row of manualLogs || []) {
      const userId = (row as { user_id: string }).user_id;
      const date = (row as { date: string }).date;
      const minutes = (row as { duration_minutes: number }).duration_minutes;
      const monthKey = date.slice(0, 7); // YYYY-MM
      if (!manualByUserMonth.has(userId)) manualByUserMonth.set(userId, new Map());
      const bucket = manualByUserMonth.get(userId)!;
      bucket.set(monthKey, (bucket.get(monthKey) ?? 0) + minutes);
    }

    // Calculate monthly hours + trend + semester total + upcoming scheduled.
    const enrichedPartTimers = partTimers.map(pt => {
      const availability = availabilityByInstructor[pt.id] || [];
      const confirmed = confirmedByInstructor[pt.id] || [];
      const pending = pendingByInstructor[pt.id] || [];

      // Shift-driven hours for each window.
      let monthlyShiftHours = 0;
      let semesterShiftHours = 0;
      let upcomingShiftHours = 0;
      let lastShiftDate: string | null = null;
      const shiftMonthHours: Record<string, number> = {}; // monthKey → hours (confirmed only)

      for (const signup of confirmed) {
        const shift = signup.shift as unknown as { id: string; date: string; start_time: string; end_time: string; title: string } | null;
        if (!shift) continue;

        // Track last shift date — confirmed signups only, any date.
        if (!lastShiftDate || shift.date > lastShiftDate) {
          lastShiftDate = shift.date;
        }

        const [sH, sM] = shift.start_time.split(':').map(Number);
        const [eH, eM] = shift.end_time.split(':').map(Number);
        const hours = (eH + eM / 60) - (sH + sM / 60);
        if (hours <= 0) continue;

        if (shift.date >= monthStart && shift.date <= monthEnd) {
          monthlyShiftHours += hours;
        }
        if (shift.date >= semesterStart && shift.date <= semesterEnd) {
          semesterShiftHours += hours;
        }
        if (shift.date >= todayStr && shift.date <= upcomingEndStr) {
          upcomingShiftHours += hours;
        }
        if (shift.date >= trendWindowStart && shift.date <= trendWindowEnd) {
          const mk = shift.date.slice(0, 7);
          shiftMonthHours[mk] = (shiftMonthHours[mk] ?? 0) + hours;
        }
      }

      // Manual log hours by month (minutes → hours).
      const manualByMonth = manualByUserMonth.get(pt.id) ?? new Map<string, number>();
      let manualSemesterHours = 0;
      let manualMonthlyHours = 0;
      for (const [mk, mins] of manualByMonth) {
        const hrs = mins / 60;
        manualSemesterHours += hrs;
        if (mk === monthStart.slice(0, 7)) manualMonthlyHours += hrs;
      }

      // Combined hours (confirmed shifts + manual logs) per month for trend.
      const trend = monthKeys.map((mk) => {
        const shiftH = shiftMonthHours[mk] ?? 0;
        const manualMin = manualByMonth.get(mk) ?? 0;
        return {
          month: mk,
          hours: Math.round((shiftH + manualMin / 60) * 10) / 10,
        };
      });

      const monthlyHours = monthlyShiftHours + manualMonthlyHours;
      const semesterHours = semesterShiftHours + manualSemesterHours;

      return {
        id: pt.id,
        name: pt.name,
        email: pt.email,
        role: pt.role,
        monthlyHoursTarget: pt.monthly_hours_target ?? null,
        unavailableWeekdays: pt.unavailable_weekdays ?? [],
        notifyLabAvailability: !!pt.notify_lab_availability,
        availableThisWeek: availability.length,
        availabilityDates: availability.map(a => a.date),
        confirmedShifts: confirmed.length,
        pendingShifts: pending.length,
        monthlyHours: Math.round(monthlyHours * 10) / 10,
        semesterHours: Math.round(semesterHours * 10) / 10,
        upcomingHours: Math.round(upcomingShiftHours * 10) / 10,
        manualMonthlyHours: Math.round(manualMonthlyHours * 10) / 10,
        trend,
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
