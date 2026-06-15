import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { logAuditEvent } from '@/lib/audit';
import { listAttemptsForDay, saveAttempt } from '@/lib/adv-cert';
import type { SaveAttemptInput } from '@/types/adv-cert';

// GET /api/adv-cert/attempts?labDayId=...  -> attempts for a day (status/report)
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const labDayId = request.nextUrl.searchParams.get('labDayId');
  if (!labDayId) {
    return NextResponse.json({ success: false, error: 'labDayId is required' }, { status: 400 });
  }
  try {
    const attempts = await listAttemptsForDay(labDayId);
    return NextResponse.json({ success: true, attempts });
  } catch (error) {
    console.error('Error listing adv-cert attempts:', error);
    return NextResponse.json({ success: false, error: 'Failed to list attempts' }, { status: 500 });
  }
}

// POST /api/adv-cert/attempts  -> save a scored megacode run (idempotent on client_uuid)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body = (await request.json()) as SaveAttemptInput;

    // Minimal validation of the NOT-NULL parents.
    if (!body.lab_day_id) {
      return NextResponse.json({ success: false, error: 'lab_day_id is required' }, { status: 400 });
    }
    if (!body.lab_group_id) {
      return NextResponse.json({ success: false, error: 'lab_group_id is required' }, { status: 400 });
    }
    if (!body.scenario_id) {
      return NextResponse.json({ success: false, error: 'scenario_id is required' }, { status: 400 });
    }
    if (body.overall_result !== 'pass' && body.overall_result !== 'fail') {
      return NextResponse.json(
        { success: false, error: 'overall_result must be pass or fail' },
        { status: 400 }
      );
    }

    const result = await saveAttempt(body, user.id);

    logAuditEvent({
      user: { id: user.id, email: user.email, role: user.role },
      action: 'assessment_created',
      resourceType: 'scenario_assessment',
      resourceId: result.attempt.id,
      resourceDescription: `Advanced-cert (${(body.cert_course || 'acls').toUpperCase()}) megacode attempt — ${result.attempt.overall_result}`,
      metadata: {
        module: 'adv_cert',
        labDayId: body.lab_day_id,
        labStationId: body.lab_station_id,
        labGroupId: body.lab_group_id,
        scenarioId: body.scenario_id,
        teamLeadId: body.team_lead_id,
        studentCount: (body.student_ids || []).length,
        deduped: result.deduped,
        teamLeadLogWritten: result.teamLeadLogWritten,
      },
    }).catch(console.error);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error saving adv-cert attempt:', error);
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
