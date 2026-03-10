import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessLVFR, isLVFRStudent } from '@/lib/permissions';

/**
 * GET /api/lvfr-aemt/dashboard
 *
 * Returns aggregated dashboard data for the LVFR AEMT program.
 * Available to instructors, agency roles, and LVFR students.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  // Check LVFR access
  if (!canAccessLVFR(user.role) && !isLVFRStudent(user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Course progress — chapters completed
    const { data: chapters } = await supabase
      .from('lvfr_aemt_chapters')
      .select('id, status');

    const totalChapters = chapters?.length || 0;
    const completedChapters = chapters?.filter(c => c.status === 'completed').length || 0;

    // 2. Course days completed
    const { data: days } = await supabase
      .from('lvfr_aemt_course_days')
      .select('id, day_number, date, status, has_exam, has_quiz, has_lab, title, module_id')
      .order('day_number', { ascending: true });

    const totalDays = days?.length || 0;
    const completedDays = days?.filter(d => d.status === 'completed').length || 0;

    // Pace calculation — compare scheduled-through-today vs completed
    const scheduledThroughToday = days?.filter(d => d.date && d.date <= today).length || 0;
    let paceStatus: 'on_track' | 'slightly_behind' | 'behind' = 'on_track';
    if (scheduledThroughToday > 0) {
      const ratio = completedDays / scheduledThroughToday;
      if (ratio < 0.7) paceStatus = 'behind';
      else if (ratio < 0.9) paceStatus = 'slightly_behind';
    }

    // 3. Coverage gaps (instructor view)
    let totalGaps = 0;
    let nextGapDay: number | null = null;
    let nextGapDate: string | null = null;

    const { data: assignments } = await supabase
      .from('lvfr_aemt_instructor_assignments')
      .select('day_number, date, primary_instructor_id');

    if (assignments && days) {
      for (const day of days) {
        if (day.date && day.date >= today) {
          const assignment = assignments.find(a => a.day_number === day.day_number);
          if (!assignment?.primary_instructor_id) {
            totalGaps++;
            if (!nextGapDay) {
              nextGapDay = day.day_number;
              nextGapDate = day.date;
            }
          }
        }
      }
    }

    // 4. Student stats
    // Get students in LVFR cohort(s) — look for cohorts with 'LVFR' or 'AEMT' in name
    const { data: lvfrCohorts } = await supabase
      .from('cohorts')
      .select('id')
      .or('cohort_number.ilike.%LVFR%,cohort_number.ilike.%AEMT%');

    const cohortIds = lvfrCohorts?.map(c => c.id) || [];
    let totalStudents = 0;
    let atRiskCount = 0;
    let avgGrade: number | null = null;

    if (cohortIds.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, status')
        .in('cohort_id', cohortIds)
        .eq('status', 'active');

      totalStudents = students?.length || 0;

      // Get grade averages
      if (totalStudents > 0) {
        const studentIds = students!.map(s => s.id);
        const { data: grades } = await supabase
          .from('lvfr_aemt_grades')
          .select('student_id, score_percent')
          .in('student_id', studentIds);

        if (grades && grades.length > 0) {
          const sum = grades.reduce((acc, g) => acc + (Number(g.score_percent) || 0), 0);
          avgGrade = sum / grades.length;

          // At-risk: students with avg below 80%
          const studentAvgs = new Map<string, number[]>();
          for (const g of grades) {
            const arr = studentAvgs.get(g.student_id) || [];
            arr.push(Number(g.score_percent) || 0);
            studentAvgs.set(g.student_id, arr);
          }
          for (const [, scores] of studentAvgs) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avg < 80) atRiskCount++;
          }
        }
      }
    }

    // 5. Upcoming assessments
    const upcomingAssessments = (days || [])
      .filter(d => d.date && d.date >= today && (d.has_exam || d.has_quiz))
      .slice(0, 5)
      .map(d => ({
        id: d.id,
        title: d.title || `Day ${d.day_number}`,
        date: d.date,
        category: d.has_exam ? 'exam' : 'quiz',
      }));

    // 6. Recent grades (last 5 across all students)
    const { data: recentGrades } = await supabase
      .from('lvfr_aemt_grades')
      .select('assessment_id, date_taken, score_percent, passed, assessment:lvfr_aemt_assessments!lvfr_aemt_grades_assessment_id_fkey(title)')
      .order('date_taken', { ascending: false })
      .limit(5);

    const formattedGrades = (recentGrades || []).map(g => ({
      assessment_id: g.assessment_id,
      title: (g.assessment as { title?: string })?.title || g.assessment_id,
      date_taken: g.date_taken || '',
      score_percent: Number(g.score_percent) || 0,
      passed: g.passed || false,
    }));

    return NextResponse.json({
      success: true,
      data: {
        courseProgress: {
          completedChapters,
          totalChapters,
          completedDays,
          totalDays,
          paceStatus,
        },
        coverageAlerts: {
          totalGaps,
          nextGapDay,
          nextGapDate,
        },
        studentStats: {
          totalStudents,
          avgGrade,
          skillsCompletionRate: null, // TODO: calculate when skills data is populated
          atRiskCount,
        },
        recentGrades: formattedGrades,
        upcomingAssessments,
      },
    });
  } catch (error) {
    console.error('[LVFR-DASHBOARD] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
