import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Require lead_instructor minimum role
    const { data: requestingUser } = await supabase
      .from('lab_users')
      .select('role')
      .eq('email', session.user.email)
      .single();

    if (!requestingUser || !hasMinRole(requestingUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '6months'; // '3months' | '6months' | '12months' | 'all'

    // Calculate date cutoff based on range
    const now = new Date();
    let cutoffDate: string | null = null;
    if (range === '3months') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      cutoffDate = d.toISOString().split('T')[0];
    } else if (range === '6months') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      cutoffDate = d.toISOString().split('T')[0];
    } else if (range === '12months') {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      cutoffDate = d.toISOString().split('T')[0];
    }
    // 'all' leaves cutoffDate null

    // Fetch all instructors (lead_instructor, instructor, admin, superadmin)
    const { data: instructors, error: instructorsError } = await supabase
      .from('lab_users')
      .select('id, name, email, role')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin', 'volunteer_instructor'])
      .eq('is_active', true)
      .order('name');

    if (instructorsError) throw instructorsError;

    const instructorList = instructors || [];

    // Build a user_id -> instructor lookup
    const instructorById: Record<string, { id: string; name: string; email: string; role: string }> = {};
    instructorList.forEach((inst) => {
      instructorById[inst.id] = inst;
    });

    // Fetch instructor_availability data
    let availQuery = supabase
      .from('instructor_availability')
      .select('id, user_id, week_start, day_of_week, is_available, created_at');

    if (cutoffDate) {
      availQuery = availQuery.gte('week_start', cutoffDate);
    }

    const { data: availRows, error: availError } = await availQuery;

    if (availError) {
      console.error('Error fetching instructor_availability:', availError);
      return NextResponse.json({ success: false, error: 'Failed to fetch availability data' }, { status: 500 });
    }

    const rows = availRows || [];

    // ── 1. Day-of-week distribution ──────────────────────────────────────────
    // For each day: count unique instructors available per week, then average
    // Structure: day -> week_start -> Set<user_id>
    const dayWeekMap: Record<string, Record<string, Set<string>>> = {};
    DAY_ORDER.forEach((d) => { dayWeekMap[d] = {}; });

    rows.forEach((row) => {
      if (!row.is_available) return;
      const day = (row.day_of_week || '').toLowerCase();
      if (!DAY_ORDER.includes(day)) return;
      if (!dayWeekMap[day][row.week_start]) {
        dayWeekMap[day][row.week_start] = new Set();
      }
      dayWeekMap[day][row.week_start].add(row.user_id);
    });

    const dayDistribution = DAY_ORDER.map((day) => {
      const weekEntries = Object.values(dayWeekMap[day]);
      if (weekEntries.length === 0) {
        return { day, label: DAY_LABELS[day], avgInstructors: 0, weekCount: 0 };
      }
      const totalInstructors = weekEntries.reduce((sum, s) => sum + s.size, 0);
      const avg = totalInstructors / weekEntries.length;
      return {
        day,
        label: DAY_LABELS[day],
        avgInstructors: Math.round(avg * 10) / 10,
        weekCount: weekEntries.length,
      };
    });

    // ── 2. Coverage gaps ─────────────────────────────────────────────────────
    const coverageGaps = dayDistribution.map((d) => ({
      ...d,
      isGap: d.avgInstructors > 0 && d.avgInstructors < 2,
      hasNoData: d.avgInstructors === 0,
    }));

    // ── 3. Summary stats ─────────────────────────────────────────────────────
    const daysWithData = dayDistribution.filter((d) => d.weekCount > 0);
    const avgInstructorsPerDay =
      daysWithData.length > 0
        ? Math.round((daysWithData.reduce((sum, d) => sum + d.avgInstructors, 0) / daysWithData.length) * 10) / 10
        : 0;

    const sortedByAvg = [...dayDistribution].filter((d) => d.weekCount > 0).sort((a, b) => b.avgInstructors - a.avgInstructors);
    const mostAvailableDay = sortedByAvg.length > 0 ? sortedByAvg[0] : null;
    const leastAvailableDay = sortedByAvg.length > 0 ? sortedByAvg[sortedByAvg.length - 1] : null;

    // ── 4. Submission consistency ─────────────────────────────────────────────
    // For each instructor: count distinct weeks where they submitted at least one available day
    // Total possible weeks = distinct weeks in the data
    const allWeeks = new Set<string>();
    rows.forEach((row) => allWeeks.add(row.week_start));
    const totalWeeks = allWeeks.size;

    // Per instructor: set of weeks submitted (regardless of is_available value — submission = at least one row that week)
    const instructorWeeks: Record<string, Set<string>> = {};
    rows.forEach((row) => {
      if (!instructorWeeks[row.user_id]) {
        instructorWeeks[row.user_id] = new Set();
      }
      instructorWeeks[row.user_id].add(row.week_start);
    });

    // Last submission date per instructor
    const instructorLastSubmission: Record<string, string> = {};
    rows.forEach((row) => {
      const existing = instructorLastSubmission[row.user_id];
      if (!existing || row.created_at > existing) {
        instructorLastSubmission[row.user_id] = row.created_at;
      }
    });

    const submissionConsistency = instructorList
      .map((inst) => {
        const weeksSubmitted = (instructorWeeks[inst.id]?.size) || 0;
        const consistencyRate =
          totalWeeks > 0 ? Math.round((weeksSubmitted / totalWeeks) * 100) : 0;
        const lastSubmission = instructorLastSubmission[inst.id] || null;
        return {
          id: inst.id,
          name: inst.name,
          email: inst.email,
          role: inst.role,
          weeksSubmitted,
          totalWeeks,
          consistencyRate,
          lastSubmission,
        };
      })
      .sort((a, b) => b.consistencyRate - a.consistencyRate);

    // ── 5. Monthly trends ─────────────────────────────────────────────────────
    // Count unique submitters per calendar month for the last 6 months (or range)
    // Use week_start date to bucket into months
    const monthlyMap: Record<string, Set<string>> = {}; // 'YYYY-MM' -> Set<user_id>

    rows.forEach((row) => {
      const monthKey = row.week_start.substring(0, 7); // 'YYYY-MM'
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = new Set();
      }
      monthlyMap[monthKey].add(row.user_id);
    });

    // Build a list of months to show (last 6 months up to current month for default)
    const monthsToShow: string[] = [];
    const monthCount = range === '3months' ? 3 : range === '12months' ? 12 : range === 'all' ? 12 : 6;
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsToShow.push(key);
    }

    const monthlyTrends = monthsToShow.map((monthKey) => {
      const submitters = monthlyMap[monthKey]?.size || 0;
      const [year, month] = monthKey.split('-');
      const label = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      });
      return { monthKey, label, submitterCount: submitters };
    });

    // Active instructor count = instructors with at least one submission
    const activeInstructorCount = Object.values(instructorWeeks).filter((s) => s.size > 0).length;

    return NextResponse.json({
      success: true,
      dateRange: { cutoff: cutoffDate, range },
      summary: {
        avgInstructorsPerDay,
        mostAvailableDay,
        leastAvailableDay,
        totalActiveInstructors: activeInstructorCount,
        totalInstructors: instructorList.length,
        totalWeeks,
      },
      dayDistribution,
      coverageGaps,
      monthlyTrends,
      submissionConsistency,
    });
  } catch (error) {
    console.error('Error generating availability patterns report:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
