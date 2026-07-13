import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';
import { listAttemptsForDay, listOpenRetestCandidates, saveTestAttempt } from '@/lib/pals';
import type { SavePalsAttemptInput } from '@/types/pals';

// GET /api/pals/attempts?labDayId=...              -> attempts for a day (status/report)
// GET /api/pals/attempts?studentId=...&checklistId=... -> open NR attempts for the retest_of picker
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const labDayId = request.nextUrl.searchParams.get('labDayId');
  const studentId = request.nextUrl.searchParams.get('studentId');
  const checklistId = request.nextUrl.searchParams.get('checklistId');

  try {
    if (studentId && checklistId) {
      const candidates = await listOpenRetestCandidates(studentId, checklistId);
      return NextResponse.json({ success: true, candidates });
    }
    if (!labDayId) {
      return NextResponse.json(
        { success: false, error: 'labDayId (or studentId+checklistId) is required' },
        { status: 400 }
      );
    }
    const attempts = await listAttemptsForDay(labDayId);
    return NextResponse.json({ success: true, attempts });
  } catch (error) {
    console.error('Error listing PALS attempts:', error);
    return NextResponse.json({ success: false, error: 'Failed to list attempts' }, { status: 500 });
  }
}

// POST /api/pals/attempts  -> save a scored PALS test run (idempotent on client_uuid)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = (await request.json()) as SavePalsAttemptInput;

    if (!body.checklist_id) {
      return NextResponse.json({ success: false, error: 'checklist_id is required' }, { status: 400 });
    }
    if (!body.student_id) {
      return NextResponse.json({ success: false, error: 'student_id (team leader) is required' }, { status: 400 });
    }
    if (!body.lab_day_id) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }
    if (body.result !== 'PASS' && body.result !== 'NR') {
      return NextResponse.json({ success: false, error: 'result must be PASS or NR' }, { status: 400 });
    }
    if (body.result === 'NR' && !body.remediation_notes) {
      return NextResponse.json(
        { success: false, error: 'remediation_notes is required when result is NR' },
        { status: 400 }
      );
    }

    const result = await saveTestAttempt(body, user.id);

    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'assessment_created',
      resourceType: 'scenario_assessment',
      resourceId: result.attempt.id,
      resourceDescription: `PALS testing checklist attempt — ${result.attempt.result}`,
      metadata: {
        module: 'pals',
        labDayId: body.lab_day_id,
        labStationId: body.lab_station_id,
        labGroupId: body.lab_group_id,
        checklistId: body.checklist_id,
        scenarioId: body.scenario_id,
        studentId: body.student_id,
        retestOf: body.retest_of,
        deduped: result.deduped,
        teamLeadLogWritten: result.teamLeadLogWritten,
      },
    }).catch(console.error);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error saving PALS attempt:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error)?.message || 'Failed to save attempt',
        code: (error as any)?.code,
        details: (error as any)?.details,
      },
      { status: 500 }
    );
  }
}
