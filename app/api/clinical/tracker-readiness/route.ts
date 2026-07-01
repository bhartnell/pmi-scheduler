import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// GET /api/clinical/tracker-readiness  (lead_instructor+)
//
// Per-cohort "clinical ready" counts derived from the Clinical Tracker
// (student_compliance_docs), for the phase-segmented clinical overview.
// "Ready" = Rae has marked BOTH the Complio and mCE tabs complete for that
// student (complio_complete && mce_complete) — the same manual master
// checkboxes Rae sets in the tracker itself; this endpoint only rolls them
// up per-cohort, it introduces no new completion criteria.
//
// Scope: any cohort that has at least one student_compliance_docs row
// (i.e. is actually using the Clinical Tracker), not hardcoded by program.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { session } = auth;

    const { data: callerUser } = await supabase
      .from('lab_users')
      .select('role')
      .ilike('email', session.user.email)
      .single();

    if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Which cohorts actually use the Clinical Tracker.
    const { data: docsRows } = await supabase
      .from('student_compliance_docs')
      .select('student_id, cohort_id, complio_complete, mce_complete');

    const trackedCohortIds = [...new Set((docsRows || []).map(r => r.cohort_id).filter(Boolean))];
    if (trackedCohortIds.length === 0) {
      return NextResponse.json({ success: true, cohorts: [] });
    }

    const { data: cohorts } = await supabase
      .from('cohorts')
      .select('id, cohort_number, current_semester')
      .in('id', trackedCohortIds);

    const { data: students } = await supabase
      .from('students')
      .select('id, cohort_id')
      .in('cohort_id', trackedCohortIds)
      .eq('status', 'active');

    const readyByStudent = new Map<string, boolean>();
    for (const r of docsRows || []) {
      readyByStudent.set(r.student_id, !!r.complio_complete && !!r.mce_complete);
    }

    const result = (cohorts || []).map(c => {
      const cohortStudents = (students || []).filter(s => s.cohort_id === c.id);
      const total = cohortStudents.length;
      const ready = cohortStudents.filter(s => readyByStudent.get(s.id) === true).length;
      return {
        cohort_id: c.id,
        cohort_number: c.cohort_number,
        current_semester: c.current_semester,
        total,
        ready,
      };
    }).filter(c => c.total > 0);

    return NextResponse.json({ success: true, cohorts: result });
  } catch (error) {
    console.error('Error computing tracker readiness:', error);
    return NextResponse.json({ success: false, error: 'Failed to compute readiness' }, { status: 500 });
  }
}
