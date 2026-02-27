import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const limitParam = Math.min(parseInt(searchParams.get('limit') || '5'), 20);

    if (q.length < 2) {
      return NextResponse.json({
        results: {
          students: [],
          scenarios: [],
          tasks: [],
          labDays: [],
          instructors: [],
        },
        totalCount: 0,
      });
    }

    // Sanitize to prevent PostgREST filter injection
    const safe = q.replace(/[%_,.()\\/]/g, '');

    if (!safe) {
      return NextResponse.json({
        results: {
          students: [],
          scenarios: [],
          tasks: [],
          labDays: [],
          instructors: [],
        },
        totalCount: 0,
      });
    }

    const supabase = getSupabaseAdmin();

    // Run all searches in parallel
    const [studentsRes, scenariosRes, tasksRes, labDaysRes, instructorsRes] = await Promise.all([
      // Students - search first_name, last_name, email; join cohort name
      supabase
        .from('students')
        .select('id, first_name, last_name, email, cohort_id, cohort:cohorts(id, name)')
        .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`)
        .limit(limitParam),

      // Scenarios - search title, chief_complaint, category; include difficulty
      supabase
        .from('scenarios')
        .select('id, title, chief_complaint, category, difficulty')
        .eq('is_active', true)
        .or(`title.ilike.%${safe}%,chief_complaint.ilike.%${safe}%,category.ilike.%${safe}%`)
        .limit(limitParam),

      // Tasks - search title, description
      supabase
        .from('instructor_tasks')
        .select('id, title, status, priority, due_date')
        .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
        .limit(limitParam),

      // Lab Days - search title, notes; join cohort name
      supabase
        .from('lab_days')
        .select('id, date, title, cohort_id, status, cohort:cohorts(id, name)')
        .or(`title.ilike.%${safe}%,notes.ilike.%${safe}%`)
        .order('date', { ascending: false })
        .limit(limitParam),

      // Instructors - search lab_users with instructor+ roles
      // lab_users has a 'name' field (not split first/last)
      supabase
        .from('lab_users')
        .select('id, name, email, role')
        .in('role', ['instructor', 'lead_instructor', 'admin', 'superadmin', 'volunteer_instructor'])
        .or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
        .limit(limitParam),
    ]);

    // Shape results into consistent format
    type CohortRow = { id: string; name: string } | null;

    const students = (studentsRes.data || []).map((s) => {
      const cohortRow = s.cohort as CohortRow | CohortRow[];
      const cohortName = Array.isArray(cohortRow)
        ? (cohortRow[0]?.name ?? null)
        : (cohortRow?.name ?? null);
      return {
        id: s.id,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        email: s.email || '',
        cohortName: cohortName || null,
        type: 'student' as const,
      };
    });

    const scenarios = (scenariosRes.data || []).map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category || null,
      chiefComplaint: s.chief_complaint || null,
      difficulty: s.difficulty || null,
      type: 'scenario' as const,
    }));

    const tasks = (tasksRes.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority || null,
      type: 'task' as const,
    }));

    const labDays = (labDaysRes.data || []).map((l) => {
      const cohortRow = l.cohort as CohortRow | CohortRow[];
      const cohortName = Array.isArray(cohortRow)
        ? (cohortRow[0]?.name ?? null)
        : (cohortRow?.name ?? null);
      return {
        id: l.id,
        date: l.date,
        title: l.title || null,
        status: l.status || null,
        cohortName: cohortName || null,
        type: 'lab_day' as const,
      };
    });

    const instructors = (instructorsRes.data || []).map((u) => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      role: u.role,
      type: 'instructor' as const,
    }));

    const totalCount =
      students.length +
      scenarios.length +
      tasks.length +
      labDays.length +
      instructors.length;

    return NextResponse.json({
      results: {
        students,
        scenarios,
        tasks,
        labDays,
        instructors,
      },
      totalCount,
    });
  } catch (error) {
    console.error('Error in global search:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
