import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/cases/[id]/practice/history
 *
 * Return all practice attempts for the current student on this case.
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

    // Find student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student record not found' },
        { status: 404 }
      );
    }

    // Fetch all attempts
    const { data: attempts, error: attemptsError } = await supabase
      .from('case_practice_progress')
      .select(
        'id, attempt_number, total_points, max_points, status, started_at, completed_at'
      )
      .eq('student_id', student.id)
      .eq('case_id', caseId)
      .order('attempt_number', { ascending: false });

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
