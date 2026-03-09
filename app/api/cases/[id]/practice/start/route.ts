import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { findPractitioner, type Practitioner } from '@/lib/practice-auth';

/**
 * POST /api/cases/[id]/practice/start
 *
 * Start or resume a practice attempt for a case study.
 * Works for both students (student_id) and instructors (practitioner_email).
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

    // Find practitioner (student or instructor)
    const practitioner = await findPractitioner(supabase, session.user.email);

    if (!practitioner) {
      return NextResponse.json(
        { error: 'User record not found. You need a student or instructor account to practice.' },
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
    let existingQuery = supabase
      .from('case_practice_progress')
      .select('*')
      .eq('case_id', caseId)
      .eq('status', 'in_progress')
      .order('attempt_number', { ascending: false })
      .limit(1);

    existingQuery = applyPractitionerFilter(existingQuery, practitioner);

    const { data: existingProgress } = await existingQuery.single();

    if (existingProgress) {
      // Resume existing attempt — also fetch existing responses
      let responsesQuery = supabase
        .from('case_responses')
        .select('*')
        .eq('case_id', caseId)
        .eq('attempt_number', existingProgress.attempt_number)
        .is('session_id', null)
        .order('submitted_at', { ascending: true });

      responsesQuery = applyResponseFilter(responsesQuery, practitioner);

      const { data: existingResponses } = await responsesQuery;

      return NextResponse.json({
        progress: existingProgress,
        caseStudy,
        responses: existingResponses || [],
        resumed: true,
      });
    }

    // Find the highest attempt number for this practitioner+case
    let lastAttemptQuery = supabase
      .from('case_practice_progress')
      .select('attempt_number')
      .eq('case_id', caseId)
      .order('attempt_number', { ascending: false })
      .limit(1);

    lastAttemptQuery = applyPractitionerFilter(lastAttemptQuery, practitioner);

    const { data: lastAttempt } = await lastAttemptQuery.single();

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
    const insertData: Record<string, unknown> = {
      student_id: practitioner.id, // null for instructors
      practitioner_email: practitioner.email,
      case_id: caseId,
      attempt_number: nextAttempt,
      current_phase: 0,
      current_question: 0,
      total_points: 0,
      max_points: maxPoints,
      status: 'in_progress',
      responses: [],
    };

    const { data: newProgress, error: progressError } = await supabase
      .from('case_practice_progress')
      .insert(insertData)
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

// ---------------------------------------------------------------------------
// Query filter helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyPractitionerFilter(query: any, p: Practitioner) {
  if (p.isStudent && p.id) {
    return query.eq('student_id', p.id);
  }
  return query.is('student_id', null).eq('practitioner_email', p.email);
}

function applyResponseFilter(query: any, p: Practitioner) {
  if (p.isStudent && p.id) {
    return query.eq('student_id', p.id);
  }
  return query.is('student_id', null).eq('student_email', p.email);
}
