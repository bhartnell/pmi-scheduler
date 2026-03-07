import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/cases/[id]/practice/start
 *
 * Start or resume a practice attempt for a case study.
 * - If an in_progress attempt exists, resume it
 * - Otherwise create a new attempt (incrementing attempt_number)
 * - Returns: progress record + full case data
 */
export async function POST(
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

    // Find student record by email
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, email, cohort_id')
      .ilike('email', session.user.email)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student record not found' },
        { status: 404 }
      );
    }

    // Fetch the case study
    const { data: caseStudy, error: caseError } = await supabase
      .from('case_studies')
      .select('*')
      .eq('id', caseId)
      .eq('is_active', true)
      .single();

    if (caseError || !caseStudy) {
      return NextResponse.json(
        { error: 'Case study not found' },
        { status: 404 }
      );
    }

    // Check for existing in_progress attempt
    const { data: existingProgress } = await supabase
      .from('case_practice_progress')
      .select('*')
      .eq('student_id', student.id)
      .eq('case_id', caseId)
      .eq('status', 'in_progress')
      .order('attempt_number', { ascending: false })
      .limit(1)
      .single();

    if (existingProgress) {
      // Resume existing attempt — also fetch existing responses
      const { data: existingResponses } = await supabase
        .from('case_responses')
        .select('*')
        .eq('case_id', caseId)
        .eq('student_id', student.id)
        .eq('attempt_number', existingProgress.attempt_number)
        .is('session_id', null)
        .order('submitted_at', { ascending: true });

      return NextResponse.json({
        progress: existingProgress,
        caseStudy,
        responses: existingResponses || [],
        resumed: true,
      });
    }

    // Find the highest attempt number for this student+case
    const { data: lastAttempt } = await supabase
      .from('case_practice_progress')
      .select('attempt_number')
      .eq('student_id', student.id)
      .eq('case_id', caseId)
      .order('attempt_number', { ascending: false })
      .limit(1)
      .single();

    const nextAttempt = (lastAttempt?.attempt_number || 0) + 1;

    // Calculate max_points from phases
    const phases = (caseStudy.phases || []) as Array<{
      questions?: Array<{ points?: number }>;
    }>;
    let maxPoints = 0;
    for (const phase of phases) {
      for (const q of phase.questions || []) {
        maxPoints += q.points || 10;
      }
    }

    // Create new progress record
    const { data: newProgress, error: progressError } = await supabase
      .from('case_practice_progress')
      .insert({
        student_id: student.id,
        case_id: caseId,
        attempt_number: nextAttempt,
        current_phase: 0,
        current_question: 0,
        total_points: 0,
        max_points: maxPoints,
        status: 'in_progress',
        responses: [],
      })
      .select()
      .single();

    if (progressError) {
      console.error('Error creating practice progress:', progressError);
      return NextResponse.json(
        { error: 'Failed to start practice' },
        { status: 500 }
      );
    }

    // Increment usage_count on the case (non-critical)
    try {
      await supabase
        .from('case_studies')
        .update({ usage_count: (caseStudy.usage_count || 0) + 1 })
        .eq('id', caseId);
    } catch {
      // Non-critical — ignore errors
    }

    return NextResponse.json({
      progress: newProgress,
      caseStudy,
      responses: [],
      resumed: false,
    });
  } catch (error) {
    console.error('Error starting practice:', error);
    return NextResponse.json(
      { error: 'Failed to start practice' },
      { status: 500 }
    );
  }
}
