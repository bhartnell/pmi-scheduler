import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/lab-management/skill-coverage?cohort_id=UUID
//
// Returns which skills have been completed in previous labs for a cohort.
// Groups by skill_sheet_id, counts distinct students completed.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const cohortId = request.nextUrl.searchParams.get('cohort_id');
  if (!cohortId) {
    return NextResponse.json(
      { success: false, error: 'cohort_id is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get total active students in cohort
    const { count: totalStudents } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('cohort_id', cohortId)
      .eq('status', 'active');

    // Get all evaluations for students in this cohort, joined with lab_days for date
    const { data: evaluations, error } = await supabase
      .from('student_skill_evaluations')
      .select(`
        id,
        student_id,
        skill_sheet_id,
        result,
        lab_day_id,
        created_at,
        skill_sheet:skill_sheets(id, skill_name),
        student:students!student_skill_evaluations_student_id_fkey(id, cohort_id),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(id, date, week_number)
      `)
      .not('lab_day_id', 'is', null);

    if (error) {
      // Table may not exist yet
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, coverage: {}, totalStudents: totalStudents || 0 });
      }
      throw error;
    }

    // Filter to only this cohort's students
    const cohortEvals = (evaluations || []).filter(
      (e: Record<string, unknown>) => {
        const student = e.student as { id: string; cohort_id: string } | null;
        return student?.cohort_id === cohortId;
      }
    );

    // Group by skill_sheet_id
    const coverageMap: Record<string, {
      skillSheetId: string;
      skillName: string;
      studentsCompleted: Set<string>;
      studentsPassed: Set<string>;
      studentsFailed: Set<string>;
      lastLabDate: string | null;
      lastLabWeek: number | null;
    }> = {};

    for (const evalItem of cohortEvals) {
      const ssId = evalItem.skill_sheet_id as string;
      const skillSheet = evalItem.skill_sheet as unknown as { id: string; skill_name: string } | null;
      const labDay = evalItem.lab_day as unknown as { id: string; date: string; week_number: number | null } | null;

      if (!coverageMap[ssId]) {
        coverageMap[ssId] = {
          skillSheetId: ssId,
          skillName: skillSheet?.skill_name || 'Unknown',
          studentsCompleted: new Set(),
          studentsPassed: new Set(),
          studentsFailed: new Set(),
          lastLabDate: null,
          lastLabWeek: null,
        };
      }

      const entry = coverageMap[ssId];
      const studentId = evalItem.student_id as string;
      entry.studentsCompleted.add(studentId);

      if (evalItem.result === 'pass') {
        entry.studentsPassed.add(studentId);
      } else {
        entry.studentsFailed.add(studentId);
      }

      const labDate = labDay?.date || null;
      if (labDate && (!entry.lastLabDate || labDate > entry.lastLabDate)) {
        entry.lastLabDate = labDate;
        entry.lastLabWeek = labDay?.week_number || null;
      }
    }

    // Convert to serializable format
    const coverage: Record<string, {
      skillSheetId: string;
      skillName: string;
      studentsCompleted: number;
      studentsPassed: number;
      studentsFailed: number;
      totalStudents: number;
      lastLabDate: string | null;
      lastLabWeek: number | null;
    }> = {};

    for (const [ssId, entry] of Object.entries(coverageMap)) {
      coverage[ssId] = {
        skillSheetId: entry.skillSheetId,
        skillName: entry.skillName,
        studentsCompleted: entry.studentsCompleted.size,
        studentsPassed: entry.studentsPassed.size,
        studentsFailed: entry.studentsFailed.size,
        totalStudents: totalStudents || 0,
        lastLabDate: entry.lastLabDate,
        lastLabWeek: entry.lastLabWeek,
      };
    }

    return NextResponse.json({
      success: true,
      coverage,
      totalStudents: totalStudents || 0,
    });
  } catch (err) {
    console.error('Error fetching skill coverage:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
