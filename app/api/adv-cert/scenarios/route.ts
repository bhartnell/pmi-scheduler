import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { listScenarios } from '@/lib/adv-cert';
import type { CertCourse, CertTier } from '@/types/adv-cert';

// GET /api/adv-cert/scenarios?course=acls&tier=megacode_testing
// Returns the megacode scenario pool (derived from cert tags) for a picker.
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const course = (request.nextUrl.searchParams.get('course') || 'acls') as CertCourse;
  const tier = (request.nextUrl.searchParams.get('tier') || 'megacode_testing') as CertTier;

  try {
    const scenarios = await listScenarios(course, tier);
    return NextResponse.json({ success: true, scenarios });
  } catch (error) {
    console.error('Error listing adv-cert scenarios:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list scenarios' },
      { status: 500 }
    );
  }
}
