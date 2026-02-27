import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// POST /api/lab-management/cohorts/[id]/archive - Archive a cohort
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: cohortId } = await params;

  const supabase = getSupabaseAdmin();

  // Require admin+ role
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'admin')) {
    return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
  }

  try {
    // Fetch cohort details
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select(`
        id,
        cohort_number,
        start_date,
        expected_end_date,
        is_active,
        is_archived,
        archived_at,
        program:programs(id, name, abbreviation)
      `)
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    if (cohort.is_archived) {
      return NextResponse.json({ error: 'Cohort is already archived' }, { status: 400 });
    }

    // --- Build archive_summary JSONB ---

    // 1. Total students (all statuses)
    const { count: totalStudentsCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', cohortId);

    // 2. Active students list for detailed summary
    const { data: activeStudents } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, agency, status')
      .eq('cohort_id', cohortId)
      .order('last_name');

    const studentList = activeStudents || [];
    const studentIds = studentList.map(s => s.id);

    // 3. Total lab days for this cohort
    const { count: totalLabDays } = await supabase
      .from('lab_days')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', cohortId);

    // 4. Total scenarios assessed (scenario_assessments where team_lead is in cohort)
    let totalScenariosAssessed = 0;
    if (studentIds.length > 0) {
      const { count: scenarioCount } = await supabase
        .from('scenario_assessments')
        .select('*', { count: 'exact', head: true })
        .in('team_lead_id', studentIds);
      totalScenariosAssessed = scenarioCount || 0;
    }

    // 5. Total skills completed (station_completions with pass result)
    let totalSkillsCompleted = 0;
    if (studentIds.length > 0) {
      const { count: skillsCount } = await supabase
        .from('station_completions')
        .select('*', { count: 'exact', head: true })
        .in('student_id', studentIds)
        .eq('result', 'pass');
      totalSkillsCompleted = skillsCount || 0;
    }

    // 6. Attendance rate: present records / total attendance records
    let attendanceRate = 0;
    if (studentIds.length > 0) {
      const { data: attendanceData } = await supabase
        .from('lab_attendance')
        .select('status')
        .in('student_id', studentIds);

      if (attendanceData && attendanceData.length > 0) {
        const presentCount = attendanceData.filter(a => a.status === 'present').length;
        attendanceRate = Math.round((presentCount / attendanceData.length) * 100);
      }
    }

    // 7. Student list with completion status
    let studentsWithCompletion: Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      agency: string | null;
      status: string;
      skills_completed: number;
      scenarios_completed: number;
    }> = [];

    if (studentIds.length > 0) {
      // Skills per student
      const { data: completionsData } = await supabase
        .from('station_completions')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('result', 'pass');

      const skillsByStudent: Record<string, number> = {};
      (completionsData || []).forEach(c => {
        skillsByStudent[c.student_id] = (skillsByStudent[c.student_id] || 0) + 1;
      });

      // Scenarios per student
      const { data: scenariosData } = await supabase
        .from('scenario_assessments')
        .select('team_lead_id')
        .in('team_lead_id', studentIds);

      const scenariosByStudent: Record<string, number> = {};
      (scenariosData || []).forEach(sa => {
        scenariosByStudent[sa.team_lead_id] = (scenariosByStudent[sa.team_lead_id] || 0) + 1;
      });

      studentsWithCompletion = studentList.map(s => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        email: s.email,
        agency: s.agency,
        status: s.status,
        skills_completed: skillsByStudent[s.id] || 0,
        scenarios_completed: scenariosByStudent[s.id] || 0,
      }));
    }

    // Build the cohort data from the fetched cohort
    const cohortData = cohort as any;
    const programData = cohortData.program;

    const archiveSummary = {
      cohort_name: programData
        ? `${programData.abbreviation} Group ${cohort.cohort_number}`
        : `Group ${cohort.cohort_number}`,
      program: programData
        ? { id: programData.id, name: programData.name, abbreviation: programData.abbreviation }
        : null,
      start_date: cohort.start_date,
      expected_end_date: cohort.expected_end_date,
      completion_date: new Date().toISOString().split('T')[0],
      total_students: totalStudentsCount || 0,
      total_lab_days: totalLabDays || 0,
      total_scenarios_assessed: totalScenariosAssessed,
      total_skills_completed: totalSkillsCompleted,
      attendance_rate: attendanceRate,
      students: studentsWithCompletion,
    };

    // Archive the cohort
    const { data: updatedCohort, error: updateError } = await supabase
      .from('cohorts')
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: session.user.email,
        archive_summary: archiveSummary,
        is_active: false,
      })
      .eq('id', cohortId)
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      cohort: updatedCohort,
      archive_summary: archiveSummary,
    });
  } catch (error) {
    console.error('Error archiving cohort:', error);
    const message = error instanceof Error ? error.message : 'Failed to archive cohort';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/lab-management/cohorts/[id]/archive - Unarchive a cohort
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: cohortId } = await params;

  const supabase = getSupabaseAdmin();

  // Require admin+ role
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'admin')) {
    return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
  }

  try {
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, is_archived, archived_at')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    if (!cohort.is_archived) {
      return NextResponse.json({ error: 'Cohort is not archived' }, { status: 400 });
    }

    const { data: updatedCohort, error: updateError } = await supabase
      .from('cohorts')
      .update({
        is_archived: false,
        archived_at: null,
        archived_by: null,
        archive_summary: null,
      })
      .eq('id', cohortId)
      .select(`
        *,
        program:programs(id, name, abbreviation)
      `)
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      cohort: updatedCohort,
    });
  } catch (error) {
    console.error('Error unarchiving cohort:', error);
    const message = error instanceof Error ? error.message : 'Failed to unarchive cohort';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
