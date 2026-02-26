import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRanges(period: string) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Current period boundaries
  let currentStart: string;
  let currentEnd: string = todayStr;

  // Previous period boundaries (for delta comparison)
  let prevStart: string;
  let prevEnd: string;

  if (period === 'month') {
    // This month
    const y = now.getFullYear();
    const m = now.getMonth();
    currentStart = new Date(y, m, 1).toISOString().split('T')[0];
    currentEnd = new Date(y, m + 1, 0).toISOString().split('T')[0];
    // Last month
    prevStart = new Date(y, m - 1, 1).toISOString().split('T')[0];
    prevEnd = new Date(y, m, 0).toISOString().split('T')[0];
  } else if (period === 'semester') {
    // Determine current semester: Spring = Jan-May, Summer = Jun-Jul, Fall = Aug-Dec
    const m = now.getMonth(); // 0-indexed
    const y = now.getFullYear();
    let semStart: Date;
    let semEnd: Date;
    let prevSemStart: Date;
    let prevSemEnd: Date;
    if (m >= 7) {
      // Fall semester: Aug-Dec
      semStart = new Date(y, 7, 1);
      semEnd = new Date(y, 11, 31);
      prevSemStart = new Date(y, 5, 1);
      prevSemEnd = new Date(y, 6, 31);
    } else if (m >= 5) {
      // Summer: Jun-Jul
      semStart = new Date(y, 5, 1);
      semEnd = new Date(y, 6, 31);
      prevSemStart = new Date(y, 0, 1);
      prevSemEnd = new Date(y, 4, 31);
    } else {
      // Spring: Jan-May
      semStart = new Date(y, 0, 1);
      semEnd = new Date(y, 4, 31);
      prevSemStart = new Date(y - 1, 7, 1);
      prevSemEnd = new Date(y - 1, 11, 31);
    }
    currentStart = semStart.toISOString().split('T')[0];
    currentEnd = semEnd.toISOString().split('T')[0];
    prevStart = prevSemStart.toISOString().split('T')[0];
    prevEnd = prevSemEnd.toISOString().split('T')[0];
  } else if (period === 'year') {
    const y = now.getFullYear();
    currentStart = `${y}-01-01`;
    currentEnd = `${y}-12-31`;
    prevStart = `${y - 1}-01-01`;
    prevEnd = `${y - 1}-12-31`;
  } else {
    // all time - no date filter; prev doesn't apply
    currentStart = '2000-01-01';
    currentEnd = '2099-12-31';
    prevStart = '2000-01-01';
    prevEnd = '2000-01-01';
  }

  return { currentStart, currentEnd, prevStart, prevEnd };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the user exists and has instructor+ role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role, name, email')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!hasMinRole(currentUser.role, 'instructor')) {
      return NextResponse.json({ success: false, error: 'Instructor role required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month'; // month | semester | year | all

    const { currentStart, currentEnd, prevStart, prevEnd } = getDateRanges(period);

    // ── 1. Fetch lab_day_roles for this instructor (all time, for monthly chart) ──
    const { data: allRoles } = await supabase
      .from('lab_day_roles')
      .select(`
        id,
        role,
        lab_day:lab_days(id, date, start_time, end_time, title, week_number, day_number, cohort:cohorts(id, cohort_number, program:programs(abbreviation)))
      `)
      .eq('instructor_id', currentUser.id)
      .order('created_at', { ascending: false });

    const safeRoles = (allRoles || []) as any[];

    // Helper: extract a lab_day entry safely
    const extractLabDay = (r: any) =>
      Array.isArray(r.lab_day) ? r.lab_day[0] : r.lab_day;

    // ── 2. Filter roles for current period and previous period ──
    const currentRoles = safeRoles.filter((r) => {
      const d = extractLabDay(r)?.date;
      return d && d >= currentStart && d <= currentEnd;
    });

    const prevRoles = safeRoles.filter((r) => {
      const d = extractLabDay(r)?.date;
      return d && d >= prevStart && d <= prevEnd;
    });

    // ── 3. Compute hours from lab_day start_time / end_time ──
    function computeHoursFromRoles(roles: any[]): number {
      return roles.reduce((total, r) => {
        const ld = extractLabDay(r);
        if (!ld) return total;
        if (ld.start_time && ld.end_time) {
          // Times stored as "HH:MM" or "HH:MM:SS"
          const parseTime = (t: string) => {
            const parts = t.split(':').map(Number);
            return parts[0] * 60 + (parts[1] || 0);
          };
          const diff = parseTime(ld.end_time) - parseTime(ld.start_time);
          return total + Math.max(0, diff / 60);
        }
        // Default 8 hours per lab day
        return total + 8;
      }, 0);
    }

    const currentHours = computeHoursFromRoles(currentRoles);
    const prevHours = computeHoursFromRoles(prevRoles);

    // ── 4. Student ratings ──
    // Get ratings received by this instructor (by email)
    const { data: allRatings } = await supabase
      .from('student_lab_ratings')
      .select(`
        id,
        rating,
        lab_day_id,
        lab_day:lab_days(date)
      `)
      .eq('instructor_email', currentUser.email);

    const safeRatings = (allRatings || []) as any[];

    const currentRatingRows = safeRatings.filter((r) => {
      const d = Array.isArray(r.lab_day) ? r.lab_day[0]?.date : r.lab_day?.date;
      return d && d >= currentStart && d <= currentEnd;
    });

    const prevRatingRows = safeRatings.filter((r) => {
      const d = Array.isArray(r.lab_day) ? r.lab_day[0]?.date : r.lab_day?.date;
      return d && d >= prevStart && d <= prevEnd;
    });

    function computeRatingStats(rows: any[]) {
      if (rows.length === 0) return { avg: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
      const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
      let sum = 0;
      for (const r of rows) {
        const v = r.rating as number;
        sum += v;
        if (v >= 1 && v <= 5) dist[v]++;
      }
      return { avg: Math.round((sum / rows.length) * 10) / 10, count: rows.length, distribution: dist };
    }

    const currentRatingStats = computeRatingStats(currentRatingRows);
    const prevRatingStats = computeRatingStats(prevRatingRows);

    // ── 5. Monthly activity for last 6 months (always use allRoles) ──
    const now = new Date();
    const monthlyActivity: Array<{ month: string; label: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const count = safeRoles.filter((r) => {
        const date = extractLabDay(r)?.date;
        return date && date >= monthStart && date <= monthEnd;
      }).length;
      monthlyActivity.push({
        month: monthStart.slice(0, 7), // "YYYY-MM"
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count,
      });
    }

    // ── 6. Recent labs (last 10) ──
    // Get labs in current period, sorted by date desc
    const recentRoles = [...currentRoles]
      .sort((a, b) => {
        const da = extractLabDay(a)?.date || '';
        const db = extractLabDay(b)?.date || '';
        return db.localeCompare(da);
      })
      .slice(0, 10);

    // For each recent lab day, fetch average rating given by all instructors on that lab
    const recentLabDayIds = Array.from(
      new Set(recentRoles.map((r) => extractLabDay(r)?.id).filter(Boolean))
    );

    // Build a rating-by-lab-day lookup (average rating for that lab day)
    type RatingByDay = Record<string, number | null>;
    const ratingByDay: RatingByDay = {};

    if (recentLabDayIds.length > 0) {
      const { data: labRatings } = await supabase
        .from('student_lab_ratings')
        .select('lab_day_id, rating')
        .in('lab_day_id', recentLabDayIds)
        .eq('instructor_email', currentUser.email);

      for (const ldId of recentLabDayIds) {
        const forDay = (labRatings || []).filter((r: any) => r.lab_day_id === ldId);
        if (forDay.length > 0) {
          const avg = forDay.reduce((s: number, r: any) => s + r.rating, 0) / forDay.length;
          ratingByDay[ldId as string] = Math.round(avg * 10) / 10;
        } else {
          ratingByDay[ldId as string] = null;
        }
      }
    }

    const recentLabs = recentRoles.map((r) => {
      const ld = extractLabDay(r);
      const cohort = ld ? (Array.isArray(ld.cohort) ? ld.cohort[0] : ld.cohort) : null;
      const program = cohort ? (Array.isArray(cohort.program) ? cohort.program[0] : cohort.program) : null;

      let durationHours = 8;
      if (ld?.start_time && ld?.end_time) {
        const parseTime = (t: string) => {
          const parts = t.split(':').map(Number);
          return parts[0] * 60 + (parts[1] || 0);
        };
        durationHours = Math.max(0, (parseTime(ld.end_time) - parseTime(ld.start_time)) / 60);
      }

      const labTitle = ld?.title ||
        (ld?.week_number && ld?.day_number ? `Week ${ld.week_number} Day ${ld.day_number}` :
          ld?.week_number ? `Week ${ld.week_number}` :
            ld?.day_number ? `Day ${ld.day_number}` : 'Lab Day');

      return {
        lab_day_id: ld?.id || null,
        date: ld?.date || null,
        title: labTitle,
        cohort_number: cohort?.cohort_number || null,
        program: program?.abbreviation || null,
        duration_hours: durationHours,
        avg_rating: ld?.id ? ratingByDay[ld.id] ?? null : null,
        role: r.role,
      };
    });

    // ── 7. Build response ──
    const deltaLabs = currentRoles.length - prevRoles.length;
    const deltaHours = Math.round((currentHours - prevHours) * 10) / 10;
    const deltaRating =
      currentRatingStats.avg !== null && prevRatingStats.avg !== null
        ? Math.round((currentRatingStats.avg - prevRatingStats.avg) * 10) / 10
        : null;

    return NextResponse.json({
      success: true,
      period,
      stats: {
        labs: {
          current: currentRoles.length,
          previous: prevRoles.length,
          delta: deltaLabs,
        },
        hours: {
          current: Math.round(currentHours * 10) / 10,
          previous: Math.round(prevHours * 10) / 10,
          delta: deltaHours,
        },
        ratings: {
          current: currentRatingStats,
          previous: prevRatingStats,
          delta: deltaRating,
        },
        skills: {
          current: 0,
          previous: 0,
          delta: 0,
        },
      },
      monthlyActivity,
      recentLabs,
    });
  } catch (error) {
    console.error('Error fetching instructor stats:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
