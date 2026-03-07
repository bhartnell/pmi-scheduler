import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/cases/[id]/practice/progress
 *
 * Return the current in_progress attempt for this student on this case.
 * Returns null if no active attempt.
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

    // Check for in_progress attempt
    const { data: progress } = await supabase
      .from('case_practice_progress')
      .select('*')
      .eq('student_id', student.id)
      .eq('case_id', caseId)
      .eq('status', 'in_progress')
      .order('attempt_number', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ progress: progress || null });
  } catch (error) {
    console.error('Error fetching practice progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
