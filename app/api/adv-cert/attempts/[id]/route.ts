import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAttemptRecord } from '@/lib/adv-cert';

// GET /api/adv-cert/attempts/[id] -> read-only record of one scored megacode attempt
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const record = await getAttemptRecord(id);
    if (!record) return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...record });
  } catch (error) {
    console.error('Error loading adv-cert attempt record:', error);
    return NextResponse.json({ success: false, error: 'Failed to load attempt' }, { status: 500 });
  }
}
