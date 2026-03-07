import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('lead_instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // 1. Fetch all instructors
    const { data: instructors } = await supabase
      .from('lab_users')
      .select('id, name, email, role, is_active')
      .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin', 'volunteer_instructor'])
      .eq('is_active', true)
      .order('name');

    const instructorList = instructors || [];
    const instructorMap = new Map(instructorList.map((i) => [i.id, i]));

    // 2. Fetch lab day assignments (lab_day_roles or direct instructor links)
    // Check for lab_day_roles table first, fall back to lab_days.instructor_ids
    let labDayAssignments: { instructor_id: string; lab_day_id: string }[] = [];

    const { data: labDayRoles, error: rolesError } = await supabase
      .from('lab_day_roles')
      .select('user_id, lab_day_id, lab_day:lab_days(date)');

    if (!rolesError && labDayRoles) {
      // Filter by date range
      labDayAssignments = (labDayRoles as any[])
        .filter((r) => {
          const labDay = Array.isArray(r.lab_day) ? r.lab_day[0] : r.lab_day;
          const date = labDay?.date;
          if (!date) return true;
          if (startDate && date < startDate) return false;
          if (endDate && date > endDate) return false;
          return true;
        })
        .map((r) => ({
          instructor_id: r.user_id,
          lab_day_id: r.lab_day_id,
        }));
    }

    // 3. Count lab day assignments per instructor
    const teachingDays: Record<string, Set<string>> = {};
    labDayAssignments.forEach(({ instructor_id, lab_day_id }) => {
      if (!teachingDays[instructor_id]) {
        teachingDays[instructor_id] = new Set();
      }
      teachingDays[instructor_id].add(lab_day_id);
    });

    // Estimate hours: assume 8 hours per lab day
    const HOURS_PER_LAB_DAY = 8;

    // 4. Fetch evaluation counts (scenario_assessments by evaluator)
    let evalsQuery = supabase
      .from('scenario_assessments')
      .select('id, evaluator_id, created_at');

    const { data: evaluations } = await evalsQuery;

    const evalsByInstructor: Record<string, number> = {};
    let totalEvals = 0;
    (evaluations || []).forEach((e: any) => {
      if (!e.evaluator_id) return;
      // Filter by date if needed
      if (startDate && e.created_at && e.created_at < startDate) return;
      if (endDate && e.created_at && e.created_at > `${endDate}T23:59:59`) return;
      evalsByInstructor[e.evaluator_id] = (evalsByInstructor[e.evaluator_id] || 0) + 1;
      totalEvals++;
    });

    // 5. Build teaching hours array
    const teachingHours = instructorList.map((instructor) => {
      const days = teachingDays[instructor.id]?.size || 0;
      const hours = days * HOURS_PER_LAB_DAY;
      const evals = evalsByInstructor[instructor.id] || 0;
      return {
        id: instructor.id,
        name: instructor.name,
        role: instructor.role,
        lab_days: days,
        hours,
        evaluations: evals,
      };
    });

    // 6. Workload summary stats
    const hoursArr = teachingHours.map((t) => t.hours).filter((h) => h > 0);
    const sortedHours = [...hoursArr].sort((a, b) => a - b);
    const mean =
      hoursArr.length > 0 ? Math.round(hoursArr.reduce((a, b) => a + b, 0) / hoursArr.length) : 0;
    const median =
      sortedHours.length > 0
        ? sortedHours.length % 2 === 0
          ? Math.round((sortedHours[sortedHours.length / 2 - 1] + sortedHours[sortedHours.length / 2]) / 2)
          : sortedHours[Math.floor(sortedHours.length / 2)]
        : 0;
    const max = sortedHours.length > 0 ? sortedHours[sortedHours.length - 1] : 0;

    const response = NextResponse.json({
      success: true,
      teaching_hours: teachingHours.sort((a, b) => b.hours - a.hours),
      total_instructors: instructorList.length,
      total_evaluations: totalEvals,
      workload: {
        mean,
        median,
        max,
      },
    });

    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('Error generating instructor analytics report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
