import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { findPractitioner, type Practitioner } from '@/lib/practice-auth';

/**
 * GET /api/cases/[id]/practice/progress
 *
 * Return the current in_progress attempt for this user on this case.
 * Returns null if no active attempt.
 * Works for both students and instructors.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Find practitioner (student or instructor)
    const practitioner = await findPractitioner(supabase, session.user.email);

    if (!practitioner) {
      // No user record — return null progress (not a 404 error)
      return NextResponse.json({ progress: null });
    }

    // Check for in_progress attempt
    let progressQuery = supabase
      .from('case_practice_progress')
      .select('*')
      .eq('case_id', caseId)
      .eq('status', 'in_progress')
      .order('attempt_number', { ascending: false })
      .limit(1);

    progressQuery = applyPractitionerFilter(progressQuery, practitioner);

    const { data: progress } = await progressQuery.single();

    return NextResponse.json({ progress: progress || null });
  } catch (error) {
    console.error('Error fetching practice progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Query filter helper
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyPractitionerFilter(query: any, p: Practitioner) {
  if (p.isStudent && p.id) {
    return query.eq('student_id', p.id);
  }
  return query.is('student_id', null).eq('practitioner_email', p.email);
}
