import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { listPalsScenarios } from '@/lib/pals';

// GET /api/pals/scenarios?tier=scenario_practice,scenario_testing
// PALS scenario pool for a picker — gated on narrative_status='complete'
// (an un-narrated scenario is never presented, per the spec).
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const tierParam = request.nextUrl.searchParams.get('tier');
  const tiers = tierParam
    ? tierParam.split(',').map((t) => t.trim()).filter(Boolean)
    : ['scenario_practice', 'scenario_testing'];

  try {
    const scenarios = await listPalsScenarios(tiers);
    return NextResponse.json({ success: true, scenarios });
  } catch (error) {
    console.error('Error listing PALS scenarios:', error);
    return NextResponse.json({ success: false, error: 'Failed to list scenarios' }, { status: 500 });
  }
}
