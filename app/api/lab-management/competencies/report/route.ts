import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

const LEVELS = ['introduced', 'practiced', 'competent', 'proficient'] as const;
type Level = typeof LEVELS[number];

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as { role?: string }).role || 'guest';
  if (!hasMinRole(userRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohort_id');
  const skillCategory = searchParams.get('category');

  if (!cohortId) {
    return NextResponse.json({ success: false, error: 'cohort_id is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get cohort info
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, program:programs(name, abbreviation)')
      .eq('id', cohortId)
      .single();

    if (cohortError) throw cohortError;

    // Get active students in cohort
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('cohort_id', cohortId)
      .eq('status', 'active')
      .order('last_name');

    if (studentsError) throw studentsError;

    const totalStudents = students?.length ?? 0;

    if (totalStudents === 0) {
      return NextResponse.json({
        success: true,
        report: {
          cohort,
          totalStudents: 0,
          skills: [],
          overallReadinessScore: 0,
        },
      });
    }

    // Get active skills
    let skillsQuery = supabase
      .from('skills')
      .select('id, name, category')
      .eq('is_active', true)
      .order('display_order')
      .order('name');

    if (skillCategory) {
      skillsQuery = skillsQuery.eq('category', skillCategory);
    }

    const { data: skills, error: skillsError } = await skillsQuery;
    if (skillsError) throw skillsError;

    if (!skills || skills.length === 0) {
      return NextResponse.json({
        success: true,
        report: {
          cohort,
          totalStudents,
          skills: [],
          overallReadinessScore: 0,
        },
      });
    }

    // Get all competency records for these students
    const studentIds = students!.map((s: { id: string }) => s.id);
    const { data: competencies, error: compError } = await supabase
      .from('skill_competencies')
      .select('student_id, skill_id, level, demonstrations')
      .in('student_id', studentIds);

    if (compError) throw compError;

    // Build a lookup: compMap[student_id][skill_id] = level
    const compMap: Record<string, Record<string, Level>> = {};
    for (const comp of competencies ?? []) {
      if (!compMap[comp.student_id]) compMap[comp.student_id] = {};
      compMap[comp.student_id][comp.skill_id] = comp.level as Level;
    }

    // Aggregate per skill
    const skillReports = skills.map((skill: { id: string; name: string; category: string }) => {
      const levelCounts: Record<Level, number> = {
        introduced: 0,
        practiced: 0,
        competent: 0,
        proficient: 0,
      };
      let untracked = 0;

      for (const student of students!) {
        const level = compMap[student.id]?.[skill.id];
        if (level && LEVELS.includes(level)) {
          levelCounts[level]++;
        } else {
          untracked++;
        }
      }

      const levelPercentages: Record<Level, number> = {
        introduced: Math.round((levelCounts.introduced / totalStudents) * 100),
        practiced: Math.round((levelCounts.practiced / totalStudents) * 100),
        competent: Math.round((levelCounts.competent / totalStudents) * 100),
        proficient: Math.round((levelCounts.proficient / totalStudents) * 100),
      };

      // Readiness score: weight by level (introduced=1, practiced=2, competent=3, proficient=4)
      // Max possible = totalStudents * 4
      const weightedSum =
        levelCounts.introduced * 1 +
        levelCounts.practiced * 2 +
        levelCounts.competent * 3 +
        levelCounts.proficient * 4;
      const readinessScore = totalStudents > 0
        ? Math.round((weightedSum / (totalStudents * 4)) * 100)
        : 0;

      return {
        skill_id: skill.id,
        skill_name: skill.name,
        skill_category: skill.category,
        totalStudents,
        untracked,
        levelCounts,
        levelPercentages,
        readinessScore,
      };
    });

    // Overall cohort readiness = average of all skill readiness scores
    const overallReadinessScore =
      skillReports.length > 0
        ? Math.round(
            skillReports.reduce((sum: number, s: { readinessScore: number }) => sum + s.readinessScore, 0) /
              skillReports.length
          )
        : 0;

    return NextResponse.json({
      success: true,
      report: {
        cohort,
        totalStudents,
        skills: skillReports,
        overallReadinessScore,
      },
    });
  } catch (err) {
    console.error('Error generating competency report:', err);
    return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
  }
}
