import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildStudentHome, type StudentLabDayRow, type StudentLeadRow } from '@/lib/student-home';
import { requireStudentContext } from '@/lib/view-as-student';

/**
 * GET /api/student/home
 * Student view home (mock v3): the signed-in student's own team-lead progress,
 * scenario results list and cohort lab days (or, for an admin viewing as a
 * student via card STUDENT VIEW 3/4, that student's — read-only). Never
 * returns notes, criteria or watch flags.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudentContext(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth.found) {
    return NextResponse.json({ success: true, student: null, message: 'Student record not found. Please contact your instructor.' });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data: student, error: sErr } = await sb
      .from('students')
      .select('id, first_name, last_name, cohort_id, cohort:cohorts!students_cohort_id_fkey(cohort_number, program:programs(name, abbreviation))')
      .eq('id', auth.id)
      .maybeSingle();
    if (sErr) throw new Error(`student lookup: ${sErr.message}`);
    if (!student) {
      return NextResponse.json({ success: true, student: null, message: 'Student record not found. Please contact your instructor.' });
    }

    const { data: logs, error: lErr } = await sb
      .from('team_lead_log')
      .select('date, course, phase, result, scenario:scenarios(title), station:lab_stations(custom_title, room)')
      .eq('student_id', student.id);
    if (lErr) throw new Error(`team lead log: ${lErr.message}`);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const { data: days, error: dErr } = student.cohort_id
      ? await sb.from('lab_days').select('date, title, start_time, cert_course, is_archived')
          .eq('cohort_id', student.cohort_id).gte('date', today).order('date').limit(60)
      : { data: [], error: null };
    if (dErr) throw new Error(`lab days: ${dErr.message}`);

    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
    const leadRows: StudentLeadRow[] = (logs ?? []).map((r) => {
      const scenario = one(r.scenario as { title: string | null } | { title: string | null }[] | null);
      const station = one(r.station as { custom_title: string | null; room: string | null } | { custom_title: string | null; room: string | null }[] | null);
      return { date: r.date, course: r.course, phase: r.phase, result: r.result, title: scenario?.title ?? station?.custom_title ?? null, room: station?.room ?? null };
    });

    const home = buildStudentHome(leadRows, (days ?? []) as StudentLabDayRow[], today);
    const cohort = one(student.cohort as { cohort_number: string; program: unknown } | { cohort_number: string; program: unknown }[] | null);
    return NextResponse.json({
      success: true,
      student: { firstName: student.first_name, cohortNumber: cohort?.cohort_number ?? null },
      home,
    });
  } catch (e) {
    console.error('[student/home]', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
