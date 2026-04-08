import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const cohortId = searchParams.get('cohort_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    // Fetch all cohorts for the filter dropdown
    const { data: cohorts } = await supabase
      .from('cohorts')
      .select('id, cohort_number, program:programs(name)')
      .order('cohort_number', { ascending: false });

    const cohortList = (cohorts || []).map((c: any) => ({
      id: c.id,
      cohort_number: c.cohort_number,
      program_name: c.program?.name || 'Unknown',
    }));

    // Build the main evaluations query
    let query = supabase
      .from('student_skill_evaluations')
      .select(`
        id,
        student_id,
        skill_sheet_id,
        lab_day_id,
        evaluation_type,
        result,
        attempt_number,
        created_at,
        student:students!student_skill_evaluations_student_id_fkey(
          id,
          first_name,
          last_name,
          cohort_id
        ),
        skill_sheet:skill_sheets!student_skill_evaluations_skill_sheet_id_fkey(
          id,
          skill_name
        ),
        lab_day:lab_days!student_skill_evaluations_lab_day_id_fkey(
          id,
          date,
          title
        )
      `)
      .eq('status', 'complete')
      .order('created_at', { ascending: true });

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data: evaluations, error: evalError } = await query;

    if (evalError) {
      console.error('Skill trends query error:', evalError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch evaluations' },
        { status: 500 }
      );
    }

    // Filter by cohort if specified (post-query since it's on nested relation)
    let filtered = evaluations || [];
    if (cohortId) {
      filtered = filtered.filter(
        (e: any) => e.student?.cohort_id === cohortId
      );
    }

    // ── Summary ──
    const totalEvaluations = filtered.length;
    const uniqueStudents = new Set(filtered.map((e: any) => e.student_id));
    const totalStudents = uniqueStudents.size;
    const passCount = filtered.filter((e: any) => e.result === 'pass').length;
    const overallPassRate =
      totalEvaluations > 0
        ? Math.round((passCount / totalEvaluations) * 100 * 10) / 10
        : 0;

    const dates = filtered.map((e: any) => e.created_at).filter(Boolean);
    const dateRange = {
      from: dates.length > 0 ? dates[0].split('T')[0] : '',
      to: dates.length > 0 ? dates[dates.length - 1].split('T')[0] : '',
    };

    // ── By Skill ──
    const skillMap = new Map<
      string,
      {
        skill_sheet_id: string;
        skill_name: string;
        total: number;
        pass_count: number;
        fail_count: number;
        remediation_count: number;
      }
    >();

    for (const e of filtered) {
      const sid = e.skill_sheet_id;
      const name = (e as any).skill_sheet?.skill_name || 'Unknown Skill';
      if (!skillMap.has(sid)) {
        skillMap.set(sid, {
          skill_sheet_id: sid,
          skill_name: name,
          total: 0,
          pass_count: 0,
          fail_count: 0,
          remediation_count: 0,
        });
      }
      const s = skillMap.get(sid)!;
      s.total++;
      if (e.result === 'pass') s.pass_count++;
      else if (e.result === 'fail') s.fail_count++;
      else if (e.result === 'remediation') s.remediation_count++;
    }

    const bySkill = Array.from(skillMap.values()).map((s) => ({
      ...s,
      pass_rate:
        s.total > 0 ? Math.round((s.pass_count / s.total) * 100 * 10) / 10 : 0,
    }));
    bySkill.sort((a, b) => a.pass_rate - b.pass_rate);

    // ── By Date (lab day) ──
    const dateMap = new Map<
      string,
      {
        lab_day_id: string;
        date: string;
        lab_day_title: string;
        total: number;
        pass_count: number;
      }
    >();

    for (const e of filtered) {
      const ldId = e.lab_day_id;
      if (!ldId) continue;
      const ld = (e as any).lab_day;
      const dateStr = ld?.date || e.created_at?.split('T')[0] || '';
      if (!dateMap.has(ldId)) {
        dateMap.set(ldId, {
          lab_day_id: ldId,
          date: dateStr,
          lab_day_title: ld?.title || 'Lab Day',
          total: 0,
          pass_count: 0,
        });
      }
      const d = dateMap.get(ldId)!;
      d.total++;
      if (e.result === 'pass') d.pass_count++;
    }

    const byDate = Array.from(dateMap.values())
      .map((d) => ({
        ...d,
        pass_rate:
          d.total > 0
            ? Math.round((d.pass_count / d.total) * 100 * 10) / 10
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── By Student ──
    const studentMap = new Map<
      string,
      {
        student_id: string;
        student_name: string;
        evaluations: { result: string; created_at: string }[];
      }
    >();

    for (const e of filtered) {
      const sId = e.student_id;
      const st = (e as any).student;
      const name = st
        ? `${st.first_name || ''} ${st.last_name || ''}`.trim()
        : 'Unknown';
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          student_id: sId,
          student_name: name,
          evaluations: [],
        });
      }
      studentMap.get(sId)!.evaluations.push({
        result: e.result,
        created_at: e.created_at,
      });
    }

    const byStudent = Array.from(studentMap.values()).map((s) => {
      const total = s.evaluations.length;
      const pc = s.evaluations.filter((ev) => ev.result === 'pass').length;
      const fc = s.evaluations.filter((ev) => ev.result === 'fail').length;
      const passRate =
        total > 0 ? Math.round((pc / total) * 100 * 10) / 10 : 0;

      // Trend: compare first half vs second half pass rates
      let trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' =
        'insufficient_data';
      if (total >= 3) {
        const sorted = [...s.evaluations].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const mid = Math.floor(sorted.length / 2);
        const firstHalf = sorted.slice(0, mid);
        const secondHalf = sorted.slice(mid);
        const firstRate =
          firstHalf.length > 0
            ? firstHalf.filter((ev) => ev.result === 'pass').length /
              firstHalf.length
            : 0;
        const secondRate =
          secondHalf.length > 0
            ? secondHalf.filter((ev) => ev.result === 'pass').length /
              secondHalf.length
            : 0;

        if (secondRate > firstRate) trend = 'improving';
        else if (secondRate < firstRate) trend = 'declining';
        else trend = 'stable';
      }

      return {
        student_id: s.student_id,
        student_name: s.student_name,
        total,
        pass_count: pc,
        fail_count: fc,
        pass_rate: passRate,
        trend,
      };
    });
    byStudent.sort((a, b) => a.student_name.localeCompare(b.student_name));

    // ── Low Pass Skills ──
    const lowPassSkills = bySkill
      .filter((s) => s.pass_rate < 80)
      .map((s) => ({
        skill_name: s.skill_name,
        pass_rate: s.pass_rate,
        total: s.total,
      }));

    return NextResponse.json({
      success: true,
      summary: {
        total_evaluations: totalEvaluations,
        total_students: totalStudents,
        overall_pass_rate: overallPassRate,
        date_range: dateRange,
      },
      by_skill: bySkill,
      by_date: byDate,
      by_student: byStudent,
      low_pass_skills: lowPassSkills,
      cohorts: cohortList,
    });
  } catch (err) {
    console.error('Skill trends error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
