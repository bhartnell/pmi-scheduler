import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { findPractitioner, type Practitioner } from '@/lib/practice-auth';
import type { CaseQuestion } from '@/types/case-studies';

/**
 * PUT /api/cases/[id]/practice/respond
 *
 * Submit a response to a question during practice mode.
 * Scores the response and updates progress.
 * Works for both students and instructors.
 *
 * Body: { phase_id, question_id, response, time_taken_seconds, hints_used }
 */
export async function PUT(
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
        { error: 'User record not found' },
        { status: 404 }
      );
    }

    // Parse body
    const body = await request.json();
    const { phase_id, question_id, response, time_taken_seconds, hints_used } = body;

    if (!phase_id || !question_id || response === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: phase_id, question_id, response' },
        { status: 400 }
      );
    }

    // Get current in_progress attempt
    let progressQuery = supabase
      .from('case_practice_progress')
      .select('*')
      .eq('case_id', caseId)
      .eq('status', 'in_progress')
      .order('attempt_number', { ascending: false })
      .limit(1);

    progressQuery = applyPractitionerFilter(progressQuery, practitioner);

    const { data: progress, error: progressError } = await progressQuery.single();

    if (progressError || !progress) {
      return NextResponse.json(
        { error: 'No active practice attempt found' },
        { status: 404 }
      );
    }

    // Fetch the case to find the question
    const { data: caseStudy, error: caseError } = await supabase
      .from('case_studies')
      .select('phases')
      .eq('id', caseId)
      .single();

    if (caseError || !caseStudy) {
      return NextResponse.json(
        { error: 'Case study not found' },
        { status: 404 }
      );
    }

    // Find the question in the case phases
    const phases = (caseStudy.phases || []) as Array<{
      id: string;
      questions?: CaseQuestion[];
    }>;

    let question: CaseQuestion | null = null;
    for (const phase of phases) {
      if (phase.id === phase_id) {
        for (const q of phase.questions || []) {
          if (q.id === question_id) {
            question = q;
            break;
          }
        }
        break;
      }
    }

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found in case' },
        { status: 404 }
      );
    }

    // Score the response
    const { isCorrect, pointsEarned } = scoreResponse(question, response);

    // Check if this response already exists (prevent double submissions)
    let dupeQuery = supabase
      .from('case_responses')
      .select('id')
      .eq('case_id', caseId)
      .eq('phase_id', phase_id)
      .eq('question_id', question_id)
      .eq('attempt_number', progress.attempt_number)
      .is('session_id', null)
      .limit(1);

    dupeQuery = applyResponseFilter(dupeQuery, practitioner);

    const { data: existingResponse } = await dupeQuery.single();

    if (existingResponse) {
      return NextResponse.json(
        { error: 'Response already submitted for this question' },
        { status: 409 }
      );
    }

    // Create case_responses record
    const { error: responseError } = await supabase
      .from('case_responses')
      .insert({
        case_id: caseId,
        student_id: practitioner.id, // null for instructors
        student_email: practitioner.email,
        student_name: practitioner.fullName,
        student_initials: practitioner.initials,
        practitioner_email: practitioner.email,
        phase_id,
        question_id,
        response: typeof response === 'object' ? response : { value: response },
        is_correct: isCorrect,
        points_earned: pointsEarned,
        time_taken_seconds: time_taken_seconds || null,
        hints_used: hints_used || 0,
        attempt_number: progress.attempt_number,
        session_id: null,
      });

    if (responseError) {
      console.error('Error saving response:', responseError);
      return NextResponse.json(
        { error: 'Failed to save response' },
        { status: 500 }
      );
    }

    // Update practice progress
    const newTotalPoints = (progress.total_points || 0) + pointsEarned;

    // Determine next question position
    const currentPhaseIdx = phases.findIndex((p) => p.id === phase_id);
    const currentPhase = phases[currentPhaseIdx];
    const currentQuestionIdx = (currentPhase?.questions || []).findIndex(
      (q) => q.id === question_id
    );
    const isLastQuestionInPhase =
      currentQuestionIdx >= (currentPhase?.questions || []).length - 1;

    const updateData: Record<string, unknown> = {
      total_points: newTotalPoints,
      updated_at: new Date().toISOString(),
    };

    if (isLastQuestionInPhase) {
      // Move to next phase, reset question index
      updateData.current_phase = currentPhaseIdx + 1;
      updateData.current_question = 0;
    } else {
      updateData.current_phase = currentPhaseIdx;
      updateData.current_question = currentQuestionIdx + 1;
    }

    await supabase
      .from('case_practice_progress')
      .update(updateData)
      .eq('id', progress.id);

    return NextResponse.json({
      is_correct: isCorrect,
      points_earned: pointsEarned,
      max_points: question.points || 10,
      explanation: question.explanation || null,
      correct_answer: question.correct_answer ?? null,
    });
  } catch (error) {
    console.error('Error submitting response:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreResponse(
  question: CaseQuestion,
  response: unknown
): { isCorrect: boolean; pointsEarned: number } {
  const maxPoints = question.points || 10;

  switch (question.type) {
    case 'multiple_choice': {
      const studentAnswer =
        typeof response === 'object' && response !== null
          ? (response as Record<string, unknown>).value
          : response;
      const isCorrect = String(studentAnswer) === String(question.correct_answer);
      return { isCorrect, pointsEarned: isCorrect ? maxPoints : 0 };
    }

    case 'multi_select': {
      const correctAnswers = Array.isArray(question.correct_answer)
        ? question.correct_answer
        : [question.correct_answer];
      const studentAnswers: string[] = Array.isArray(response)
        ? response
        : typeof response === 'object' && response !== null
          ? Array.isArray((response as Record<string, unknown>).value)
            ? ((response as Record<string, unknown>).value as string[])
            : [String((response as Record<string, unknown>).value)]
          : [String(response)];

      const correctSet = new Set(correctAnswers.map(String));
      const studentSet = new Set(studentAnswers.map(String));

      let correctSelections = 0;
      for (const ans of studentSet) {
        if (correctSet.has(ans)) correctSelections++;
      }

      const wrongSelections = studentSet.size - correctSelections;
      const adjustedScore = Math.max(0, correctSelections - wrongSelections);
      const ratio = correctSet.size > 0 ? adjustedScore / correctSet.size : 0;
      const pointsEarned = Math.round(ratio * maxPoints);
      const isCorrect = correctSelections === correctSet.size && wrongSelections === 0;
      return { isCorrect, pointsEarned };
    }

    case 'ordered_list': {
      const correctOrder = Array.isArray(question.correct_answer)
        ? question.correct_answer
        : [];
      const studentOrder: string[] = Array.isArray(response)
        ? response
        : typeof response === 'object' && response !== null
          ? Array.isArray((response as Record<string, unknown>).value)
            ? ((response as Record<string, unknown>).value as string[])
            : []
          : [];

      if (correctOrder.length === 0) {
        return { isCorrect: true, pointsEarned: maxPoints };
      }

      let correctPositions = 0;
      for (let i = 0; i < correctOrder.length; i++) {
        if (i < studentOrder.length && String(studentOrder[i]) === String(correctOrder[i])) {
          correctPositions++;
        }
      }

      const ratio = correctPositions / correctOrder.length;
      const pointsEarned = Math.round(ratio * maxPoints);
      const isCorrect = correctPositions === correctOrder.length;
      return { isCorrect, pointsEarned };
    }

    case 'numeric': {
      const studentValue =
        typeof response === 'object' && response !== null
          ? Number((response as Record<string, unknown>).value)
          : Number(response);
      const correctValue = Number(question.correct_answer);
      const tolerance = question.tolerance || 0;

      if (isNaN(studentValue) || isNaN(correctValue)) {
        return { isCorrect: false, pointsEarned: 0 };
      }

      const isCorrect = Math.abs(studentValue - correctValue) <= tolerance;
      return { isCorrect, pointsEarned: isCorrect ? maxPoints : 0 };
    }

    case 'free_text': {
      return { isCorrect: true, pointsEarned: maxPoints };
    }

    default:
      return { isCorrect: false, pointsEarned: 0 };
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
