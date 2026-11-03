import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getPalsAttemptRecord } from '@/lib/pals';

// GET /api/pals/attempts/[id] -> read-only record of one PALS attempt with its steps
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const record = await getPalsAttemptRecord(id);
    if (!record) return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...record });
  } catch (error) {
    console.error('Error loading PALS attempt record:', error);
    return NextResponse.json({ success: false, error: 'Failed to load attempt' }, { status: 500 });
  }
}
