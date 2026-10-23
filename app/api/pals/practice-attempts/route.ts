import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';
import { getSupabaseAdmin } from '@/lib/supabase';
import { saveTestAttempt } from '@/lib/pals';
import { validatePalsPractice, type PalsPracticeInput } from '@/lib/pals-practice';

interface Body extends PalsPracticeInput {
  lab_station_id?: string | null;
  lab_group_id?: string | null;
  client_uuid?: string | null;
}

// POST /api/pals/practice-attempts -> one practice case graded for one student as team lead
// (pass/fail + optional watch + note). The grader is the signed-in user. The checklist comes
// from the case itself; a case with no checklist is refused rather than guessed.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = (await request.json()) as Body;
    const v = validatePalsPractice(body);
    if (!v.ok) {
      return NextResponse.json({ success: false, error: v.error }, { status: 400 });
    }

    const { data: scenario, error: sErr } = await getSupabaseAdmin()
      .from('scenarios')
      .select('id, pals_checklist_id')
      .eq('id', v.value.scenario_id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!scenario) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }
    if (!scenario.pals_checklist_id) {
      return NextResponse.json(
        { success: false, error: 'This case has no PALS checklist linked, so it cannot be graded yet' },
        { status: 422 }
      );
    }

    const result = await saveTestAttempt(
      {
        checklist_id: scenario.pals_checklist_id,
        scenario_id: v.value.scenario_id,
        student_id: v.value.student_id,
        lab_day_id: v.value.lab_day_id,
        lab_station_id: body.lab_station_id,
        lab_group_id: body.lab_group_id,
        result: v.value.result,
        watch: v.value.watch,
        watch_note: v.value.watch_note,
        phase: 'practice',
        criterion_results: [],
        client_uuid: body.client_uuid,
      },
      user.id
    );

    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'assessment_created',
      resourceType: 'scenario_assessment',
      resourceId: result.attempt.id,
      resourceDescription: `PALS practice attempt — ${result.attempt.result}${v.value.watch ? ' (watch)' : ''}`,
      metadata: {
        module: 'pals',
        phase: 'practice',
        labDayId: v.value.lab_day_id,
        scenarioId: v.value.scenario_id,
        studentId: v.value.student_id,
        watch: v.value.watch,
        deduped: result.deduped,
      },
    }).catch(console.error);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error saving PALS practice attempt:', error);
    return NextResponse.json({ success: false, error: 'Failed to save practice attempt' }, { status: 500 });
  }
}
