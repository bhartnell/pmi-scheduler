import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireStudentContext } from '@/lib/view-as-student';

/**
 * GET /api/student/open-lab
 * Student view Open lab page (STUDENT VIEW 5b). Read-only: upcoming open lab
 * sessions (the existing open_lab_sessions module, never scheduled lab days)
 * plus this student's own active signups. Signing up and removing reuse the
 * existing /api/open-lab/signup routes, so there is no second write path.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStudentContext(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth.found) {
    return NextResponse.json({ success: true, student: null, sessions: [], mySignups: [] });
  }

  try {
    const sb = getSupabaseAdmin();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

    const { data: student, error: sErr } = await sb
      .from('students')
      .select('first_name, last_name, email, cohort:cohorts!students_cohort_id_fkey(program:programs(abbreviation))')
      .eq('id', auth.id)
      .maybeSingle();
    if (sErr) throw new Error(`student lookup: ${sErr.message}`);

    const { data: sessions, error: ssErr } = await sb
      .from('open_lab_sessions')
      .select('id, date, start_time, end_time, notes')
      .eq('is_cancelled', false)
      .gte('date', today)
      .order('date', { ascending: true });
    if (ssErr) throw new Error(`sessions: ${ssErr.message}`);

    const { data: mine, error: mErr } = await sb
      .from('open_lab_signups')
      .select('id, session_id, program_level, what_to_work_on, edit_token')
      .ilike('student_email', auth.email)
      .is('cancelled_at', null);
    if (mErr) throw new Error(`signups: ${mErr.message}`);

    const cohort = Array.isArray(student?.cohort) ? student?.cohort[0] : student?.cohort;
    const program = Array.isArray(cohort?.program) ? cohort?.program[0] : cohort?.program;
    const abbr = (program as { abbreviation?: string } | null)?.abbreviation ?? null;

    return NextResponse.json({
      success: true,
      student: {
        name: `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(),
        email: auth.email,
        programLevel: abbr === 'PM' || abbr === 'PMD' ? 'Paramedic' : abbr === 'AEMT' ? 'AEMT' : abbr === 'EMT' ? 'EMT' : null,
      },
      canWrite: !auth.viewingAs || auth.isTest,
      sessions: sessions ?? [],
      mySignups: mine ?? [],
    });
  } catch (err) {
    console.error('Student open lab error:', err);
    return NextResponse.json({ success: false, error: 'Failed to load open lab sessions' }, { status: 500 });
  }
}
