import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getScenarioWithChecklist } from '@/lib/pals';

// GET /api/pals/scenarios/[id]
// Full grading-form structure: scenario (+ narrative card) + its pathophysiology
// checklist with ordered active criteria.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const scenario = await getScenarioWithChecklist(id);
    if (!scenario) {
      return NextResponse.json({ success: false, error: 'Scenario not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, scenario });
  } catch (error) {
    console.error('Error fetching PALS scenario:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch scenario' }, { status: 500 });
  }
}
