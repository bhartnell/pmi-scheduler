import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { findPractitioner, type Practitioner } from '@/lib/practice-auth';

/**
 * GET /api/cases/[id]/practice/history
 *
 * Return all practice attempts for the current user on this case.
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
      // Return empty history instead of 404 — user just hasn't practiced yet
      return NextResponse.json({ history: [] });
    }

    // Fetch all attempts
    let attemptsQuery = supabase
      .from('case_practice_progress')
      .select(
        'id, attempt_number, total_points, max_points, status, started_at, completed_at'
      )
      .eq('case_id', caseId)
      .order('attempt_number', { ascending: false });

    attemptsQuery = applyPractitionerFilter(attemptsQuery, practitioner);

    const { data: attempts, error: attemptsError } = await attemptsQuery;

    if (attemptsError) {
      console.error('Error fetching history:', attemptsError);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    const history = (attempts || []).map((a) => ({
      attempt_number: a.attempt_number,
      total_points: a.total_points,
      max_points: a.max_points,
      percentage:
        a.max_points > 0
          ? Math.round((a.total_points / a.max_points) * 100)
          : 0,
      status: a.status,
      started_at: a.started_at,
      completed_at: a.completed_at,
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching practice history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
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
